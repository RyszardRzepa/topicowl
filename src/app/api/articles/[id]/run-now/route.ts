import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { articles, users, articleGeneration } from "@/server/db/schema";
import { eq } from "drizzle-orm";
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
  req: NextRequest,
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
      .where(eq(users.id, userId))
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

    if (existingArticle.userId !== userRecord.id) {
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

    // Update article status to generating to trigger immediate processing
    await db
      .update(articles)
      .set({
        status: "generating",
        updatedAt: new Date(),
      })
      .where(eq(articles.id, articleId));

    // Update the generation record to indicate immediate processing
    await db
      .update(articleGeneration)
      .set({
        scheduledAt: null, // Clear scheduled time to indicate immediate processing
        updatedAt: new Date(),
      })
      .where(eq(articleGeneration.articleId, articleId));
    
    return NextResponse.json({
      success: true,
      article: {
        id: articleId,
        title: existingArticle.title,
        status: "generating",
        updatedAt: new Date(),
      },
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