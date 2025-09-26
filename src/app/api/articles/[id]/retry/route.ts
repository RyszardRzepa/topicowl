import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import {
  articles,
  users,
  articleGenerations,
  projects,
} from "@/server/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
import { continueGenerationFromPhase } from "@/lib/services/article-generation";
import type { ArticleGenerationArtifacts } from "@/types";
import type { ArticleGenerationStatus } from "@/types";

// API types for this endpoint
export interface RetryResponse {
  success: boolean;
  article?: {
    id: number;
    title: string;
    status: string;
    updatedAt: Date;
  };
  message?: string;
  error?: string;
  debugInfo?: {
    failedPhase: ArticleGenerationStatus;
    restartPhase: ArticleGenerationStatus;
    availableArtifacts: string[];
    reasoning: string;
  };
}

/**
 * Intelligently determines where to restart generation based on:
 * 1. What artifacts are available (indicating successful completion of phases)
 * 2. The last known status when failure occurred
 * 3. Dependencies between phases
 */
function determineRestartPhase(
  failedStatus: ArticleGenerationStatus,
  artifacts: ArticleGenerationArtifacts,
): {
  restartPhase: ArticleGenerationStatus;
  reasoning: string;
  availableArtifacts: string[];
} {
  const availableArtifacts: string[] = [];
  
  // Check what artifacts/phases are available
  if (artifacts.research?.researchData ?? artifacts.research?.sources) {
    availableArtifacts.push("research");
  }
  if (artifacts.coverImage?.imageUrl) {
    availableArtifacts.push("image");
  }
  if (artifacts.write?.content) {  // Only count as available if actual content exists
    availableArtifacts.push("writing");
  }
  if (artifacts.qualityControl?.report) {
    availableArtifacts.push("quality-control");
  }
  if (artifacts.validation?.rawValidationText) {
    availableArtifacts.push("validation");
  }

  // Determine restart phase based on failure point and available data
  if (failedStatus === "research" || !availableArtifacts.includes("research")) {
    return {
      restartPhase: "research",
      reasoning: "Research phase failed or no research data available. Starting from research.",
      availableArtifacts,
    };
  }

  if (failedStatus === "image" || !availableArtifacts.includes("image")) {
    // Can restart from image selection if we have research data
    return {
      restartPhase: "image",
      reasoning: "Image selection phase failed or no cover image data available. Restarting from image selection with preserved research data.",
      availableArtifacts,
    };
  }

  if (failedStatus === "writing" || !availableArtifacts.includes("writing")) {
    // Can restart from writing if we have research and image data
    return {
      restartPhase: "writing",
      reasoning: "Writing phase failed or no written content available. Restarting from writing with preserved research and image data.",
      availableArtifacts,
    };
  }

  if (failedStatus === "quality-control") {
    // Restart from quality control - we have the content, just need to re-assess quality
    return {
      restartPhase: "quality-control",
      reasoning: "Quality control phase failed. Restarting quality assessment with existing content.",
      availableArtifacts,
    };
  }

  if (failedStatus === "validating") {
    // Restart from validation - we have content and quality control, just need to re-validate
    return {
      restartPhase: "validating",
      reasoning: "Validation phase failed. Restarting content validation with existing content.",
      availableArtifacts,
    };
  }

  if (failedStatus === "updating") {
    // If updating failed, we might want to restart from quality control or validation
    // depending on what caused the update to fail
    return {
      restartPhase: "quality-control",
      reasoning: "Content update phase failed. Restarting from quality control to reassess and potentially update content.",
      availableArtifacts,
    };
  }

  // For terminal states or unknown states, make intelligent decisions
  if (failedStatus === "failed" || failedStatus === "completed") {
    // Check if validation was likely the failure point
    if (artifacts.qualityControl?.report && !availableArtifacts.includes("validation")) {
      return {
        restartPhase: "validating",
        reasoning: "Generation failed after quality control but before validation artifacts were created. Restarting from validation phase.",
        availableArtifacts,
      };
    }

    // Look at what we have and restart from the most advanced safe point
    if (availableArtifacts.includes("writing") && availableArtifacts.includes("research")) {
      return {
        restartPhase: "quality-control",
        reasoning: "Generation failed but content and research data are available. Restarting from quality control.",
        availableArtifacts,
      };
    }

    if (availableArtifacts.includes("research")) {
      return {
        restartPhase: "writing",
        reasoning: "Generation failed but research data is available. Restarting from writing phase.",
        availableArtifacts,
      };
    }

    return {
      restartPhase: "research",
      reasoning: "Generation failed and minimal artifacts available. Starting fresh from research.",
      availableArtifacts,
    };
  }

  // Default fallback - restart from the failed phase
  return {
    restartPhase: failedStatus,
    reasoning: `Restarting from the failed phase: ${failedStatus}`,
    availableArtifacts,
  };
}

// POST /api/articles/[id]/retry - Retry failed article generation from last successful phase
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // 1. Authenticate user with Clerk
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" } as RetryResponse,
        { status: 401 },
      );
    }

    // 2. Verify user exists in database
    const [userRecord] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!userRecord) {
      return NextResponse.json(
        { success: false, error: "User not found" } as RetryResponse,
        { status: 404 },
      );
    }

    const { id } = await params;
    const articleId = parseInt(id);
    if (isNaN(articleId)) {
      return NextResponse.json(
        { success: false, error: "Invalid article ID" } as RetryResponse,
        { status: 400 },
      );
    }

    // 3. Verify article exists and user has access to it
    const [articleResult] = await db
      .select()
      .from(articles)
      .innerJoin(projects, eq(articles.projectId, projects.id))
      .where(
        and(eq(articles.id, articleId), eq(projects.userId, userRecord.id)),
      )
      .limit(1);

    if (!articleResult) {
      return NextResponse.json(
        {
          success: false,
          error: "Article not found or access denied",
        } as RetryResponse,
        { status: 404 },
      );
    }

    const existingArticle = articleResult.articles;

    // Check if article is failed and can be retried
    if (existingArticle.status !== "failed") {
      return NextResponse.json(
        {
          success: false,
          error: "Article is not in failed state and cannot be retried",
        } as RetryResponse,
        { status: 400 },
      );
    }

    // Get the most recent generation record to determine where to restart from
    const [generationRecord] = await db
      .select()
      .from(articleGenerations)
      .where(eq(articleGenerations.articleId, articleId))
      .orderBy(desc(articleGenerations.createdAt))
      .limit(1);

    if (!generationRecord) {
      return NextResponse.json(
        {
          success: false,
          error: "No generation record found for this article",
        } as RetryResponse,
        { status: 404 },
      );
    }

    // Get artifacts to intelligently determine restart phase
    const artifacts = generationRecord.artifacts ?? {};
    
    // Intelligently determine where to restart based on failure point and available data
    const { restartPhase, reasoning, availableArtifacts } = determineRestartPhase(
      generationRecord.status,
      artifacts,
    );

    // Reset article status to generating to indicate retry is in progress
    await db
      .update(articles)
      .set({
        status: "generating",
        updatedAt: new Date(),
      })
      .where(eq(articles.id, articleId));

    // Reset generation record status to indicate retry
    await db
      .update(articleGenerations)
      .set({
        status: restartPhase,
        progress: 0,
        error: null,
        errorDetails: null,
        updatedAt: new Date(),
      })
      .where(eq(articleGenerations.id, generationRecord.id));

    // Start the generation from the determined phase using existing context
    // This is run asynchronously so the API can return immediately
    // Use Next.js waitUntil to ensure the background task completes properly
    const retryPromise = continueGenerationFromPhase(
      generationRecord.id,
      restartPhase,
    ).catch((error) => {
      console.error("Retry generation failed:", error);
      // The error will be handled by the generation pipeline's error handling
    });

    // Check if waitUntil is available (Vercel/Edge Runtime)
    if ('waitUntil' in globalThis) {
      const waitUntil = (globalThis as unknown as { waitUntil: (promise: Promise<unknown>) => void }).waitUntil;
      waitUntil(retryPromise);
    } else {
      // Fallback for local development - fire and forget
      void retryPromise;
    }

    return NextResponse.json({
      success: true,
      article: {
        id: articleId,
        title: existingArticle.title,
        status: "generating",
        updatedAt: new Date(),
      },
      message: `Article generation retry started from ${restartPhase} phase`,
      debugInfo: {
        failedPhase: generationRecord.status,
        restartPhase,
        availableArtifacts,
        reasoning,
      },
    } as RetryResponse);
  } catch (error) {
    console.error("Retry generation error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to retry article generation",
      } as RetryResponse,
      { status: 500 },
    );
  }
}
