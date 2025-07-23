import { type NextRequest, NextResponse } from "next/server";
import { db } from '@/server/db';
import { articles } from '@/server/db/schema';
import { eq } from 'drizzle-orm';
import type { ApiResponse } from '@/types/types';

// Types colocated with this API route
export interface ScheduleRequest {
  articleId: string;
  publishDate: string;
  timezone?: string;
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json() as ScheduleRequest;
    const { articleId, publishDate, timezone } = body;

    if (!articleId || !publishDate) {
      return NextResponse.json(
        { success: false, error: 'Article ID and publish date are required' } as ApiResponse,
        { status: 400 }
      );
    }

    // Validate date format
    const scheduleDate = new Date(publishDate);
    if (isNaN(scheduleDate.getTime())) {
      return NextResponse.json(
        { success: false, error: 'Invalid publish date format' } as ApiResponse,
        { status: 400 }
      );
    }

    // Update article schedule in database
    const [updatedArticle] = await db
      .update(articles)
      .set({ 
        publishedAt: scheduleDate,
        status: 'wait_for_publish',
        updatedAt: new Date(),
      })
      .where(eq(articles.id, parseInt(articleId)))
      .returning();

    if (!updatedArticle) {
      return NextResponse.json(
        { success: false, error: 'Article not found' } as ApiResponse,
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        id: updatedArticle.id.toString(),
        title: updatedArticle.title,
        status: updatedArticle.status,
        publishDate: updatedArticle.publishedAt?.toISOString() ?? null,
        timezone: timezone ?? 'UTC',
      },
    } as ApiResponse);

  } catch (error) {
    console.error("Error updating article schedule:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : "Failed to update article schedule" 
      } as ApiResponse,
      { status: 500 }
    );
  }
}
