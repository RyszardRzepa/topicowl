import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/server/db";
import { articles, users, projects } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import type { ApiResponse, ArticleStatus } from '@/types';
import type { ArticleGenerationRequest } from '@/app/api/articles/generate/route';
import { API_BASE_URL } from '@/constants';

// Types colocated with this API route
export interface MoveArticleRequest {
  articleId: number;
  newStatus: ArticleStatus;
  newPosition: number;
}

// Kanban flow logic - inline implementation
const STATUS_FLOW: Record<ArticleStatus, ArticleStatus[]> = {
  idea: ['to_generate', 'scheduled'],
  scheduled: ['queued', 'idea'],
  queued: ['generating', 'scheduled', 'idea'],
  to_generate: ['generating'], // Only through generate button, not drag
  generating: ['wait_for_publish'], // Automatically moved by system after generation
  wait_for_publish: ['published'],
  published: [], // Cannot be moved
  deleted: [], // Deleted articles cannot be moved
};

const isValidStatusTransition = (from: ArticleStatus, to: ArticleStatus): boolean => {
  return STATUS_FLOW[from].includes(to);
};

// Note: Progress tracking is now handled by the database via the generate API
// No need for in-memory tracking since generation records are stored in articleGeneration table

// Article generation function - calls the generate API endpoint
async function generateArticleContentInline(articleId: string) {
  console.log('Starting article generation by calling generate API for article:', articleId);
  try {
    // Call the generate API endpoint instead of duplicating logic
    const generateResponse = await fetch(`${API_BASE_URL}/api/articles/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        articleId: articleId.toString(),
      } as ArticleGenerationRequest),
    });

    if (!generateResponse.ok) {
      throw new Error(`Generate API failed: ${generateResponse.statusText}`);
    }

    const generateData = await generateResponse.json() as ApiResponse;
    console.log('Generate API called successfully:', generateData);

  } catch (error) {
    console.error('Generation error:', error);
    
    // Update article status to failed
    await db
      .update(articles)
      .set({
        status: 'idea', // Reset to idea status
        updatedAt: new Date(),
      })
      .where(eq(articles.id, parseInt(articleId)));
  }
}

const moveArticleSchema = z.object({
  articleId: z.number(),
  newStatus: z.enum(['idea', 'to_generate', 'generating', 'wait_for_publish', 'published']),
  newPosition: z.number().min(0),
});

// POST /api/articles/move - Move article between columns/statuses
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
    const { articleId, newStatus, newPosition } = moveArticleSchema.parse(body);

    // Get current article and verify ownership using project-based access control
    const [result] = await db
      .select()
      .from(articles)
      .innerJoin(projects, eq(articles.projectId, projects.id))
      .where(and(eq(articles.id, articleId), eq(projects.userId, userRecord.id)))
      .limit(1);

    if (!result) {
      return NextResponse.json(
        { error: 'Article not found or access denied' },
        { status: 404 }
      );
    }

    const currentArticle = result.articles;

    // Validate status transition
    if (!isValidStatusTransition(currentArticle.status, newStatus)) {
      return NextResponse.json(
        { error: 'Invalid status transition. Articles can only move forward in the workflow.' },
        { status: 400 }
      );
    }

    // Prevent moving articles in generating state
    if (currentArticle.status === 'generating') {
      return NextResponse.json(
        { error: 'Cannot move article while generating' },
        { status: 400 }
      );
    }

    // Prevent moving published articles
    if (currentArticle.status === 'published') {
      return NextResponse.json(
        { error: 'Cannot move published articles' },
        { status: 400 }
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

    // If moved to "published" status, trigger webhook
    if (newStatus === 'published') {
      // Trigger webhook delivery asynchronously
      fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/api/webhooks/deliver`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          articleId: articleId,
          eventType: 'article.published'
        })
      }).catch(error => {
        console.error('Failed to trigger webhook delivery for article', articleId, ':', error);
      });
    }

    // If moved to "generating" status, automatically start generation
    if (newStatus === 'generating') {
      try {
        console.log('Auto-starting generation for article:', articleId);
        
        // Start generation process (runs in background) - all logic inline
        generateArticleContentInline(articleId.toString()).catch((error: unknown) => {
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
