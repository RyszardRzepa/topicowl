import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { articles } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { updateProgress } from '@/lib/progress-tracker';
import { generateArticleContent } from '@/lib/article-generation';

// Types colocated with this API route
export interface MoveArticleRequest {
  articleId: number;
  newStatus: 'idea' | 'to_generate' | 'generating' | 'wait_for_publish' | 'published';
  newPosition: number;
}

const moveArticleSchema = z.object({
  articleId: z.number(),
  newStatus: z.enum(['idea', 'to_generate', 'generating', 'wait_for_publish', 'published']),
  newPosition: z.number().min(0),
});

// POST /api/articles/move - Move article between columns/statuses
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as unknown;
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

    // If moved to "generating" status, automatically start generation
    if (newStatus === 'generating') {
      try {
        console.log('Auto-starting generation for article:', articleId);
        // Initialize progress tracking
        updateProgress(articleId.toString(), 'pending', 0, 'Initializing generation');
        
        // Start generation process (runs in background)
        generateArticleContent(articleId.toString()).catch(error => {
          console.error('Background auto-generation failed:', error);
        });
      } catch (error) {
        console.error('Error auto-starting generation:', error);
      }
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
