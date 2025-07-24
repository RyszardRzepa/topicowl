import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { articles } from "@/server/db/schema";
import { eq, and, lte } from "drizzle-orm";
import type { ApiResponse } from '@/types';

// POST /api/articles/publish - Publish scheduled articles
export async function POST(_req: NextRequest) {
  try {
    // Find articles scheduled for publishing that are due
    const now = new Date();
    const articlesToPublish = await db
      .select()
      .from(articles)
      .where(
        and(
          eq(articles.status, 'wait_for_publish'),
          lte(articles.publishedAt, now)
        )
      );

    const publishedArticles = [];

    // Update each article to published status
    for (const article of articlesToPublish) {
      const [updatedArticle] = await db
        .update(articles)
        .set({
          status: 'published',
          updatedAt: new Date(),
        })
        .where(eq(articles.id, article.id))
        .returning();

      if (updatedArticle) {
        publishedArticles.push(updatedArticle);
      }
    }
    
    console.log(`Published ${publishedArticles.length} articles`);
    
    return NextResponse.json({
      success: true,
      data: {
        publishedCount: publishedArticles.length,
        publishedArticles: publishedArticles.map(a => ({ 
          id: a.id.toString(), 
          title: a.title 
        })),
      },
    } as ApiResponse);

  } catch (error) {
    console.error('Publish articles error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to publish scheduled articles' 
      } as ApiResponse,
      { status: 500 }
    );
  }
}
