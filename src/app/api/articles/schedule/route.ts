import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { articles, users } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@clerk/nextjs/server";

// Types colocated with this API route
export interface ScheduleArticleRequest {
  articleId: number;
  scheduledAt: string; // When to add to queue (ISO date string)
  schedulingType: "manual" | "automatic";
  frequency?: "once" | "daily" | "weekly" | "monthly"; // Required for automatic, ignored for manual
  frequencyConfig?: {
    daysOfWeek?: number[]; // 0-6, Sunday=0
    timeOfDay?: string; // HH:MM format
    monthlyDay?: number; // 1-31 for monthly
    timezone?: string;
  };
}

export interface ScheduleArticleResponse {
  success: boolean;
  data: {
    id: number;
    title: string;
    status: string;
    scheduledAt: string;
    schedulingType: string;
    frequency?: string;
    nextScheduleAt?: string;
  };
  message: string;
}

const scheduleArticleSchema = z.object({
  articleId: z.number(),
  scheduledAt: z.string().datetime(),
  schedulingType: z.enum(["manual", "automatic"]),
  frequency: z.enum(["once", "daily", "weekly", "monthly"]).optional(),
  frequencyConfig: z.object({
    daysOfWeek: z.array(z.number().min(0).max(6)).optional(),
    timeOfDay: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
    monthlyDay: z.number().min(1).max(31).optional(),
    timezone: z.string().optional(),
  }).optional(),
});

// Helper function to calculate next schedule time
function calculateNextScheduleTime(
  scheduledAt: Date,
  frequency: string,
  frequencyConfig?: unknown
): Date | null {
  if (frequency === "once") return null;
  
  const next = new Date(scheduledAt);
  
  switch (frequency) {
    case "daily":
      next.setDate(next.getDate() + 1);
      break;
    case "weekly":
      next.setDate(next.getDate() + 7);
      break;
    case "monthly":
      next.setMonth(next.getMonth() + 1);
      break;
    default:
      return null;
  }
  
  return next;
}

// POST /api/articles/schedule - Schedule article for generation
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
      .where(eq(users.clerk_user_id, userId))
      .limit(1);

    if (!userRecord) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const body = await req.json() as unknown;
    const validatedData = scheduleArticleSchema.parse(body);
    const { articleId, scheduledAt, schedulingType, frequency, frequencyConfig } = validatedData;
    
    const scheduledDate = new Date(scheduledAt);

    // Validate future date
    if (scheduledDate <= new Date()) {
      return NextResponse.json(
        { error: 'Scheduled time must be in the future' },
        { status: 400 }
      );
    }

    // Validate frequency for automatic scheduling
    if (schedulingType === "automatic" && !frequency) {
      return NextResponse.json(
        { error: 'Frequency is required for automatic scheduling' },
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
        { error: 'Article not found' },
        { status: 404 }
      );
    }

    if (existingArticle.user_id !== userRecord.id) {
      return NextResponse.json(
        { error: 'Access denied: Article does not belong to current user' },
        { status: 403 }
      );
    }

    // Calculate next schedule time for recurring schedules
    const nextScheduleAt = frequency ? calculateNextScheduleTime(scheduledDate, frequency) : null;

    const [updatedArticle] = await db
      .update(articles)
      .set({
        status: 'scheduled',
        scheduledAt: scheduledDate,
        scheduling_type: schedulingType,
        scheduling_frequency: frequency ?? null,
        scheduling_frequency_config: frequencyConfig ?? null,
        next_schedule_at: nextScheduleAt,
        is_recurring_schedule: frequency !== "once" && frequency !== undefined,
        schedule_count: (existingArticle.schedule_count ?? 0) + 1,
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

    const response: ScheduleArticleResponse = {
      success: true,
      data: {
        id: updatedArticle.id,
        title: updatedArticle.title,
        status: updatedArticle.status,
        scheduledAt: updatedArticle.scheduledAt!.toISOString(),
        schedulingType: updatedArticle.scheduling_type!,
        frequency: updatedArticle.scheduling_frequency ?? undefined,
        nextScheduleAt: updatedArticle.next_schedule_at?.toISOString(),
      },
      message: `Article scheduled for ${scheduledDate.toLocaleString()}`,
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Schedule article error:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input data', details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to schedule article' },
      { status: 500 }
    );
  }
}

// PUT /api/articles/schedule - Update article schedule
export async function PUT(req: NextRequest) {
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
      .where(eq(users.clerk_user_id, userId))
      .limit(1);

    if (!userRecord) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const body = await req.json() as unknown;
    const validatedData = scheduleArticleSchema.parse(body);
    const { articleId, scheduledAt, schedulingType, frequency, frequencyConfig } = validatedData;
    
    const scheduledDate = new Date(scheduledAt);

    // Check if article exists and belongs to user
    const [existingArticle] = await db
      .select()
      .from(articles)
      .where(eq(articles.id, articleId))
      .limit(1);

    if (!existingArticle) {
      return NextResponse.json(
        { error: 'Article not found' },
        { status: 404 }
      );
    }

    if (existingArticle.user_id !== userRecord.id) {
      return NextResponse.json(
        { error: 'Access denied: Article does not belong to current user' },
        { status: 403 }
      );
    }

    // Don't allow updating if currently generating
    if (existingArticle.status === 'generating') {
      return NextResponse.json(
        { error: 'Cannot modify schedule while article is generating' },
        { status: 400 }
      );
    }

    // Calculate next schedule time for recurring schedules
    const nextScheduleAt = frequency ? calculateNextScheduleTime(scheduledDate, frequency) : null;

    // Update the article with new scheduling information
    const [updatedArticle] = await db
      .update(articles)
      .set({
        scheduledAt: scheduledDate,
        scheduling_type: schedulingType,
        scheduling_frequency: frequency ?? null,
        scheduling_frequency_config: frequencyConfig ?? null,
        next_schedule_at: nextScheduleAt,
        is_recurring_schedule: frequency !== "once" && frequency !== undefined,
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

    const response: ScheduleArticleResponse = {
      success: true,
      data: {
        id: updatedArticle.id,
        title: updatedArticle.title,
        status: updatedArticle.status,
        scheduledAt: updatedArticle.scheduledAt!.toISOString(),
        schedulingType: updatedArticle.scheduling_type!,
        frequency: updatedArticle.scheduling_frequency ?? undefined,
        nextScheduleAt: updatedArticle.next_schedule_at?.toISOString(),
      },
      message: `Article schedule updated`,
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Update schedule error:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input data', details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to update schedule' },
      { status: 500 }
    );
  }
}

// DELETE /api/articles/schedule - Cancel article schedule
export async function DELETE(req: NextRequest) {
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
      .where(eq(users.clerk_user_id, userId))
      .limit(1);

    if (!userRecord) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(req.url);
    const articleIdParam = searchParams.get('articleId');
    
    if (!articleIdParam) {
      return NextResponse.json(
        { error: 'Article ID is required' },
        { status: 400 }
      );
    }

    const articleId = parseInt(articleIdParam);

    // Check if article exists and belongs to user
    const [existingArticle] = await db
      .select()
      .from(articles)
      .where(eq(articles.id, articleId))
      .limit(1);

    if (!existingArticle) {
      return NextResponse.json(
        { error: 'Article not found' },
        { status: 404 }
      );
    }

    if (existingArticle.user_id !== userRecord.id) {
      return NextResponse.json(
        { error: 'Access denied: Article does not belong to current user' },
        { status: 403 }
      );
    }

    // Don't allow canceling if currently generating
    if (existingArticle.status === 'generating') {
      return NextResponse.json(
        { error: 'Cannot cancel schedule while article is generating' },
        { status: 400 }
      );
    }

    // Reset scheduling fields and set status back to idea
    const [updatedArticle] = await db
      .update(articles)
      .set({
        status: 'idea',
        scheduledAt: null,
        scheduling_type: 'manual',
        scheduling_frequency: null,
        scheduling_frequency_config: null,
        next_schedule_at: null,
        is_recurring_schedule: false,
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
      },
      message: 'Article schedule cancelled',
    });

  } catch (error) {
    console.error('Cancel schedule error:', error);
    return NextResponse.json(
      { error: 'Failed to cancel schedule' },
      { status: 500 }
    );
  }
}