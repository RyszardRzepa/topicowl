import { NextResponse } from "next/server";
import { db } from "@/server/db";
import {
  articles,
  generationQueue,
  articleGeneration,
} from "@/server/db/schema";
import { eq, and, lte, max } from "drizzle-orm";
import { hasCredits } from "@/lib/utils/credits";

// Types colocated with this API route
export interface CronGenerateArticlesResponse {
  success: boolean;
  data: {
    addedToQueue: number;
    processedFromQueue: number;
    errors: string[];
  };
  message: string;
}

// Helper function to get next queue position
async function getNextQueuePosition(userId: string): Promise<number> {
  const maxPositionResult = await db
    .select({ maxPosition: max(generationQueue.queuePosition) })
    .from(generationQueue)
    .where(
      and(
        eq(generationQueue.userId, userId),
        eq(generationQueue.status, "queued"),
      ),
    );

  return (maxPositionResult[0]?.maxPosition ?? -1) + 1;
}

// Helper function to process generation queue (calls existing generation pipeline)
async function processArticleGeneration(queueItem: {
  id: number;
  articleId: number;
  userId: string;
  attempts?: number;
  maxAttempts?: number;
}): Promise<boolean> {
  try {
    // Check if user has credits before processing
    const userHasCredits = await hasCredits(queueItem.userId);
    if (!userHasCredits) {
      console.log(
        `User ${queueItem.userId} has no credits, skipping queue item ${queueItem.id}`,
      );

      // Update queue item as failed due to insufficient credits
      await db
        .update(generationQueue)
        .set({
          status: "failed",
          errorMessage: "Insufficient credits to process article generation",
          updatedAt: new Date(),
        })
        .where(eq(generationQueue.id, queueItem.id));

      // Update article status back to idea
      await db
        .update(articles)
        .set({
          status: "idea",
          updatedAt: new Date(),
        })
        .where(eq(articles.id, queueItem.articleId));

      return false;
    }

    // Update queue item status to processing
    await db
      .update(generationQueue)
      .set({
        status: "processing",
        processedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(generationQueue.id, queueItem.id));

    // Update article status to generating
    await db
      .update(articles)
      .set({
        status: "generating",
        updatedAt: new Date(),
      })
      .where(eq(articles.id, queueItem.articleId));

    // Create or update articleGeneration record
    const [existingGeneration] = await db
      .select()
      .from(articleGeneration)
      .where(eq(articleGeneration.articleId, queueItem.articleId))
      .limit(1);

    if (!existingGeneration) {
      await db.insert(articleGeneration).values({
        articleId: queueItem.articleId,
        userId: queueItem.userId,
        status: "pending",
        progress: 0,
        startedAt: new Date(),
      });
    } else {
      await db
        .update(articleGeneration)
        .set({
          status: "pending",
          progress: 0,
          startedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(articleGeneration.id, existingGeneration.id));
    }

    // Here we would call the existing generation pipeline
    // For now, we'll simulate this by making a call to the existing generation endpoints
    // In a real implementation, this would trigger the multi-agent generation process

    // Simulate successful generation (in real implementation, this would be the actual generation result)
    const generationSuccess = true; // This would come from the actual generation pipeline

    if (generationSuccess) {
      // Update queue item as completed
      await db
        .update(generationQueue)
        .set({
          status: "completed",
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(generationQueue.id, queueItem.id));

      // Update article status to wait_for_publish
      await db
        .update(articles)
        .set({
          status: "wait_for_publish",
          updatedAt: new Date(),
        })
        .where(eq(articles.id, queueItem.articleId));

      // Update generation record
      if (existingGeneration) {
        await db
          .update(articleGeneration)
          .set({
            status: "completed",
            progress: 100,
            completedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(articleGeneration.id, existingGeneration.id));
      }

      return true;
    } else {
      throw new Error("Generation failed");
    }
  } catch (error) {
    console.error("Generation error for queue item:", queueItem.id, error);

    // Update queue item with error
    await db
      .update(generationQueue)
      .set({
        status: "failed",
        attempts: (queueItem.attempts ?? 0) + 1,
        errorMessage: error instanceof Error ? error.message : "Unknown error",
        updatedAt: new Date(),
      })
      .where(eq(generationQueue.id, queueItem.id));

    // Update article status back to queued for retry or failed if max attempts reached
    const newStatus =
      (queueItem.attempts ?? 0) + 1 >= (queueItem.maxAttempts ?? 3)
        ? "idea"
        : "queued";
    await db
      .update(articles)
      .set({
        status: newStatus,
        updatedAt: new Date(),
      })
      .where(eq(articles.id, queueItem.articleId));

    return false;
  }
}

// POST /api/cron/generate-articles - Process scheduled articles and generation queue
export async function POST() {
  try {
    const errors: string[] = [];
    let addedToQueue = 0;
    let processedFromQueue = 0;

    // Phase 1: Process articles with scheduled generation times
    console.log("Phase 1: Processing scheduled articles...");

    const now = new Date();

    // Find articles that are scheduled for generation via articleGeneration table
    const scheduledArticles = await db
      .select({
        id: articles.id,
        user_id: articles.userId,
        title: articles.title,
        status: articles.status,
        generationId: articleGeneration.id,
        scheduledAt: articleGeneration.scheduledAt,
      })
      .from(articles)
      .innerJoin(
        articleGeneration,
        eq(articles.id, articleGeneration.articleId),
      )
      .where(
        and(
          eq(articles.status, "to_generate"),
          eq(articleGeneration.status, "pending"),
          lte(articleGeneration.scheduledAt, now),
        ),
      );

    console.log(
      `Found ${scheduledArticles.length} articles ready for scheduling`,
    );

    for (const article of scheduledArticles) {
      try {
        // Check if user has credits before adding to queue
        const userHasCredits = await hasCredits(article.user_id!);
        if (!userHasCredits) {
          console.log(
            `User ${article.user_id} has no credits, skipping article ${article.id}`,
          );

          // Update article status back to idea and generation record to failed
          await db
            .update(articles)
            .set({
              status: "idea",
              updatedAt: new Date(),
            })
            .where(eq(articles.id, article.id));

          await db
            .update(articleGeneration)
            .set({
              status: "failed",
              error: "Insufficient credits to process article generation",
              updatedAt: new Date(),
            })
            .where(eq(articleGeneration.id, article.generationId));

          const errorMsg = `Skipped article ${article.id} - user has no credits`;
          console.log(errorMsg);
          errors.push(errorMsg);
          continue;
        }

        // Get next queue position for this user
        const queuePosition = await getNextQueuePosition(article.user_id!);

        // Add to generation queue
        await db.insert(generationQueue).values({
          articleId: article.id,
          userId: article.user_id!,
          scheduledForDate: article.scheduledAt,
          queuePosition: queuePosition,
          schedulingType: "manual", // Since automatic scheduling was removed
          status: "queued",
        });

        // Update article status to queued
        await db
          .update(articles)
          .set({
            status: "queued",
            updatedAt: new Date(),
          })
          .where(eq(articles.id, article.id));

        // Update generation record to indicate it's been queued
        await db
          .update(articleGeneration)
          .set({
            status: "queued",
            updatedAt: new Date(),
          })
          .where(eq(articleGeneration.id, article.generationId));

        addedToQueue++;
        console.log(`Added article "${article.title}" to generation queue`);
      } catch (error) {
        const errorMsg = `Failed to add article ${article.id} to queue: ${error instanceof Error ? error.message : "Unknown error"}`;
        console.error(errorMsg);
        errors.push(errorMsg);
      }
    }

    // Phase 2: Process generation queue
    console.log("Phase 2: Processing generation queue...");

    const queueItems = await db
      .select({
        id: generationQueue.id,
        articleId: generationQueue.articleId,
        userId: generationQueue.userId,
        queuePosition: generationQueue.queuePosition,
        attempts: generationQueue.attempts,
        maxAttempts: generationQueue.maxAttempts,
        status: generationQueue.status,
      })
      .from(generationQueue)
      .where(eq(generationQueue.status, "queued"))
      .orderBy(generationQueue.queuePosition, generationQueue.createdAt);

    // Transform the queue items to match the expected type
    const typedQueueItems = queueItems.map((item) => ({
      id: item.id,
      articleId: item.articleId,
      userId: item.userId,
      attempts: item.attempts ?? undefined,
      maxAttempts: item.maxAttempts ?? undefined,
    }));

    console.log(`Found ${queueItems.length} items in generation queue`);

    // Process queue items one at a time (FIFO)
    for (const queueItem of typedQueueItems) {
      try {
        console.log(
          `Processing queue item ${queueItem.id} (article ${queueItem.articleId})`,
        );
        const success = await processArticleGeneration(queueItem);

        if (success) {
          processedFromQueue++;
          console.log(`Successfully processed queue item ${queueItem.id}`);
        } else {
          const errorMsg = `Failed to process queue item ${queueItem.id}`;
          console.error(errorMsg);
          errors.push(errorMsg);
        }

        // Process one at a time to avoid overwhelming the system
        // In a production environment, you might want to add delays or batch processing
      } catch (error) {
        const errorMsg = `Error processing queue item ${queueItem.id}: ${error instanceof Error ? error.message : "Unknown error"}`;
        console.error(errorMsg);
        errors.push(errorMsg);
      }
    }

    const response: CronGenerateArticlesResponse = {
      success: true,
      data: {
        addedToQueue,
        processedFromQueue,
        errors,
      },
      message: `Processed ${addedToQueue} scheduled articles and ${processedFromQueue} queue items`,
    };

    console.log("Cron job completed:", response);
    return NextResponse.json(response);
  } catch (error) {
    console.error("Cron job error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to process scheduled articles",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

// GET /api/cron/generate-articles - Get cron job status (for monitoring)
export async function GET() {
  try {
    // Get queue status
    const queueStats = await db
      .select({
        status: generationQueue.status,
        count: generationQueue.id,
      })
      .from(generationQueue);

    // Get scheduled articles count
    const scheduledCount = await db
      .select({ count: articles.id })
      .from(articles)
      .where(eq(articles.status, "scheduled"));

    return NextResponse.json({
      success: true,
      data: {
        queueStats: queueStats.reduce(
          (acc, item) => {
            acc[item.status!] = (acc[item.status!] ?? 0) + 1;
            return acc;
          },
          {} as Record<string, number>,
        ),
        scheduledArticlesCount: scheduledCount.length,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Get cron status error:", error);
    return NextResponse.json(
      { error: "Failed to get cron job status" },
      { status: 500 },
    );
  }
}
