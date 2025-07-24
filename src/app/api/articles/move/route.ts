import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { articles } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import type { ApiResponse, ArticleStatus } from '@/types';
import type { GenerationStatus } from '@/app/api/articles/[id]/generation-status/route';
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
  idea: ['to_generate'],
  to_generate: ['generating'], // Only through generate button, not drag
  generating: ['wait_for_publish'], // Automatically moved by system after generation
  wait_for_publish: ['published'],
  published: [], // Cannot be moved
};

const isValidStatusTransition = (from: ArticleStatus, to: ArticleStatus): boolean => {
  return STATUS_FLOW[from].includes(to);
};

// In-memory progress tracking - inline implementation
const progressMap = new Map<string, GenerationStatus>();

// Helper function to update progress - inline implementation  
const updateProgress = (
  articleId: string, 
  status: GenerationStatus['status'], 
  progress: number, 
  currentStep?: string
) => {
  progressMap.set(articleId, {
    articleId,
    status,
    progress,
    currentStep,
    startedAt: progressMap.get(articleId)?.startedAt ?? new Date().toISOString(),
    completedAt: status === 'completed' || status === 'failed' ? new Date().toISOString() : undefined,
  });
};

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
    updateProgress(articleId, 'failed', 0, undefined);
    
    // Update article status to failed
    await db
      .update(articles)
      .set({
        status: 'idea', // Reset to idea status
        generationError: error instanceof Error ? error.message : 'Unknown error occurred',
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

    // Validate status transition
    if (!isValidStatusTransition(currentArticle.status as ArticleStatus, newStatus as ArticleStatus)) {
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

    // If moved to "generating" status, automatically start generation
    if (newStatus === 'generating') {
      try {
        console.log('Auto-starting generation for article:', articleId);
        // Initialize progress tracking
        updateProgress(articleId.toString(), 'pending', 0, 'Initializing generation');
        
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
