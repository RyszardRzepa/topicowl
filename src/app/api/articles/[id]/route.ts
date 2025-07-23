import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { articles } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

const updateArticleSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  keywords: z.array(z.string()).optional(),
  targetAudience: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  generationScheduledAt: z.string().datetime().optional(),
});

// GET /api/articles/[id] - Get single article
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const articleId = parseInt(id);
    if (isNaN(articleId)) {
      return NextResponse.json({ error: 'Invalid article ID' }, { status: 400 });
    }

    const article = await db
      .select()
      .from(articles)
      .where(eq(articles.id, articleId))
      .limit(1);

    if (article.length === 0) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    }

    return NextResponse.json(article[0]);

  } catch (error) {
    console.error('Get article error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch article' },
      { status: 500 }
    );
  }
}

// PUT /api/articles/[id] - Update article
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const articleId = parseInt(id);
    if (isNaN(articleId)) {
      return NextResponse.json({ error: 'Invalid article ID' }, { status: 400 });
    }

    const body = await req.json() as unknown;
    const validatedData = updateArticleSchema.parse(body);

    // Check if article exists
    const existingArticle = await db
      .select()
      .from(articles)
      .where(eq(articles.id, articleId))
      .limit(1);

    if (existingArticle.length === 0) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    }

    // Update the article
    const { generationScheduledAt, ...otherData } = validatedData;
    
    const updateData = {
      ...otherData,
      updatedAt: new Date(),
      ...(generationScheduledAt && { generationScheduledAt: new Date(generationScheduledAt) }),
    };

    const [updatedArticle] = await db
      .update(articles)
      .set(updateData)
      .where(eq(articles.id, articleId))
      .returning();

    return NextResponse.json(updatedArticle);

  } catch (error) {
    console.error('Update article error:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input data', details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to update article' },
      { status: 500 }
    );
  }
}

// DELETE /api/articles/[id] - Delete article
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const articleId = parseInt(id);
    if (isNaN(articleId)) {
      return NextResponse.json({ error: 'Invalid article ID' }, { status: 400 });
    }

    // Check if article exists
    const existingArticle = await db
      .select()
      .from(articles)
      .where(eq(articles.id, articleId))
      .limit(1);

    if (existingArticle.length === 0) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    }

    // Delete the article
    await db
      .delete(articles)
      .where(eq(articles.id, articleId));

    return NextResponse.json({ message: 'Article deleted successfully' });

  } catch (error) {
    console.error('Delete article error:', error);
    return NextResponse.json(
      { error: 'Failed to delete article' },
      { status: 500 }
    );
  }
}
