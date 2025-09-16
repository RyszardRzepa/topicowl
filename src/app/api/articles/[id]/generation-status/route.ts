import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/server/db";
import {
  articles,
  articleGeneration,
  users,
  projects,
  type ArticleStatus,
} from "@/server/db/schema";
import { eq, desc, and } from "drizzle-orm";
import type { ApiResponse } from "@/types";

// Types colocated with this API route
export interface GenerationStatus {
  articleId: string;
  status: ArticleStatus;
  progress: number;
  startedAt: string;
  completedAt?: string;
  currentPhase?: string;
  error?: string;
  seoScore?: number;
  seoReport?: unknown;
  checklist?: unknown;
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
      .where(eq(users.id, userId))
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

    // Check if article exists and belongs to current user's project using JOIN
    const [article] = await db
      .select({
        id: articles.id,
        projectId: articles.projectId,
      })
      .from(articles)
      .innerJoin(projects, eq(articles.projectId, projects.id))
      .where(
        and(eq(articles.id, articleId), eq(projects.userId, userRecord.id)),
      )
      .limit(1);

    if (!article) {
      return NextResponse.json(
        {
          success: false,
          error: "Article not found or access denied",
        } as ApiResponse,
        { status: 404 },
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
        {
          success: false,
          error: "No generation found for this article",
        } as ApiResponse,
        { status: 404 },
      );
    }

    // Simple response with raw data - let UI handle the presentation logic
    const statusResponse: GenerationStatus = {
      articleId: id,
      status: latestGeneration.status,
      progress: latestGeneration.progress,
      startedAt:
        latestGeneration.startedAt?.toISOString() ??
        latestGeneration.createdAt.toISOString(),
      completedAt: latestGeneration.completedAt?.toISOString(),
      currentPhase: latestGeneration.currentPhase ?? undefined,
      error: latestGeneration.error ?? undefined,
      seoScore: typeof latestGeneration.seoReport === 'object' && 
                latestGeneration.seoReport && 
                'score' in latestGeneration.seoReport &&
                typeof latestGeneration.seoReport.score === 'number' 
                ? latestGeneration.seoReport.score 
                : undefined,
      seoReport: latestGeneration.seoReport,
      checklist: latestGeneration.checklist,
    };

    return NextResponse.json({
      success: true,
      ...statusResponse,
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
