import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/server/db";
import { articles, articleGeneration, users } from "@/server/db/schema";
import { eq, desc } from "drizzle-orm";
import type { ApiResponse } from "@/types";

// Types colocated with this API route
export interface GenerationStatus {
  articleId: string;
  status:
    | "pending"
    | "researching"
    | "writing"
    | "quality-control"
    | "validating"
    | "updating"
    | "completed"
    | "failed";
  progress: number;
  currentStep?: string;
  phase?: string;
  error?: string;
  estimatedCompletion?: string;
  startedAt: string;
  completedAt?: string;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
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

    const { id } = await params;

    if (!id && isNaN(parseInt(id))) {
      return NextResponse.json(
        { success: false, error: "Invalid article ID" } as ApiResponse,
        { status: 400 },
      );
    }

    const articleId = parseInt(id);

    // Check if article exists and belongs to current user
    const [article] = await db
      .select()
      .from(articles)
      .where(eq(articles.id, articleId))
      .limit(1);

    if (!article) {
      return NextResponse.json(
        { success: false, error: "Article not found" } as ApiResponse,
        { status: 404 },
      );
    }

    // Verify article ownership
    if (article.user_id !== userRecord.id) {
      return NextResponse.json(
        {
          success: false,
          error: "Access denied: Article does not belong to current user",
        } as ApiResponse,
        { status: 403 },
      );
    }

    // Get the latest generation record for this article
    const [latestGeneration] = await db
      .select()
      .from(articleGeneration)
      .where(eq(articleGeneration.articleId, articleId))
      .orderBy(desc(articleGeneration.createdAt))
      .limit(1);

    // If no generation record exists, return not found
    if (!latestGeneration) {
      return NextResponse.json(
        { success: false, error: "No generation found for this article" } as ApiResponse,
        { status: 404 }
      );
    }

    // Map generation record status to response
    const mapStatus = (dbStatus: string): GenerationStatus["status"] => {
      switch (dbStatus) {
        case "pending":
          return "pending";
        case "researching":
          return "researching";
        case "writing":
          return "writing";
        case "quality-control":
          return "quality-control";
        case "validating":
          return "validating";
        case "updating":
          return "updating";
        case "completed":
          return "completed";
        case "failed":
          return "failed";
        default:
          return "pending";
      }
    };

    // Enhanced phase descriptions
    const getPhaseDescription = (status: string): string => {
      switch (status) {
        case "pending":
          return "Queued for generation";
        case "researching":
          return "Researching topic and gathering information";
        case "writing":
          return "Writing article content";
        case "quality-control":
          return "Analyzing content quality";
        case "validating":
          return "Fact-checking and validation";
        case "updating":
          return "Applying final optimizations";
        case "completed":
          return "Generation completed successfully";
        case "failed":
          return "Generation failed";
        default:
          return "Processing...";
      }
    };

    const status: GenerationStatus = {
      articleId: id,
      status: mapStatus(latestGeneration.status),
      progress: latestGeneration.progress,
      currentStep: latestGeneration.status === "completed" 
        ? undefined 
        : getPhaseDescription(latestGeneration.status),
      phase: latestGeneration.status === "researching" ? "research" :
             latestGeneration.status === "writing" ? "writing" :
             latestGeneration.status === "quality-control" ? "quality-control" :
             latestGeneration.status === "validating" ? "validation" :
             latestGeneration.status === "updating" ? "optimization" : undefined,
      startedAt:
        latestGeneration.startedAt?.toISOString() ??
        latestGeneration.createdAt.toISOString(),
      completedAt: latestGeneration.completedAt?.toISOString(),
      error: latestGeneration.error ?? undefined,
    };

    return NextResponse.json({
      success: true,
      ...status,
    });
  } catch (error) {
    console.error("Get generation status error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to get generation status",
      } as ApiResponse,
      { status: 500 },
    );
  }
}
