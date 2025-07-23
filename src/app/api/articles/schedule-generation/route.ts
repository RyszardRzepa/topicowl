import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { articles } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

const scheduleGenerationSchema = z.object({
  articleId: z.number(),
  generationScheduledAt: z.string().datetime(),
});

// POST /api/articles/schedule-generation - Schedule article generation
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as unknown;
    const { articleId, generationScheduledAt } = scheduleGenerationSchema.parse(body);

    const scheduledDate = new Date(generationScheduledAt);
    if (scheduledDate <= new Date()) {
      return NextResponse.json(
        { error: 'Scheduled time must be in the future' },
        { status: 400 }
      );
    }

    // Check if article exists
    const [existingArticle] = await db
      .select()
      .from(articles)
      .where(eq(articles.id, articleId))
      .limit(1);

    if (!existingArticle) {
      return NextResponse.json(
        { error: 'Article not found' },
        { status: 404 }
      );
    }

    // Update the article with generation schedule
    const [updatedArticle] = await db
      .update(articles)
      .set({
        generationScheduledAt: scheduledDate,
        status: 'to_generate', // Ensure it's in the right status
        updatedAt: new Date(),
      })
      .where(eq(articles.id, articleId))
      .returning();

    return NextResponse.json({
      success: true,
      article: updatedArticle,
      message: `Article generation scheduled for ${scheduledDate.toLocaleString()}`,
    });

  } catch (error) {
    console.error('Schedule generation error:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input data', details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to schedule article generation' },
      { status: 500 }
    );
  }
}
