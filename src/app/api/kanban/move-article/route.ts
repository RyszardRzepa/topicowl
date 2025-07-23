import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { articles } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { articleGenerationService } from "@/lib/services/article-generation-service";
import { z } from "zod";

const moveArticleSchema = z.object({
  articleId: z.number(),
  newStatus: z.enum(['idea', 'to_generate', 'generating', 'wait_for_publish', 'published']),
  newPosition: z.number().min(0),
});

// POST /api/kanban/move-article - Move article between columns/statuses
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { articleId, newStatus, newPosition } = moveArticleSchema.parse(body);

    // Get current article
    const [currentArticle] = await db
      .select()
      .from(articles)
      .where(eq(articles.id, articleId));

    if (!currentArticle) {
      return NextResponse.json(
        { error: 'Article not found' },
        { status: 404 }
      );
    }

    const oldStatus = currentArticle.status;

    // Update article status and position
    const [updatedArticle] = await db
      .update(articles)
      .set({
        status: newStatus,
        kanbanPosition: newPosition,
        updatedAt: new Date(),
      })
      .where(eq(articles.id, articleId))
      .returning();

    // Special handling for moving to "to_generate" column
    if (newStatus === 'to_generate' && oldStatus !== 'to_generate') {
      // Immediately update status to "generating" and start generation
      await db
        .update(articles)
        .set({
          status: 'generating',
          generationStartedAt: new Date(),
        })
        .where(eq(articles.id, articleId));

      // Start article generation process in background
      const generationPromise = articleGenerationService.generateArticle(articleId);
      generationPromise.catch(error => {
        console.error(`Background generation failed for article ${articleId}:`, error);
      });

      return NextResponse.json({
        ...updatedArticle,
        status: 'generating',
        message: 'Article generation started'
      });
    }

    return NextResponse.json(updatedArticle);

  } catch (error) {
    console.error('Move article error:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input data', details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to move article' },
      { status: 500 }
    );
  }
}