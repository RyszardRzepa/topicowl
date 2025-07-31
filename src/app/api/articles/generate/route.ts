import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { auth } from "@clerk/nextjs/server";
import type { ApiResponse } from "@/types";
import { API_BASE_URL } from "@/constants";
import { fetcher } from "@/lib/utils";
import { db } from "@/server/db";
import { articles, articleGeneration, users } from "@/server/db/schema";
import { eq, desc } from "drizzle-orm";
import type { ResearchResponse } from "@/app/api/articles/research/route";
import type { OutlineResponse } from "@/app/api/articles/outline/route";
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

  return {
    articleId: id,
    userId: userRecord.id,
    article: existingArticle,
    keywords: keywords.length > 0 ? keywords : [existingArticle.title],
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
): Promise<ResearchResponse> {
  await updateGenerationProgress(generationId, "researching", 10);

  console.log("Calling research API", { title, keywords });

  const researchData = await fetcher<ResearchResponse>(
    `${API_BASE_URL}/api/articles/research`,
    {
      method: "POST",
      body: { title, keywords },
      timeout: 10 * 60 * 1000, // 10 minutes for research operations
    },
  );

  console.log("Research API response", {
    hasResearchData: !!researchData.researchData,
    sourcesCount: researchData.sources?.length ?? 0,
    dataLength: researchData.researchData?.length ?? 0,
  });

  await updateGenerationProgress(generationId, "researching", 25, {
    researchData: researchData.researchData ?? {},
  });

  return researchData;
}

async function createOutline(
  title: string,
  keywords: string[],
  researchData: string,
  generationId: number,
): Promise<OutlineResponse> {
  const outlineResult = await fetcher<ApiResponse<OutlineResponse>>(
    `${API_BASE_URL}/api/articles/outline`,
    {
      method: "POST",
      body: { title, keywords, researchData },
    },
  );

  if (!outlineResult.success) {
    throw new Error(outlineResult.error ?? "Outline API call failed");
  }

  const outlineData = outlineResult.data!;
  await updateGenerationProgress(generationId, "outlining", 40);

  return outlineData;
}

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
  outlineData: OutlineResponse,
  title: string,
  keywords: string[],
  coverImageUrl: string,
  generationId: number,
): Promise<WriteResponse> {
  await updateGenerationProgress(generationId, "writing", 55);

  const writeRequestBody: {
    outlineData: OutlineResponse;
    title: string;
    keywords: string[];
    coverImage?: string;
  } = { outlineData, title, keywords };

  if (coverImageUrl) {
    writeRequestBody.coverImage = coverImageUrl;
  }

  console.log("Calling write API", {
    title,
    keywordsCount: keywords.length,
    hasCoverImage: !!coverImageUrl,
  });

  const writeData = await fetcher<WriteResponse>(
    `${API_BASE_URL}/api/articles/write`,
    {
      method: "POST",
      body: writeRequestBody,
      timeout: 8 * 60 * 1000, // 8 minutes for writing operations
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

  const validationData = await fetcher<ValidateResponse>(
    `${API_BASE_URL}/api/articles/validate`,
    {
      method: "POST",
      body: { article: content },
      timeout: 6 * 60 * 1000, // 6 minutes for validation operations
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
}

async function updateArticleIfNeeded(
  content: string,
  validationText: string,
): Promise<string> {
  if (validationText.includes("No factual issues identified")) {
    return content;
  }

  const updateResult = await fetcher<ApiResponse<UpdateResponse>>(
    `${API_BASE_URL}/api/articles/update`,
    {
      method: "POST",
      body: { article: content, validationText },
    },
  );

  if (!updateResult.success) {
    throw new Error(updateResult.error ?? "Update API call failed");
  }

  return updateResult.data!.updatedContent ?? content;
}

async function finalizeArticle(
  articleId: number,
  writeData: WriteResponse,
  content: string,
  coverImageUrl: string,
  coverImageAlt: string,
  generationId: number,
): Promise<void> {
  const updateData: {
    draft: string;
    slug?: string;
    metaDescription: string;
    metaKeywords?: string[];
    status: "wait_for_publish";
    updatedAt: Date;
    coverImageUrl?: string;
    coverImageAlt?: string;
  } = {
    draft: content,
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
  });

  await db.update(articles).set(updateData).where(eq(articles.id, articleId));

  await db
    .update(articleGeneration)
    .set({
      status: "completed",
      progress: 100,
      completedAt: new Date(),
      draftContent: content,
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
    const researchData = await performResearch(
      article.title,
      keywords,
      generationRecord.id,
    );
    console.log("Research completed", {
      dataLength: researchData?.researchData?.length ?? 0,
    });

    // Phase 2: Outline
    console.log("Starting outline phase");
    const outlineData = await createOutline(
      article.title,
      keywords,
      researchData.researchData ?? "",
      generationRecord.id,
    );
    console.log("Outline completed", {
      keyPointsCount: outlineData?.keyPoints?.length ?? 0,
      totalWords: outlineData?.totalWords ?? 0,
    });

    // Phase 3: Image Selection
    console.log("Starting image selection phase");
    const { coverImageUrl, coverImageAlt } = await selectCoverImage(
      articleId,
      generationRecord.id,
      article.title,
      keywords,
    );
    console.log("Image selection completed", { coverImageUrl });

    // Phase 4: Writing
    console.log("Starting writing phase");
    const writeData = await writeArticle(
      outlineData,
      article.title,
      keywords,
      coverImageUrl,
      generationRecord.id,
    );
    console.log("Writing completed", {
      contentLength: writeData.content?.length ?? 0,
      hasMetaDescription: !!writeData.metaDescription,
    });

    // Phase 5: Validation
    console.log("Starting validation phase");
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
    );

    console.log("Generation completed successfully", {
      finalContentLength: finalContent.length,
      hasCoverImage: !!coverImageUrl,
      hasSlug: !!writeData.slug,
      hasMetaDescription: !!writeData.metaDescription,
      tagsCount: writeData.tags?.length ?? 0,
    });
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
