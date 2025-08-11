import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { articles, users, articleGeneration } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@clerk/nextjs/server";

// Types colocated with this API route
export interface SchedulePublishingRequest {
  articleId: number;
  publishAt: string; // When to publish (ISO date string)
}

export interface SchedulePublishingResponse {
  success: boolean;
  data: {
    id: number;
    title: string;
    status: string;
    publishScheduledAt: string;
  };
  message: string;
}

const schedulePublishingSchema = z.object({
  articleId: z.number(),
  publishAt: z.string().datetime(),
});

// POST /api/articles/schedule-publishing - Schedule article for publishing
export async function POST(req: NextRequest) {
  try {
    // Get current user from Clerk
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
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
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const body = await req.json() as unknown;
    const validatedData = schedulePublishingSchema.parse(body);
    const { articleId, publishAt } = validatedData;

    // Validate that the article exists and belongs to the user
    const [existingArticle] = await db
      .select({
        id: articles.id,
        user_id: articles.userId,
        title: articles.title,
        status: articles.status,
        scheduledAt: articles.publishScheduledAt,
        // Include generation status to check if article is ready
        generationStatus: articleGeneration.status,
        generationProgress: articleGeneration.progress,
      })
      .from(articles)
      .leftJoin(articleGeneration, eq(articles.id, articleGeneration.articleId))
      .where(eq(articles.id, articleId))
      .limit(1);

    if (!existingArticle) {
      return NextResponse.json(
        { error: 'Article not found' },
        { status: 404 }
      );
    }

    // Verify ownership
    if (existingArticle.user_id !== userRecord.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Allow scheduling for articles that are ready to publish:
    // 1. Articles with "wait_for_publish" status
    // 2. Articles with completed generation (status="scheduled" + generationStatus="completed")
    const isReadyForPublishing = 
      existingArticle.status === "wait_for_publish" ||
      (existingArticle.status === "scheduled" && 
       existingArticle.generationStatus === "completed" && 
       existingArticle.generationProgress === 100);

    if (!isReadyForPublishing) {
      return NextResponse.json(
        { error: 'Only articles with completed generation can be scheduled for publishing' },
        { status: 400 }
      );
    }

    const publishDate = new Date(publishAt);
    
    // Validate future date
    if (publishDate <= new Date()) {
      return NextResponse.json(
        { error: 'Publish date must be in the future' },
        { status: 400 }
      );
    }

    // Update article with publishing schedule
    const [updatedArticle] = await db
      .update(articles)
      .set({
        publishScheduledAt: publishDate,
        status: "wait_for_publish", // Ensure status is correct
        updatedAt: new Date(),
      })
      .where(eq(articles.id, articleId))
      .returning();

    if (!updatedArticle) {
      return NextResponse.json(
        { error: 'Failed to update article' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        id: updatedArticle.id,
        title: updatedArticle.title,
        status: updatedArticle.status,
        publishScheduledAt: updatedArticle.publishScheduledAt?.toISOString() ?? "",
      },
      message: "Article scheduled for publishing successfully",
    } as SchedulePublishingResponse);

  } catch (error) {
    console.error("Schedule publishing error:", error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to schedule publishing' },
      { status: 500 }
    );
  }
}
