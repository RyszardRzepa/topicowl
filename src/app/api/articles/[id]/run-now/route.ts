import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { articles, articleGeneration, users } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";

// API types for this endpoint
export interface RunNowResponse {
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

// POST /api/articles/[id]/run-now - Start generation immediately for scheduled article
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get current user from Clerk
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" } as RunNowResponse,
        { status: 401 }
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
        { success: false, error: "User not found" } as RunNowResponse,
        { status: 404 }
      );
    }

    const articleId = parseInt(params.id);
    if (isNaN(articleId)) {
      return NextResponse.json(
        { success: false, error: "Invalid article ID" } as RunNowResponse,
        { status: 400 }
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
        { success: false, error: "Article not found" } as RunNowResponse,
        { status: 404 }
      );
    }

    if (existingArticle.user_id !== userRecord.id) {
      return NextResponse.json(
        { success: false, error: "Access denied" } as RunNowResponse,
        { status: 403 }
      );
    }

    // Check if article is scheduled for generation
    if (existingArticle.status !== "to_generate") {
      return NextResponse.json(
        {
          success: false,
          error: "Article is not scheduled for generation",
        } as RunNowResponse,
        { status: 400 }
      );
    }

    // Update article status to generating
    const [updatedArticle] = await db
      .update(articles)
      .set({
        status: "generating",
        updatedAt: new Date(),
      })
      .where(eq(articles.id, articleId))
      .returning();

    // Update or create generation record
    const [existingGeneration] = await db
      .select()
      .from(articleGeneration)
      .where(
        and(
          eq(articleGeneration.articleId, articleId),
          eq(articleGeneration.userId, userRecord.id)
        )
      )
      .limit(1);

    if (existingGeneration) {
      // Update existing generation record
      await db
        .update(articleGeneration)
        .set({
          status: "researching",
          progress: 0,
          startedAt: new Date(),
          scheduledAt: null, // Clear scheduled time since we're running now
          updatedAt: new Date(),
        })
        .where(eq(articleGeneration.id, existingGeneration.id));
    } else {
      // Create new generation record
      await db.insert(articleGeneration).values({
        articleId: articleId,
        userId: userRecord.id,
        status: "researching",
        progress: 0,
        startedAt: new Date(),
      });
    }

    // Here you would typically trigger the actual generation process
    // For now, we'll just update the status and let the polling handle the rest
    
    return NextResponse.json({
      success: true,
      article: updatedArticle,
      message: "Article generation started immediately",
    } as RunNowResponse);
  } catch (error) {
    console.error("Run now error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to start article generation",
      } as RunNowResponse,
      { status: 500 }
    );
  }
}