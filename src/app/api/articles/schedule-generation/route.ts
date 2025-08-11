import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { articles, articleGeneration, users, generationQueue } from "@/server/db/schema";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@clerk/nextjs/server";
import { hasCredits } from "@/lib/utils/credits";

const scheduleGenerationSchema = z.object({
  articleId: z.number(),
  scheduledAt: z.string().datetime(),
});



// API types for this endpoint
export interface ScheduleGenerationRequest {
  articleId: number;
  scheduledAt: string; // ISO datetime string
}

export interface ScheduleGenerationResponse {
  success: boolean;
  article?: {
    id: number;
    title: string;
    status: string;
    updatedAt: Date;
  };
  generationRecord?: {
    id: number;
    status: string;
    progress: number;
    scheduledAt: Date;
  };
  message?: string;
  error?: string;
  details?: unknown;
}

// POST /api/articles/schedule-generation - Schedule article generation
export async function POST(req: NextRequest) {
  try {
    // Get current user from Clerk
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" } as ScheduleGenerationResponse,
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
        {
          success: false,
          error: "User not found",
        } as ScheduleGenerationResponse,
        { status: 404 },
      );
    }

    const body = (await req.json()) as unknown;
    const { articleId, scheduledAt } = scheduleGenerationSchema.parse(body);
    const scheduledDate = new Date(scheduledAt);
    const currentDate = new Date();



    // Add a 30-second buffer to account for processing time and timezone differences
    const bufferTime = 30 * 1000; // 30 seconds in milliseconds
    const minimumTime = new Date(currentDate.getTime() + bufferTime);

    if (scheduledDate <= minimumTime) {
      return NextResponse.json(
        {
          success: false,
          error: "Scheduled time must be at least 30 seconds in the future",
        } as ScheduleGenerationResponse,
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
        } as ScheduleGenerationResponse,
        { status: 404 },
      );
    }

    if (existingArticle.user_id !== userRecord.id) {
      return NextResponse.json(
        {
          success: false,
          error: "Access denied: Article does not belong to current user",
        } as ScheduleGenerationResponse,
        { status: 403 },
      );
    }

    // Check if user has credits before scheduling generation
    const userHasCredits = await hasCredits(userRecord.id);
    if (!userHasCredits) {
      return NextResponse.json(
        {
          success: false,
          error: "Insufficient credits. You need at least 1 credit to schedule article generation.",
        } as ScheduleGenerationResponse,
        { status: 402 },
      );
    }

    // Update the article status to to_generate
    const [updatedArticle] = await db
      .update(articles)
      .set({
        status: "to_generate", // Ensure it's in the right status
        updatedAt: new Date(),
      })
      .where(eq(articles.id, articleId))
      .returning();

    // Check for existing generation record and update it, or create new one
    const [existingRecord] = await db
      .select()
      .from(articleGeneration)
      .where(eq(articleGeneration.articleId, articleId))
      .orderBy(desc(articleGeneration.createdAt))
      .limit(1);

    // Clean up orphaned queue records for this article when rescheduling
    await db
      .delete(generationQueue)
      .where(eq(generationQueue.article_id, articleId));

    let generationRecord;
    if (existingRecord) {
      // Update existing record
      [generationRecord] = await db
        .update(articleGeneration)
        .set({
          status: "pending",
          progress: 0,
          scheduledAt: scheduledDate,
          error: null,
          errorDetails: null,
          updatedAt: new Date(),
        })
        .where(eq(articleGeneration.id, existingRecord.id))
        .returning();
    } else {
      // Create new record only if none exists
      [generationRecord] = await db
        .insert(articleGeneration)
        .values({
          articleId: articleId,
          userId: userRecord.id,
          status: "pending",
          progress: 0,
          scheduledAt: scheduledDate,
        })
        .returning();
    }

    return NextResponse.json({
      success: true,
      article: updatedArticle,
      generationRecord: generationRecord,
      message: `Article generation scheduled for ${scheduledDate.toLocaleString()}`,
    } as ScheduleGenerationResponse);
  } catch (error) {
    console.error("Schedule generation error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid input data",
          details: error.errors,
        } as ScheduleGenerationResponse,
        { status: 400 },
      );
    }
    return NextResponse.json(
      {
        success: false,
        error: "Failed to schedule article generation",
      } as ScheduleGenerationResponse,
      { status: 500 },
    );
  }
}
