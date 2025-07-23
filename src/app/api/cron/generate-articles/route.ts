import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { articles } from "@/server/db/schema";
import { eq, lte, and } from "drizzle-orm";
import { articleGenerationService } from "@/lib/services/article-generation-service";

export async function POST(_req: NextRequest) {
  try {
    // Find articles scheduled for generation
    const now = new Date();
    const scheduledArticles = await db
      .select()
      .from(articles)
      .where(
        and(
          eq(articles.status, 'to_generate'),
          lte(articles.generationScheduledAt, now)
        )
      );

    const generatedArticles = [];
    const errors = [];

    for (const article of scheduledArticles) {
      try {
        // Update status to generating
        await db
          .update(articles)
          .set({
            status: 'generating',
            generationStartedAt: new Date(),
            generationScheduledAt: null, // Clear the schedule
          })
          .where(eq(articles.id, article.id));

        // Start generation process in background
        const generationPromise = articleGenerationService.generateArticle(article.id);
        generationPromise.catch(error => {
          console.error(`Background generation failed for article ${article.id}:`, error);
        });

        generatedArticles.push({
          id: article.id,
          title: article.title,
          scheduledAt: article.generationScheduledAt,
        });

        console.log(`Started generation for article: ${article.title} (ID: ${article.id})`);
      } catch (error) {
        console.error(`Failed to start generation for article ${article.id}:`, error);
        errors.push({
          articleId: article.id,
          title: article.title,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    console.log(`Cron job completed: ${generatedArticles.length} articles started generation, ${errors.length} errors`);

    return NextResponse.json({
      success: true,
      generatedCount: generatedArticles.length,
      generatedArticles,
      errors,
    });

  } catch (error) {
    console.error('Generate articles cron job error:', error);
    return NextResponse.json(
      { error: 'Failed to process scheduled article generation' },
      { status: 500 }
    );
  }
}
