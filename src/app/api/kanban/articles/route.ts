import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { articles } from "@/server/db/schema";
import { eq, and, max } from "drizzle-orm";
import { z } from "zod";

const createArticleSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  keywords: z.array(z.string()).default([]),
  targetAudience: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
});

// POST /api/kanban/articles - Create new article
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validatedData = createArticleSchema.parse(body);
    
    // Get the maximum kanban position for new article positioning
    const maxPositionResult = await db
      .select({ maxPosition: max(articles.kanbanPosition) })
      .from(articles);
    
    const nextPosition = (maxPositionResult[0]?.maxPosition ?? -1) + 1;

    const [newArticle] = await db
      .insert(articles)
      .values({
        ...validatedData,
        status: 'idea',
        kanbanPosition: nextPosition,
      })
      .returning();
    
    return NextResponse.json(newArticle, { status: 201 });

  } catch (error) {
    console.error('Create article error:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input data', details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to create article' },
      { status: 500 }
    );
  }
}

// GET /api/kanban/articles - Get all articles
export async function GET(req: NextRequest) {
  try {
    const allArticles = await db
      .select()
      .from(articles)
      .orderBy(articles.kanbanPosition, articles.createdAt);
    
    return NextResponse.json(allArticles);

  } catch (error) {
    console.error('Get articles error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch articles' },
      { status: 500 }
    );
  }
}