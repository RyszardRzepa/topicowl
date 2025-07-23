import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { articles } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import type { ApiResponse } from '@/types/types';

// Types colocated with this API route
export interface ArticleScheduleRequest {
  scheduledAt: string;
  status?: string;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body: ArticleScheduleRequest = await req.json() as ArticleScheduleRequest;
    
    if (!id || isNaN(parseInt(id))) {
      return NextResponse.json(
        { success: false, error: "Invalid article ID" } as ApiResponse,
        { status: 400 }
      );
    }

    if (!body.scheduledAt) {
      return NextResponse.json(
        { success: false, error: "scheduledAt is required" } as ApiResponse,
        { status: 400 }
      );
    }
    
    const articleId = parseInt(id);
    const scheduledDate = new Date(body.scheduledAt);
    
    if (isNaN(scheduledDate.getTime())) {
      return NextResponse.json(
        { success: false, error: "Invalid date format" } as ApiResponse,
        { status: 400 }
      );
    }

    const [updatedArticle] = await db
      .update(articles)
      .set({
        publishedAt: scheduledDate,
        status: (body.status as 'wait_for_publish') ?? 'wait_for_publish',
        updatedAt: new Date(),
      })
      .where(eq(articles.id, articleId))
      .returning();

    if (!updatedArticle) {
      return NextResponse.json(
        { success: false, error: "Article not found" } as ApiResponse,
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        id: updatedArticle.id.toString(),
        title: updatedArticle.title,
        status: updatedArticle.status,
        scheduledAt: updatedArticle.publishedAt?.toISOString() ?? null,
      },
    } as ApiResponse);

  } catch (error) {
    console.error('Schedule article error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to schedule article' 
      } as ApiResponse,
      { status: 500 }
    );
  }
}