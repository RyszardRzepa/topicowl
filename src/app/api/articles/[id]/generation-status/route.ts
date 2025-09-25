import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/server/db";
import { articles, articleGenerations, users, projects } from "@/server/db/schema";
import type { ArticleStatus, ArticleGenerationStatus } from "@/types";
import { eq, desc, and } from "drizzle-orm";
import type { ApiResponse } from "@/types";

// Types colocated with this API route
export interface GenerationStatus {
  articleId: string;
  status: ArticleGenerationStatus;
  articleStatus: ArticleStatus;
  progress: number;
  startedAt: string;
  completedAt?: string;
  error?: string;
  seoScore?: number;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // Get current user from Clerk
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "Unauthorized" },
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
      return NextResponse.json<ApiResponse>(
        { success: false, error: "User not found" },
        { status: 404 },
      );
    }

    const { id } = await params;

    if (!id && isNaN(parseInt(id))) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "Invalid article ID" },
        { status: 400 },
      );
    }

    const articleId = parseInt(id);

    // Check if article exists and belongs to current user's project using JOIN
    const [article] = await db
      .select({
        id: articles.id,
        projectId: articles.projectId,
        status: articles.status,
      })
      .from(articles)
      .innerJoin(projects, eq(articles.projectId, projects.id))
      .where(
        and(eq(articles.id, articleId), eq(projects.userId, userRecord.id)),
      )
      .limit(1);

    if (!article) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: "Article not found or access denied",
        },
        { status: 404 },
      );
    }

    // Get the latest generation record for this article
    const [latestGeneration] = await db
      .select()
      .from(articleGenerations)
      .where(eq(articleGenerations.articleId, articleId))
      .orderBy(desc(articleGenerations.createdAt))
      .limit(1);

    // If no generation record exists, return not found
    if (!latestGeneration) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: "No generation found for this article",
        },
        { status: 404 },
      );
    }

    // Simple response with raw data - let UI handle the presentation logic
    const artifacts = latestGeneration.artifacts;
    const validationArtifact = artifacts.validation;

    const statusResponse: GenerationStatus = {
      articleId: id,
      status: latestGeneration.status,
      articleStatus: article.status,
      progress: latestGeneration.progress,
      startedAt:
        latestGeneration.startedAt?.toISOString() ??
        latestGeneration.createdAt.toISOString(),
      completedAt: latestGeneration.completedAt?.toISOString(),
      error: latestGeneration.error ?? undefined,
      seoScore: validationArtifact?.seoScore ?? undefined,
    };

    return NextResponse.json<ApiResponse>({
      success: true,
      ...statusResponse,
    });
  } catch (error) {
    console.error("Get generation status error:", error);
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: "Failed to get generation status",
      },
      { status: 500 },
    );
  }
}
