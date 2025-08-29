import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { auth } from "@clerk/nextjs/server";
import type { ApiResponse, VideoEmbed } from "@/types";
import { getProjectExcludedDomains } from "@/lib/utils/article-generation";
import { getRelatedArticles } from "@/lib/utils/related-articles";
import { db } from "@/server/db";
import { articles, articleGeneration, users, projects } from "@/server/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { hasCredits, deductCredit } from "@/lib/utils/credits";

// Import services instead of using HTTP calls
import { performResearchDirect } from "@/lib/services/research-service";
import type { ResearchResponse } from "@/lib/services/research-service";
import { performWriteLogic } from "@/lib/services/write-service";
import type { WriteResponse } from "@/lib/services/write-service";
import { performQualityControlLogic } from "@/lib/services/quality-control-service";
import type { QualityControlResponse } from "@/lib/services/quality-control-service";
import { performValidateLogic } from "@/lib/services/validation-service";
import type { ValidateResponse } from "@/lib/services/validation-service";
import { performGenericUpdate } from "@/lib/services/update-service";
import { performImageSelectionLogic } from "@/lib/services/image-selection-service";
import { logServerError } from "@/lib/posthog-server";

export const maxDuration = 800;

// Types colocated with this API route
export interface ArticleGenerationRequest {
  articleId: string;
  forceRegenerate?: boolean;
}

interface GenerationContext {
  articleId: number;
  userId: string;
  article: typeof articles.$inferSelect;
  keywords: string[];
  relatedArticles: string[];
}

// Validation and setup functions
async function validateAndSetupGeneration(
  userId: string,
  articleId: string,
  forceRegenerate?: boolean,
): Promise<GenerationContext> {
  // Verify user exists in database
  const [userRecord] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!userRecord) {
    throw new Error("User not found");
  }

  // Check if user has credits before starting generation
  const userHasCredits = await hasCredits(userRecord.id);
  if (!userHasCredits) {
    throw new Error(
      "Insufficient credits. You need at least 1 credit to generate an article.",
    );
  }

  if (!articleId || isNaN(parseInt(articleId))) {
    throw new Error("Invalid article ID");
  }

  const id = parseInt(articleId);

  // Check if article exists and belongs to current user's project using JOIN
  const [result] = await db
    .select()
    .from(articles)
    .innerJoin(projects, eq(articles.projectId, projects.id))
    .where(and(eq(articles.id, id), eq(projects.userId, userRecord.id)))
    .limit(1);

  if (!result) {
    throw new Error("Article not found or access denied");
  }

  const existingArticle = result.articles;

  console.log("Article validation", {
    articleId: id,
    currentStatus: existingArticle.status,
    forceRegenerate,
    title: existingArticle.title,
  });

  // Check if article is already being generated (unless force regenerate)
  if (existingArticle.status === "generating" && !forceRegenerate) {
    console.log("Generation already in progress", {
      articleId: id,
      currentStatus: existingArticle.status,
    });
    throw new Error("Article generation already in progress");
  }

  const keywords = Array.isArray(existingArticle.keywords)
    ? (existingArticle.keywords as string[])
    : [];
  const effectiveKeywords = keywords.length > 0 ? keywords : [existingArticle.title];

  // Generate related articles early so we can include them in the immediate response
  const relatedArticles = await getRelatedArticles(
    existingArticle.projectId,
    existingArticle.title,
    effectiveKeywords,
  );

  return {
    articleId: id,
    userId: userRecord.id,
    article: existingArticle,
    keywords: effectiveKeywords,
    relatedArticles,
  };
}

// Generation phase functions
async function createOrResetArticleGeneration(
  articleId: number,
  userId: string,
): Promise<typeof articleGeneration.$inferSelect> {
  // Get article details including projectId
  const [article] = await db
    .select({
      projectId: articles.projectId,
    })
    .from(articles)
    .where(eq(articles.id, articleId))
    .limit(1);

  if (!article) {
    throw new Error(`Article ${articleId} not found`);
  }

  // First, check if there's an existing generation record for this article
  const [existingRecord] = await db
    .select()
    .from(articleGeneration)
    .where(eq(articleGeneration.articleId, articleId))
    .orderBy(desc(articleGeneration.createdAt))
    .limit(1);

  if (existingRecord) {
    const existingRelated = Array.isArray(existingRecord.relatedArticles)
      ? existingRecord.relatedArticles
      : [];

    console.log("Reusing existing generation record", {
      generationId: existingRecord.id,
      currentStatus: existingRecord.status,
      previousQualityControlReport: existingRecord.qualityControlReport,
      existingRelatedArticlesCount: existingRelated.length,
    });

    // Reset the existing record for a new generation attempt while preserving related articles if any
    const [updatedRecord] = await db
      .update(articleGeneration)
      .set({
        status: "pending",
        progress: 0,
        startedAt: null, // defer startedAt to actual start
        completedAt: null,
        error: null,
        errorDetails: null,
        draftContent: null,
        validationReport: "",
        qualityControlReport: null, // Reset quality control report
        researchData: {},
        seoReport: {},
        imageKeywords: [],
        relatedArticles: existingRelated.length > 0 ? existingRelated : [],
        updatedAt: new Date(),
      })
      .where(eq(articleGeneration.id, existingRecord.id))
      .returning();

    if (!updatedRecord) {
      throw new Error("Failed to reset generation record");
    }

    return updatedRecord;
  }

  // Create new record if none exists
  console.log("Creating new generation record", { articleId, userId });
  const result = await db
    .insert(articleGeneration)
    .values({
      articleId,
      userId,
      projectId: article.projectId,
      status: "pending",
      progress: 0,
      startedAt: null, // defer startedAt to actual start
      validationReport: "",
      researchData: {},
      seoReport: {},
      imageKeywords: [],
      relatedArticles: [],
    })
    .returning();

  const record = result[0];
  if (!record) {
    throw new Error("Failed to create generation record");
  }

  return record;
}

async function updateGenerationProgress(
  generationId: number,
  status: string,
  progress: number,
  additionalData?: Record<string, unknown>,
): Promise<void> {
  await db
    .update(articleGeneration)
    .set({
      status,
      progress,
      updatedAt: new Date(),
      ...additionalData,
    })
    .where(eq(articleGeneration.id, generationId));
}

async function performResearch(
  title: string,
  keywords: string[],
  generationId: number,
  userId: string,
  projectId: number,
  notes?: string,
): Promise<ResearchResponse> {
  await updateGenerationProgress(generationId, "researching", 10);

  console.log("Starting research phase", {
    title,
    keywords,
    hasNotes: !!notes,
  });

  // Get excluded domains for the project
  const excludedDomains = await getProjectExcludedDomains(projectId);

  const researchData = await performResearchDirect({
    title,
    keywords,
    notes,
    excludedDomains,
  });

  console.log("Research completed", {
    hasResearchData: !!researchData.researchData,
    sourcesCount: researchData.sources?.length ?? 0,
    dataLength: researchData.researchData?.length ?? 0,
  });

  await updateGenerationProgress(generationId, "researching", 25, {
    researchData: researchData,
  });

  return researchData;
}

async function selectCoverImage(
  articleId: number,
  generationId: number,
  title: string,
  keywords: string[],
  userId: string,
  projectId: number,
): Promise<{ coverImageUrl: string; coverImageAlt: string }> {
  try {
    console.log("Starting image selection phase", {
      articleId,
      generationId,
      title,
      keywordsCount: keywords.length,
    });

    const imageResult = await performImageSelectionLogic({
      articleId,
      generationId,
      title,
      keywords,
      orientation: "landscape",
      userId,
      projectId,
    });

    console.log("Image selection completed", {
      success: imageResult.success,
      hasCoverImageUrl: !!imageResult.data?.coverImageUrl,
    });

    if (imageResult.success && imageResult.data?.coverImageUrl) {
      return {
        coverImageUrl: imageResult.data.coverImageUrl,
        coverImageAlt: imageResult.data.coverImageAlt ?? "",
      };
    }
  } catch (error) {
    console.log(
      "Image selection failed, continuing without cover image",
      error,
    );
  }

  return { coverImageUrl: "", coverImageAlt: "" };
}

async function writeArticle(
  researchData: ResearchResponse,
  title: string,
  keywords: string[],
  coverImageUrl: string,
  generationId: number,
  userId: string,
  projectId: number,
  relatedArticles: string[],
  videos?: Array<{ title: string; url: string }>,
  notes?: string,
): Promise<WriteResponse> {
  await updateGenerationProgress(generationId, "writing", 50);

  console.log("Starting write phase", {
    title,
    keywordsCount: keywords.length,
    hasCoverImage: !!coverImageUrl,
    videosCount: videos?.length ?? 0,
  });

  const writeData = await performWriteLogic({
    researchData: researchData,
    title,
    keywords,
    coverImage: coverImageUrl ?? undefined,
    videos,
    userId,
    projectId,
    relatedArticles,
    generationId,
    sources: researchData.sources ?? [],
    notes: notes ?? undefined,
  });

  console.log("Write completed", {
    contentLength: writeData.content?.length ?? 0,
    hasMetaDescription: !!writeData.metaDescription,
    hasSlug: !!writeData.slug,
    tagsCount: writeData.tags?.length ?? 0,
  });

  await updateGenerationProgress(generationId, "quality-control", 60, {
    draftContent: writeData.content ?? "",
  });

  return writeData;
}

async function performQualityControl(
  content: string,
  generationId: number,
  userId: string,
  projectId: number,
): Promise<QualityControlResponse> {
  const startTime = Date.now();

  console.log("Starting quality control phase", {
    contentLength: content.length,
    generationId,
    userId,
  });

  try {
    // Get the write prompt from the generation record
    const [generationRecord] = await db
      .select({ writePrompt: articleGeneration.writePrompt })
      .from(articleGeneration)
      .where(eq(articleGeneration.id, generationId))
      .limit(1);

    const originalPrompt = generationRecord?.writePrompt ?? "";

    if (!originalPrompt) {
      console.log("No write prompt found, skipping quality control", {
        generationId,
        processingTimeMs: Date.now() - startTime,
      });
      return {
        issues: null,
        isValid: true,
      };
    }

    console.log("Performing quality control with write prompt", {
      generationId,
      hasPrompt: !!originalPrompt,
      promptLength: originalPrompt.length,
    });

    const qualityControlData = await performQualityControlLogic({
      articleContent: content,
      originalPrompt,
      generationId,
      userId,
      projectId,
    });

    console.log("Quality control completed", {
      isValid: qualityControlData.isValid,
      hasIssues: !!qualityControlData.issues,
      issuesLength: qualityControlData.issues?.length ?? 0,
      processingTimeMs: Date.now() - startTime,
      generationId,
      rawIssues: qualityControlData.issues, // Log the actual content
    });

    // Log detailed quality control data for debugging
    console.log("QUALITY_CONTROL_DETAILED_RESPONSE", {
      timestamp: new Date().toISOString(),
      generationId,
      userId,
      response: {
        isValid: qualityControlData.isValid,
        issues: qualityControlData.issues,
        issuesType: typeof qualityControlData.issues,
        issuesIsNull: qualityControlData.issues === null,
        issuesIsUndefined: qualityControlData.issues === undefined,
        issuesLength: qualityControlData.issues?.length ?? 0,
      },
    });

    // Note: Quality control service already saves the report to database
    // We only update the progress here to avoid double-saving
    await updateGenerationProgress(generationId, "quality-control", 70);

    return qualityControlData;
  } catch (error) {
    const processingTime = Date.now() - startTime;

    // Enhanced error logging with categorization
    let errorCategory = "unknown_error";
    let shouldRetry = false;

    if (error instanceof Error) {
      if (error.message.includes("timeout")) {
        errorCategory = "timeout_error";
        shouldRetry = false; // Don't retry timeouts to avoid blocking generation
      } else if (error.message.includes("fetch")) {
        errorCategory = "network_error";
        shouldRetry = true;
      } else if (error.message.includes("500")) {
        errorCategory = "server_error";
        shouldRetry = true;
      } else if (error.message.includes("400")) {
        errorCategory = "client_error";
        shouldRetry = false;
      }
    }

    console.error(
      "Quality control failed, proceeding without quality control",
      {
        error:
          error instanceof Error
            ? {
                name: error.name,
                message: error.message,
                stack: error.stack?.slice(0, 500),
              }
            : error,
        errorCategory,
        shouldRetry,
        processingTimeMs: processingTime,
        generationId,
        contentLength: content.length,
      },
    );

    // Log quality control failure metrics for monitoring
    console.log("QUALITY_CONTROL_FAILURE_METRICS", {
      timestamp: new Date().toISOString(),
      generationId,
      userId,
      errorCategory,
      processingTimeMs: processingTime,
      contentLength: content.length,
      fallbackUsed: true,
    });

    // If quality control fails, return a fallback response
    // This prevents the entire generation from failing
    const fallbackResponse: QualityControlResponse = {
      issues: null,
      isValid: true,
    };

    console.log("QUALITY_CONTROL_FALLBACK_RESPONSE", {
      timestamp: new Date().toISOString(),
      generationId,
      userId,
      fallbackResponse,
      errorCategory,
      processingTimeMs: processingTime,
    });

    // Save null quality control report to indicate failure/skip
    await updateGenerationProgress(generationId, "quality-control", 70, {
      qualityControlReport: null,
    });

    return fallbackResponse;
  }
}

async function validateArticle(
  content: string,
  generationId: number,
): Promise<ValidateResponse> {
  console.log("Starting validation phase", {
    contentLength: content.length,
  });

  try {
    const validationData = await performValidateLogic(content);

    console.log("Validation completed", {
      isValid: validationData.isValid,
      issuesCount: validationData.issues?.length ?? 0,
      hasRawText: !!validationData.rawValidationText,
    });

    await updateGenerationProgress(generationId, "updating", 85, {
      validationReport: validationData.rawValidationText ?? "",
    });

    return validationData;
  } catch (error) {
    console.error("Validation failed, proceeding without validation", error);

    // If validation fails due to timeout or other errors, return a fallback response
    // This prevents the entire generation from failing
    const fallbackResponse: ValidateResponse = {
      isValid: true,
      issues: [],
      rawValidationText: "Validation skipped due to timeout or error",
    };

    await updateGenerationProgress(generationId, "updating", 90, {
      validationReport: `Validation skipped: ${error instanceof Error ? error.message : "Unknown error"}`,
    });

    return fallbackResponse;
  }
}

async function updateArticleIfNeeded(
  content: string,
  validationText: string,
  qualityControlIssues: string | null | undefined,
): Promise<string> {
  // Determine if we need to update based on validation or quality control issues
  const hasValidationIssues =
    validationText &&
    !validationText.includes("No factual issues identified") &&
    !validationText.toLowerCase().includes("validation skipped");

  const hasQualityControlIssues =
    qualityControlIssues !== null && qualityControlIssues !== undefined;

  // Skip update if no issues found
  if (!hasValidationIssues && !hasQualityControlIssues) {
    console.log(
      "No validation or quality control issues found, skipping update",
    );
    return content;
  }

  // Combine validation and quality control feedback
  let combinedFeedback = "";

  if (hasValidationIssues) {
    combinedFeedback += `## Validation Issues\n\n${validationText}\n\n`;
  }

  if (hasQualityControlIssues) {
    combinedFeedback += `## Quality Control Issues\n\n${qualityControlIssues}\n\n`;
  }

  console.log("Starting update with combined feedback", {
    hasValidationIssues,
    hasQualityControlIssues,
    combinedFeedbackLength: combinedFeedback.length,
  });

  const updateResult = await performGenericUpdate({
    article: content,
    validationText: combinedFeedback,
  });

  return updateResult.updatedContent ?? content;
}

async function finalizeArticle(
  articleId: number,
  writeData: WriteResponse,
  content: string,
  coverImageUrl: string,
  coverImageAlt: string,
  generationId: number,
  userId: string,
  videos?: VideoEmbed[], // Add videos parameter
): Promise<void> {
  const updateData: {
    draft: string;
    videos?: VideoEmbed[];
    slug?: string;
    metaDescription: string;
    metaKeywords?: string[];
    status: "wait_for_publish";
    updatedAt: Date;
    coverImageUrl?: string;
    coverImageAlt?: string;
  } = {
    draft: content,
    videos: videos ?? [], // Save videos to database
    metaDescription: writeData.metaDescription ?? "",
    status: "wait_for_publish",
    updatedAt: new Date(),
  };

  // Save generated slug if available
  if (writeData.slug) {
    updateData.slug = writeData.slug;
    console.log("Saving generated slug", { slug: writeData.slug });
  }

  // Save generated SEO tags/keywords if available
  if (writeData.tags && writeData.tags.length > 0) {
    updateData.metaKeywords = writeData.tags;
    console.log("Saving generated SEO tags", { tags: writeData.tags });
  }

  // Save cover image data if available
  if (coverImageUrl) {
    updateData.coverImageUrl = coverImageUrl;
    updateData.coverImageAlt = coverImageAlt;
  }

  await db.update(articles).set(updateData).where(eq(articles.id, articleId));

  const generationUpdate: Record<string, unknown> = {
    status: "completed",
    progress: 100,
    completedAt: new Date(),
    draftContent: content,
    updatedAt: new Date(),
  };

  // Only update relatedArticles if writeData has them and they're non-empty
  if (writeData.relatedPosts && writeData.relatedPosts.length > 0) {
    generationUpdate.relatedArticles = writeData.relatedPosts;
    console.log("Updating related articles in generation record", {
      generationId,
      count: writeData.relatedPosts.length,
    });
  } else {
    console.log("Keeping existing related articles in generation record", {
      generationId,
    });
  }

  await db
    .update(articleGeneration)
    .set(generationUpdate)
    .where(eq(articleGeneration.id, generationId));
  // Deduct 1 credit from user after successful generation
  const creditDeducted = await deductCredit(userId);
  if (!creditDeducted) {
    console.error("Failed to deduct credit after successful generation", {
      userId,
      articleId,
    });
  } else {
    console.log("Credit deducted successfully", { userId, articleId });
  }
}

async function handleGenerationError(
  articleId: number,
  generationId: number | null,
  error: Error,
): Promise<void> {
  console.log("Generation failed", error.message);

  try {
    // Get the current article to check its status
    const [currentArticle] = await db
      .select({ status: articles.status })
      .from(articles)
      .where(eq(articles.id, articleId))
      .limit(1);

    if (!currentArticle) {
      console.log("Article not found during error handling", { articleId });
      return;
    }

    // Only reset status if it's currently "generating" to avoid race conditions
    if (currentArticle.status === "generating") {
      await db
        .update(articles)
        .set({
          status: "idea",
          updatedAt: new Date(),
        })
        .where(eq(articles.id, articleId));

      console.log("Reset article status from generating to idea", {
        articleId,
      });
    } else {
      console.log(
        "Article status not reset - current status is not generating",
        {
          articleId,
          currentStatus: currentArticle.status,
        },
      );
    }

    // Update generation record if it exists
    if (generationId) {
      try {
        await db
          .update(articleGeneration)
          .set({
            status: "failed",
            error: error.message,
            errorDetails: {
              timestamp: new Date().toISOString(),
              articleId,
              originalStatus: currentArticle.status,
            },
            updatedAt: new Date(),
          })
          .where(eq(articleGeneration.id, generationId));

        console.log("Updated generation record as failed", { generationId });
      } catch (updateError) {
        console.log("Failed to update generation record", updateError);
      }
    }
  } catch (dbError) {
    console.log("Database error during error handling", dbError);
  }
}

// Main generation orchestration function
async function generateArticle(context: GenerationContext): Promise<void> {
  const { articleId, userId, article, keywords } = context;
  let generationRecord: typeof articleGeneration.$inferSelect | null = null;
  const apiCallsLog: string[] = [];

  try {
    console.log("Starting article generation", {
      articleId,
      title: article.title,
      relatedArticlesCount: context.relatedArticles?.length ?? 0,
    });

    // Create or reuse generation record
    generationRecord = await createOrResetArticleGeneration(articleId, userId);

    if (!generationRecord) {
      throw new Error("Failed to create generation record");
    }

    // Mark article as generating and set generation startedAt now
    await db.update(articles).set({ status: "generating", updatedAt: new Date() }).where(eq(articles.id, articleId));
    await db
      .update(articleGeneration)
      .set({ startedAt: new Date(), updatedAt: new Date() })
      .where(eq(articleGeneration.id, generationRecord.id));

    // Decide how to set related articles on the generation record
    const existingRelated = Array.isArray(generationRecord.relatedArticles)
      ? generationRecord.relatedArticles
      : [];
    const shouldUpdateRelatedArticles =
      (context.relatedArticles?.length ?? 0) > 0 && existingRelated.length === 0;

    if (shouldUpdateRelatedArticles) {
      try {
        await db
          .update(articleGeneration)
          .set({
            relatedArticles: context.relatedArticles,
            updatedAt: new Date(),
          })
          .where(eq(articleGeneration.id, generationRecord.id));

        console.log("Saved new related articles to generation record", {
          generationId: generationRecord.id,
          count: context.relatedArticles.length,
        });
      } catch (e) {
        console.log("Failed to save initial related articles", e);
      }
    } else if (existingRelated.length > 0) {
      // Use existing related articles on the record if present
      context.relatedArticles = existingRelated;
      console.log("Using existing related articles from generation record", {
        generationId: generationRecord.id,
        count: existingRelated.length,
      });
    }

    // Phase 1: Research
    console.log("Starting research phase");
    apiCallsLog.push("research-service");
    const researchData = await performResearch(
      article.title,
      keywords,
      generationRecord.id,
      userId,
      article.projectId,
      article.notes ?? undefined,
    );
    console.log("Research completed", {
      dataLength: researchData?.researchData?.length ?? 0,
    });

    // Phase 3: Image Selection
    console.log("Starting image selection phase");
    apiCallsLog.push("image-selection-service");
    const { coverImageUrl, coverImageAlt } = await selectCoverImage(
      articleId,
      generationRecord.id,
      article.title,
      keywords,
      userId,
      article.projectId,
    );
    console.log("Image selection completed", { coverImageUrl });

    // Phase 4: Writing
    console.log("Starting writing phase");
    apiCallsLog.push("write-service");
    const writeData = await writeArticle(
      researchData, // Pass research data directly instead of outline
      article.title,
      keywords,
      coverImageUrl,
      generationRecord.id,
      userId,
      article.projectId,
      context.relatedArticles,
      researchData.videos,
      article.notes ?? undefined,
    );
    console.log("Writing completed", {
      contentLength: writeData.content?.length ?? 0,
      hasMetaDescription: !!writeData.metaDescription,
    });

    // Phase 5: Quality Control
    console.log("Starting quality control phase");
    // Remove duplicate progress set; writeArticle already set 60 at end
    // await updateGenerationProgress(generationRecord.id, "quality-control", 60);
    apiCallsLog.push("quality-control-service");

    const qualityControlStartTime = Date.now();
    const qualityControlData = await performQualityControl(
      writeData.content ?? "",
      generationRecord.id,
      userId,
      article.projectId,
    );
    const qualityControlProcessingTime = Date.now() - qualityControlStartTime;

    // Log quality control success metrics for monitoring
    console.log("QUALITY_CONTROL_SUCCESS_METRICS", {
      timestamp: new Date().toISOString(),
      generationId: generationRecord.id,
      articleId,
      userId,
      isValid: qualityControlData.isValid,
      hasIssues: !qualityControlData.isValid,
      issuesLength: qualityControlData.issues?.length ?? 0,
      processingTimeMs: qualityControlProcessingTime,
      contentLength: writeData.content?.length ?? 0,
      success: true,
    });

    console.log("Quality control completed", {
      isValid: qualityControlData.isValid,
      hasIssues: !qualityControlData.isValid,
      issuesLength: qualityControlData.issues?.length ?? 0,
      processingTimeMs: qualityControlProcessingTime,
    });

    // Phase 6: Validation
    console.log("Starting validation phase");
    await updateGenerationProgress(generationRecord.id, "validating", 80);
    apiCallsLog.push("validation-service");
    const validationData = await validateArticle(
      writeData.content ?? "",
      generationRecord.id,
    );
    console.log("Validation completed", {
      isValid: validationData.isValid,
      issuesCount: validationData.issues?.length ?? 0,
    });

    // Phase 7: Update (if needed)
    console.log("Starting update phase");
    await updateGenerationProgress(generationRecord.id, "updating", 95);
    const finalContent = await updateArticleIfNeeded(
      writeData.content ?? "",
      validationData.rawValidationText ?? "",
      qualityControlData.issues,
    );

    // Log update service call if it was actually called
    const hasValidationIssues =
      validationData.rawValidationText &&
      !validationData.rawValidationText.includes(
        "No factual issues identified",
      ) &&
      !validationData.rawValidationText
        .toLowerCase()
        .includes("validation skipped");
    const hasQualityControlIssues =
      qualityControlData.issues !== null && qualityControlData.issues !== undefined;

    if (hasValidationIssues || hasQualityControlIssues) {
      apiCallsLog.push("update-service");
    }

    console.log("Update completed", {
      contentUpdated: finalContent !== writeData.content,
      finalContentLength: finalContent.length,
      hadValidationIssues: hasValidationIssues,
      hadQualityControlIssues: hasQualityControlIssues,
    });

    // Phase 8: Finalize
    await finalizeArticle(
      articleId,
      writeData,
      finalContent,
      coverImageUrl,
      coverImageAlt,
      generationRecord.id,
      userId,
      researchData.videos, // Pass videos to finalize function
    );

    console.log("Generation completed successfully", {
      finalContentLength: finalContent.length,
      hasCoverImage: !!coverImageUrl,
      hasSlug: !!writeData.slug,
      hasMetaDescription: !!writeData.metaDescription,
      tagsCount: writeData.tags?.length ?? 0,
    });

    apiCallsLog.forEach((api) => console.log(`-> ${api}`));
  } catch (error) {
    await handleGenerationError(
      articleId,
      generationRecord?.id ?? null,
      error instanceof Error ? error : new Error(String(error)),
    );
    throw error;
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" } as ApiResponse,
        { status: 401 },
      );
    }

    const body = (await req.json()) as ArticleGenerationRequest;
    const { articleId, forceRegenerate } = body;

    // Validate request and setup generation context
    const context = await validateAndSetupGeneration(
      userId,
      articleId,
      forceRegenerate,
    );

    // Run generation in background
    waitUntil(generateArticle(context));

    return NextResponse.json({
      success: true,
      data: {
        message: "Article generation started",
        articleId: articleId,
        relatedArticles: context.relatedArticles,
      },
    } as ApiResponse);
  } catch (error) {
    await logServerError(error, { operation: "generate_article" });
    return NextResponse.json(
      {
        success: false,
        error: "Error generating article. Please try again.",
      } as ApiResponse,
      { status: 500 },
    );
  }
}
