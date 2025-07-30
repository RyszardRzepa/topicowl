import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import type { ApiResponse } from "@/types";
import { db } from "@/server/db";
import { articles, articleGeneration, users } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import type { ResearchResponse } from "@/app/api/articles/research/route";
import type { WriteResponse } from "@/app/api/articles/write/route";
import type { ValidateResponse } from "@/app/api/articles/validate/route";
import type { UpdateResponse } from "@/app/api/articles/update/route";

// Types colocated with this API route
export interface ArticleGenerationRequest {
  articleId: string;
  forceRegenerate?: boolean;
}

// Helper function to make internal API calls
async function callInternalAPI<T>(
  endpoint: string,
  method: string,
  body?: unknown,
): Promise<T> {
  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000";

  const response = await fetch(`${baseUrl}/api/articles${endpoint}`, {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API call failed: ${response.status} ${errorText}`);
  }

  const result = await response.json() as ApiResponse<T>;
  if (!result.success) {
    throw new Error(result.error ?? "API call failed");
  }

  return result.data as T;
}

// Article generation function - orchestrates existing API endpoints
async function generateArticleContentInline(articleId: string) {
  console.log("Starting article generation for article:", articleId);
  let generationRecord: typeof articleGeneration.$inferSelect | null = null;

  try {
    // Get article from database
    const [article] = await db
      .select()
      .from(articles)
      .where(eq(articles.id, parseInt(articleId)));

    if (!article) {
      console.error("Article not found in database:", articleId);
      throw new Error("Article not found");
    }

    console.log("Found article:", article.title);

    // Create generation record
    if (!article.user_id) {
      throw new Error(
        "Article missing user_id - this should not happen with proper authentication",
      );
    }

    try {
      const result = await db
        .insert(articleGeneration)
        .values({
          articleId: article.id,
          userId: article.user_id,
          status: "pending",
          progress: 0,
          startedAt: new Date(),
        })
        .returning();

      generationRecord = result[0] ?? null;
      console.log("Created generation record:", generationRecord?.id);
    } catch (error) {
      console.error("Failed to create generation record:", error);
      throw new Error("Failed to create generation record");
    }

    if (!generationRecord) {
      throw new Error(
        "Failed to create generation record - no record returned",
      );
    }

    // Update status to generating
    await db
      .update(articles)
      .set({ status: "generating", updatedAt: new Date() })
      .where(eq(articles.id, parseInt(articleId)));

    console.log("Updated article status to generating");

    // Update generation record to researching phase
    await db
      .update(articleGeneration)
      .set({
        status: "researching",
        progress: 10,
        updatedAt: new Date(),
      })
      .where(eq(articleGeneration.id, generationRecord.id));

    // STEP 1: Research Phase - Call research API endpoint
    const keywords = Array.isArray(article.keywords)
      ? (article.keywords as string[])
      : [];

    console.log("Calling research API endpoint");
    const researchData = await callInternalAPI<ResearchResponse>(
      "/research",
      "POST",
      {
        title: article.title,
        keywords: keywords.length > 0 ? keywords : [article.title],
      },
    );

    console.log(
      "Research completed, data length:",
      researchData?.researchData?.length ?? 0,
    );

    // Update generation record with research results
    await db
      .update(articleGeneration)
      .set({
        status: "researching",
        progress: 35,
        researchData: researchData.researchData || {},
        updatedAt: new Date(),
      })
      .where(eq(articleGeneration.id, generationRecord.id));

    // STEP 2: Image Selection Phase (skip for now)
    const coverImageUrl = "";
    console.log("Skipping image selection for now");

    // Update generation record to writing phase
    await db
      .update(articleGeneration)
      .set({
        status: "writing",
        progress: 50,
        updatedAt: new Date(),
      })
      .where(eq(articleGeneration.id, generationRecord.id));

    // STEP 3: Writing Phase - Call write API endpoint
    console.log("Calling write API endpoint");
    const writeData = await callInternalAPI<WriteResponse>("/write", "POST", {
      researchData: researchData.researchData ?? "",
      title: article.title,
      keywords: keywords.length > 0 ? keywords : [article.title],
      ...(coverImageUrl && { coverImage: coverImageUrl }),
    });

    console.log(
      "Writing completed, content length:",
      writeData.content?.length ?? 0,
    );

    // Update generation record with writing results
    await db
      .update(articleGeneration)
      .set({
        status: "validating",
        progress: 70,
        draftContent: writeData.content || "",
        updatedAt: new Date(),
      })
      .where(eq(articleGeneration.id, generationRecord.id));

    // STEP 4: Validation Phase - Call validate API endpoint
    console.log("Calling validation API endpoint");
    const validationData = await callInternalAPI<ValidateResponse>(
      "/validate",
      "POST",
      {
        article: writeData.content ?? "",
      },
    );

    // Update generation record with validation results
    await db
      .update(articleGeneration)
      .set({
        status: "updating",
        progress: 90,
        validationReport: validationData || {},
        updatedAt: new Date(),
      })
      .where(eq(articleGeneration.id, generationRecord.id));

    // STEP 5: Update Phase - Call update API endpoint if needed
    let finalContent = writeData.content ?? "";
    const finalMetaDescription = writeData.metaDescription ?? "";

    // If validation found significant issues, call update endpoint
    if (
      !validationData.isValid &&
      validationData.issues?.some(
        (issue) => issue.severity === "high" || issue.severity === "medium",
      )
    ) {
      console.log("Validation found issues, calling update API endpoint");

      const updateData = await callInternalAPI<UpdateResponse>(
        "/update",
        "POST",
        {
          article: writeData.content ?? "",
          corrections: validationData.issues,
        },
      );

      finalContent = updateData.updatedContent ?? finalContent;
    }

    // Save generated content
    await db
      .update(articles)
      .set({
        draft: finalContent,
        metaDescription: finalMetaDescription,
        status: "wait_for_publish", // Ready for review/publishing
        updatedAt: new Date(),
      })
      .where(eq(articles.id, parseInt(articleId)));

    // Update generation record as completed
    try {
      await db
        .update(articleGeneration)
        .set({
          status: "completed",
          progress: 100,
          completedAt: new Date(),
          draftContent: finalContent,
          updatedAt: new Date(),
        })
        .where(eq(articleGeneration.id, generationRecord.id));
    } catch (error) {
      console.error("Failed to update generation record:", error);
    }

    console.log("Generation completed successfully for article:", articleId);
  } catch (error) {
    console.error("Generation error:", error);

    // Update article status to failed
    await db
      .update(articles)
      .set({
        status: "idea", // Reset to idea status
        updatedAt: new Date(),
      })
      .where(eq(articles.id, parseInt(articleId)));

    // Update generation record as failed if it exists
    if (generationRecord) {
      try {
        await db
          .update(articleGeneration)
          .set({
            status: "failed",
            error:
              error instanceof Error ? error.message : "Unknown error occurred",
            errorDetails: { timestamp: new Date().toISOString() },
            updatedAt: new Date(),
          })
          .where(eq(articleGeneration.id, generationRecord.id));
      } catch (updateError) {
        console.error("Failed to update generation record:", updateError);
      }
    }
  }
}

export async function POST(req: NextRequest) {
  try {
    // Get current user from Clerk
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" } as ApiResponse,
        { status: 401 },
      );
    }

    // Get user record from database
    const [userRecord] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerk_user_id, userId))
      .limit(1);

    if (!userRecord) {
      return NextResponse.json(
        { success: false, error: "User not found" } as ApiResponse,
        { status: 404 },
      );
    }

    const body = (await req.json()) as ArticleGenerationRequest;
    const { articleId, forceRegenerate } = body;

    console.log(
      "Generate API called for article ID:",
      articleId,
      "by user:",
      userRecord.id,
    );

    if (!articleId || isNaN(parseInt(articleId))) {
      console.error("Invalid article ID received:", articleId);
      return NextResponse.json(
        { success: false, error: "Invalid article ID" } as ApiResponse,
        { status: 400 },
      );
    }

    const id = parseInt(articleId);

    // Check if article exists and belongs to the current user
    const [existingArticle] = await db
      .select()
      .from(articles)
      .where(eq(articles.id, id));

    if (!existingArticle) {
      return NextResponse.json(
        { success: false, error: "Article not found" } as ApiResponse,
        { status: 404 },
      );
    }

    // Verify article ownership
    if (existingArticle.user_id !== userRecord.id) {
      return NextResponse.json(
        {
          success: false,
          error: "Access denied: Article does not belong to current user",
        } as ApiResponse,
        { status: 403 },
      );
    }

    // Check if article is already being generated (unless force regenerate)
    if (existingArticle.status === "generating" && !forceRegenerate) {
      return NextResponse.json(
        {
          success: false,
          error: "Article generation already in progress",
        } as ApiResponse,
        { status: 409 },
      );
    }

    // Update article status to generating
    await db
      .update(articles)
      .set({
        status: "generating",
        updatedAt: new Date(),
      })
      .where(eq(articles.id, id));

    console.log(
      "Starting background generation process for article:",
      articleId,
    );

    // Start generation process (runs in background)
    generateArticleContentInline(articleId).catch((error) => {
      console.error("Background generation failed:", error);
    });

    console.log("Returning success response for article:", articleId);
    return NextResponse.json({
      success: true,
      data: {
        message: "Article generation started",
        articleId: articleId,
      },
    } as ApiResponse);
  } catch (error) {
    console.error("Generate article error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to start article generation",
      } as ApiResponse,
      { status: 500 },
    );
  }
}
