import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import {
  articles,
  articleGeneration,
  users,
  generationQueue,
} from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";

// API types for this endpoint
export interface CancelScheduleResponse {
  success: boolean;
  article?: {
    id: number;
    title: string;
    status: string;
    updatedAt: Date;
  };
  message?: string;
  error?: string;
}

// POST /api/articles/[id]/cancel-schedule - Cancel scheduled generation and move to planning
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    // Get current user from Clerk
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" } as CancelScheduleResponse,
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
        { success: false, error: "User not found" } as CancelScheduleResponse,
        { status: 404 },
      );
    }

    const articleId = parseInt(params.id);
    if (isNaN(articleId)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid article ID",
        } as CancelScheduleResponse,
        { status: 400 },
      );
    }

    // Check if article exists and belongs to user
    const [existingArticle] = await db
      .select()
      .from(articles)
      .where(eq(articles.id, articleId))
      .limit(1);

    if (!existingArticle) {
      return NextResponse.json(
        {
          success: false,
          error: "Article not found",
        } as CancelScheduleResponse,
        { status: 404 },
      );
    }

    if (existingArticle.userId !== userRecord.id) {
      return NextResponse.json(
        { success: false, error: "Access denied" } as CancelScheduleResponse,
        { status: 403 },
      );
    }

    // Check if article is scheduled for generation
    if (existingArticle.status !== "to_generate") {
      return NextResponse.json(
        {
          success: false,
          error: "Article is not scheduled for generation",
        } as CancelScheduleResponse,
        { status: 400 },
      );
    }

    // Update article status back to idea (planning mode)
    const [updatedArticle] = await db
      .update(articles)
      .set({
        status: "idea",
        updatedAt: new Date(),
      })
      .where(eq(articles.id, articleId))
      .returning();

    // Delete generation record to avoid DB conflicts
    await db
      .delete(articleGeneration)
      .where(
        and(
          eq(articleGeneration.articleId, articleId),
          eq(articleGeneration.userId, userRecord.id),
        ),
      );

    // Clean up orphaned queue records for this article
    await db
      .delete(generationQueue)
      .where(eq(generationQueue.articleId, articleId));

    return NextResponse.json({
      success: true,
      article: updatedArticle,
      message: "Article generation cancelled and moved to planning",
    } as CancelScheduleResponse);
  } catch (error) {
    console.error("Cancel schedule error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to cancel article generation",
      } as CancelScheduleResponse,
      { status: 500 },
    );
  }
}
