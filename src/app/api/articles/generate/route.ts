import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { auth } from "@clerk/nextjs/server";
import type { ApiResponse, VideoEmbed } from "@/types";
import { API_BASE_URL } from "@/constants";
import { fetcher } from "@/lib/utils";
import { getUserExcludedDomains } from "@/lib/utils/article-generation";
import { getRelatedArticles } from "@/lib/utils/related-articles";
import { db } from "@/server/db";
import { articles, articleGeneration, users } from "@/server/db/schema";
import { eq, desc } from "drizzle-orm";
import type { ResearchResponse } from "@/app/api/articles/research/route";
import type { WriteResponse } from "@/app/api/articles/write/route";
import type { ValidateResponse } from "@/app/api/articles/validate/route";
import type { UpdateResponse } from "@/app/api/articles/update/route";
import type { ArticleImageSelectionResponse } from "@/app/api/articles/images/select-for-article/route";

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
  // Get user record from database
  const [userRecord] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerk_user_id, userId))
    .limit(1);

  if (!userRecord) {
    throw new Error("User not found");
  }

  if (!articleId || isNaN(parseInt(articleId))) {
    throw new Error("Invalid article ID");
  }

  const id = parseInt(articleId);

  // Check if article exists and belongs to the current user
  const [existingArticle] = await db
    .select()
    .from(articles)
    .where(eq(articles.id, id));

  if (!existingArticle) {
    throw new Error("Article not found");
  }

  // Verify article ownership
  if (existingArticle.user_id !== userRecord.id) {
    throw new Error("Access denied: Article does not belong to current user");
  }

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

  // Update article status to generating
  console.log("Updating article status to generating", { articleId: id });
  await db
    .update(articles)
    .set({
      status: "generating",
      updatedAt: new Date(),
    })
    .where(eq(articles.id, id));

  const keywords = Array.isArray(existingArticle.keywords)
    ? (existingArticle.keywords as string[])
    : [];

  // Generate related articles early so we can include them in the immediate response
  const relatedArticles = await getRelatedArticles(userRecord.id, existingArticle.title, keywords);

  return {
    articleId: id,
    userId: userRecord.id,
    article: existingArticle,
    keywords: keywords.length > 0 ? keywords : [existingArticle.title],
    relatedArticles,
  };
}

// Generation phase functions
async function createOrReuseGenerationRecord(
  articleId: number,
  userId: string,
): Promise<typeof articleGeneration.$inferSelect> {
  // First, check if there's an existing generation record for this article
  const [existingRecord] = await db
    .select()
    .from(articleGeneration)
    .where(eq(articleGeneration.articleId, articleId))
    .orderBy(desc(articleGeneration.createdAt))
    .limit(1);

  if (existingRecord) {
    console.log("Reusing existing generation record", {
      generationId: existingRecord.id,
      currentStatus: existingRecord.status,
    });

    // Reset the existing record for a new generation attempt
    const [updatedRecord] = await db
      .update(articleGeneration)
      .set({
        status: "pending",
        progress: 0,
        startedAt: new Date(),
        completedAt: null,
        error: null,
        errorDetails: null,
        draftContent: null,
        validationReport: "",
        researchData: {},
        seoReport: {},
        imageKeywords: [],
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
      status: "pending",
      progress: 0,
      startedAt: new Date(),
      validationReport: "",
      researchData: {},
      seoReport: {},
      imageKeywords: [],
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
  notes?: string,
): Promise<ResearchResponse> {
  await updateGenerationProgress(generationId, "researching", 10);

  console.log("Calling research API", { title, keywords, hasNotes: !!notes });

  // Get the Clerk user ID to retrieve excluded domains
  const { userId: clerkUserId } = await auth();
  const excludedDomains = clerkUserId ? await getUserExcludedDomains(clerkUserId) : [];

  const researchData = await fetcher<ResearchResponse>(
    `${API_BASE_URL}/api/articles/research`,
    {
      method: "POST",
      body: {
        title,
        keywords,
        notes,
        excludedDomains,
      },
    },
  );

  console.log("Research API response", {
    hasResearchData: !!researchData.researchData,
    sourcesCount: researchData.sources?.length ?? 0,
    dataLength: researchData.researchData?.length ?? 0,
  });

  await updateGenerationProgress(generationId, "researching", 25, {
    researchData: researchData,
  });

  return researchData;
}

// COMMENTED OUT - OUTLINE GENERATION SKIPPED
// async function createOutline(
//   title: string,
//   keywords: string[],
//   researchData: string,
//   sources: Array<{ url: string; title?: string }>,
//   generationId: number,
//   userId: string,
//   videos?: Array<{ title: string; url: string }>,
//   notes?: string,
// ): Promise<string> {
//   console.log("Calling outline API", { title, keywords });

//   // Get excluded domains for the user
//   const excludedDomains = await getUserExcludedDomains(userId);

//   const outlineResult = await fetcher<ApiResponse<string>>(
//     `${API_BASE_URL}/api/articles/outline`,
//     {
//       method: "POST",
//       body: {
//         title,
//         keywords,
//         researchData,
//         sources,
//         videos,
//         notes,
//         userId, // Pass the clerk user ID
//         excludedDomains, // Pass excluded domains so outline API doesn't need to fetch them
//       },
//     },
//   );

//   if (!outlineResult.success || !outlineResult.data) {
//     throw new Error("Failed to generate outline");
//   }

//   const outlineData = outlineResult.data;

//   await db
//     .update(articleGeneration)
//     .set({ outline: outlineData, status: "outlining", progress: 40 })
//     .where(eq(articleGeneration.id, generationId));

//   return outlineData;
// }

async function selectCoverImage(
  articleId: number,
  generationId: number,
  title: string,
  keywords: string[],
): Promise<{ coverImageUrl: string; coverImageAlt: string }> {
  try {
    console.log("Calling image selection API", {
      articleId,
      generationId,
      title,
      keywordsCount: keywords.length,
    });

    const imageResult = await fetcher<ArticleImageSelectionResponse>(
      `${API_BASE_URL}/api/articles/images/select-for-article`,
      {
        method: "POST",
        body: {
          articleId,
          generationId,
          title,
          keywords,
          orientation: "landscape",
        },
      },
    );

    console.log("Image selection API response", {
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
  researchData: ResearchResponse, // Changed from OutlineResponse to ResearchResponse
  title: string,
  keywords: string[],
  coverImageUrl: string,
  generationId: number,
  userId: string,
  relatedArticles: string[], // Pass pre-generated related articles
  videos?: Array<{ title: string; url: string }>,
): Promise<WriteResponse> {
  await updateGenerationProgress(generationId, "writing", 55);

  console.log("Calling write API", {
    title,
    keywordsCount: keywords.length,
    hasCoverImage: !!coverImageUrl,
    videosCount: videos?.length ?? 0,
  });

  const writeData = await fetcher<WriteResponse>(
    `${API_BASE_URL}/api/articles/write`,
    {
      method: "POST",
      body: {
        researchData: researchData, // Pass research data instead of outline
        title,
        keywords,
        coverImage: coverImageUrl || undefined,
        videos,
        userId,
        relatedArticles,
        generationId // Pass the generationId to save the write prompt
      },
    },
  );

  console.log("Write API response", {
    contentLength: writeData.content?.length ?? 0,
    hasMetaDescription: !!writeData.metaDescription,
    hasSlug: !!writeData.slug,
    tagsCount: writeData.tags?.length ?? 0,
  });

  await updateGenerationProgress(generationId, "validating", 70, {
    draftContent: writeData.content ?? "",
  });

  return writeData;
}

async function validateArticle(
  content: string,
  generationId: number,
): Promise<ValidateResponse> {
  console.log("Calling validate API", {
    contentLength: content.length,
  });

  try {
    const validationData = await fetcher<ValidateResponse>(
      `${API_BASE_URL}/api/articles/validate`,
      {
        method: "POST",
        body: {
          content,
        },
        timeout: 10 * 60 * 1000, // 10 minutes timeout for validation
      },
    );

    console.log("Validate API response", {
      isValid: validationData.isValid,
      issuesCount: validationData.issues?.length ?? 0,
      hasRawText: !!validationData.rawValidationText,
    });

    await updateGenerationProgress(generationId, "updating", 90, {
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
): Promise<string> {
  if (validationText.includes("No factual issues identified")) {
    return content;
  }

  console.log("Calling update API");

  const updateResult = await fetcher<UpdateResponse>(
    `${API_BASE_URL}/api/articles/update`,
    {
      method: "POST",
      body: {
        article: content,
        validationText,
      },
    },
  );

  return updateResult.updatedContent ?? content;
}

async function finalizeArticle(
  articleId: number,
  writeData: WriteResponse,
  content: string,
  coverImageUrl: string,
  coverImageAlt: string,
  generationId: number,
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

  console.log("Finalizing article with SEO data", {
    articleId,
    hasSlug: !!updateData.slug,
    hasMetaDescription: !!updateData.metaDescription,
    metaKeywordsCount: updateData.metaKeywords?.length ?? 0,
    hasCoverImage: !!coverImageUrl,
    draftContentLength: updateData.draft.length,
    draftContentWordCount: updateData.draft.split(/\s+/).filter(word => word.length > 0).length,
    draftContentPreview: updateData.draft.substring(0, 200) + "...",
  });

  await db.update(articles).set(updateData).where(eq(articles.id, articleId));

  await db
    .update(articleGeneration)
    .set({
      status: "completed",
      progress: 100,
      completedAt: new Date(),
      draftContent: content,
      relatedArticles: writeData.relatedPosts ?? [],
      updatedAt: new Date(),
    })
    .where(eq(articleGeneration.id, generationId));
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
    });

    // Create or reuse generation record
    generationRecord = await createOrReuseGenerationRecord(articleId, userId);
    console.log("Created generation record", {
      generationId: generationRecord.id,
    });

    // Phase 1: Research
    console.log("Starting research phase");
    apiCallsLog.push("/research");
    const researchData = await performResearch(
      article.title,
      keywords,
      generationRecord.id,
      userId,
      article.notes ?? undefined,
    );
    console.log("Research completed", {
      dataLength: researchData?.researchData?.length ?? 0,
    });

    // Phase 2: Outline (COMMENTED OUT - SKIPPED)
    // console.log("Starting outline phase");
    // apiCallsLog.push("/outline");
    // const outlineData = await createOutline(
    //   article.title,
    //   keywords,
    //   researchData.researchData ?? "",
    //   researchData.sources ?? [],
    //   generationRecord.id,
    //   userId,
    //   researchData.videos,
    //   article.notes ?? undefined,
    // );
    // console.log("Outline completed", {
    //   outlineLength: outlineData?.length ?? 0,
    // });

    // Phase 3: Image Selection
    console.log("Starting image selection phase");
    apiCallsLog.push("/images/select-for-article");
    const { coverImageUrl, coverImageAlt } = await selectCoverImage(
      articleId,
      generationRecord.id,
      article.title,
      keywords,
    );
    console.log("Image selection completed", { coverImageUrl });

    // Phase 4: Writing
    console.log("Starting writing phase");
    apiCallsLog.push("/write");
    const writeData = await writeArticle(
      researchData, // Pass research data directly instead of outline
      article.title,
      keywords,
      coverImageUrl,
      generationRecord.id,
      userId,
      context.relatedArticles,
      researchData.videos,
    );
    console.log("Writing completed", {
      contentLength: writeData.content?.length ?? 0,
      hasMetaDescription: !!writeData.metaDescription,
    });

    // Phase 5: Validation
    console.log("Starting validation phase");
    apiCallsLog.push("/validate");
    const validationData = await validateArticle(
      writeData.content ?? "",
      generationRecord.id,
    );
    console.log("Validation completed", {
      isValid: validationData.isValid,
      issuesCount: validationData.issues?.length ?? 0,
    });

    // Phase 6: Update (if needed)
    console.log("Starting update phase");
    const finalContent = await updateArticleIfNeeded(
      writeData.content ?? "",
      validationData.rawValidationText ?? "",
    );
    
    // Only log update API call if it was actually called
    if (!(validationData.rawValidationText ?? "").includes("No factual issues identified")) {
      apiCallsLog.push("/update");
    }
    console.log("Update completed", {
      contentUpdated: finalContent !== writeData.content,
      finalContentLength: finalContent.length,
    });

    // Phase 7: Finalize
    await finalizeArticle(
      articleId,
      writeData,
      finalContent,
      coverImageUrl,
      coverImageAlt,
      generationRecord.id,
      researchData.videos, // Pass videos to finalize function
    );

    console.log("Generation completed successfully", {
      finalContentLength: finalContent.length,
      hasCoverImage: !!coverImageUrl,
      hasSlug: !!writeData.slug,
      hasMetaDescription: !!writeData.metaDescription,
      tagsCount: writeData.tags?.length ?? 0,
    });

    apiCallsLog.forEach(api => console.log(`-> ${api}`));
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

    console.log("userId!!!", userId);
    if (!userId) {
      console.log("Unauthorized request - no user ID");
      return NextResponse.json(
        { success: false, error: "Unauthorized" } as ApiResponse,
        { status: 401 },
      );
    }

    const body = (await req.json()) as ArticleGenerationRequest;
    const { articleId, forceRegenerate } = body;

    console.log("Generate API request received", {
      articleId,
      forceRegenerate,
      userId,
    });

    // Validate request and setup generation context
    const context = await validateAndSetupGeneration(
      userId,
      articleId,
      forceRegenerate,
    );

    console.log("Starting background generation process", {
      articleTitle: context.article.title,
      currentStatus: context.article.status,
    });

    // Use waitUntil to run generation in background
    waitUntil(generateArticle(context));

    console.log("Generation request processed successfully");
    return NextResponse.json({
      success: true,
      data: {
        message: "Article generation started",
        articleId: articleId,
        relatedArticles: context.relatedArticles,
      },
    } as ApiResponse);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.log("Generate article API error", errorMessage);

    // Map specific errors to appropriate HTTP status codes
    let status = 500;
    if (errorMessage.includes("User not found")) {
      status = 404;
    } else if (errorMessage.includes("Invalid article ID")) {
      status = 400;
    } else if (errorMessage.includes("Article not found")) {
      status = 404;
    } else if (errorMessage.includes("Access denied")) {
      status = 403;
    } else if (errorMessage.includes("already in progress")) {
      status = 409;
    }

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      } as ApiResponse,
      { status },
    );
  }
}
