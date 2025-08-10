import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/server/db";
import { articles, users } from "@/server/db/schema";
import { max, eq } from "drizzle-orm";
import { z } from "zod";

export const maxDuration = 800;

// Types colocated with this API route
export interface CreateArticleRequest {
  title: string;
  description?: string;
  keywords?: string[];
  targetAudience?: string;
  notes?: string;
}

const createArticleSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  keywords: z.array(z.string()).optional().default([]),
  targetAudience: z.string().optional(),
  notes: z.string().optional(),
});

// POST /api/articles - Create new article
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

    const body: unknown = await req.json();
    const validatedData = createArticleSchema.parse(body);
    
    // Get the maximum kanban position for this user's articles
    const maxPositionResult = await db
      .select({ maxPosition: max(articles.kanbanPosition) })
      .from(articles)
      .where(eq(articles.user_id, userRecord.id));
    
    const nextPosition = (maxPositionResult[0]?.maxPosition ?? -1) + 1;

    const [newArticle] = await db
      .insert(articles)
      .values({
        ...validatedData,
        user_id: userRecord.id,
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

// GET /api/articles - Get user's articles
export async function GET(_req: NextRequest) {
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

    // Get only this user's articles
    const userArticles = await db
      .select()
      .from(articles)
      .where(eq(articles.user_id, userRecord.id))
      .orderBy(articles.kanbanPosition, articles.createdAt);
    
    return NextResponse.json(userArticles);

  } catch (error) {
    console.error('Get articles error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch articles' },
      { status: 500 }
    );
  }
}
