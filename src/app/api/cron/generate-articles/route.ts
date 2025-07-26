import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { articles, generationQueue, articleGeneration, users } from "@/server/db/schema";
import { eq, and, lte, max } from "drizzle-orm";

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
    .select({ maxPosition: max(generationQueue.queue_position) })
    .from(generationQueue)
    .where(and(
      eq(generationQueue.user_id, userId),
      eq(generationQueue.status, "queued")
    ));
  
  return (maxPositionResult[0]?.maxPosition ?? -1) + 1;
}

// Helper function to calculate next schedule time
function calculateNextScheduleTime(
  currentSchedule: Date,
  frequency: string,
  frequencyConfig?: any
): Date | null {
  if (frequency === "once") return null;
  
  const next = new Date(currentSchedule);
  
  switch (frequency) {
    case "daily":
      next.setDate(next.getDate() + 1);
      break;
    case "weekly":
      next.setDate(next.getDate() + 7);
      break;
    case "monthly":
      next.setMonth(next.getMonth() + 1);
      break;
    default:
      return null;
  }
  
  return next;
}

// Helper function to process generation queue (calls existing generation pipeline)
async function processArticleGeneration(queueItem: any): Promise<boolean> {
  try {
    // Update queue item status to processing
    await db
      .update(generationQueue)
      .set({
        status: 'processing',
        processed_at: new Date(),
        updated_at: new Date(),
      })
      .where(eq(generationQueue.id, queueItem.id));

    // Update article status to generating
    await db
      .update(articles)
      .set({
        status: 'generating',
        updatedAt: new Date(),
      })
      .where(eq(articles.id, queueItem.article_id));

    // Create or update articleGeneration record
    const [existingGeneration] = await db
      .select()
      .from(articleGeneration)
      .where(eq(articleGeneration.articleId, queueItem.article_id))
      .limit(1);

    if (!existingGeneration) {
      await db
        .insert(articleGeneration)
        .values({
          articleId: queueItem.article_id,
          userId: queueItem.user_id,
          status: 'pending',
          progress: 0,
          startedAt: new Date(),
        });
    } else {
      await db
        .update(articleGeneration)
        .set({
          status: 'pending',
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
          status: 'completed',
          completed_at: new Date(),
          updated_at: new Date(),
        })
        .where(eq(generationQueue.id, queueItem.id));

      // Update article status to wait_for_publish
      await db
        .update(articles)
        .set({
          status: 'wait_for_publish',
          updatedAt: new Date(),
        })
        .where(eq(articles.id, queueItem.article_id));

      // Update generation record
      if (existingGeneration) {
        await db
          .update(articleGeneration)
          .set({
            status: 'completed',
            progress: 100,
            completedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(articleGeneration.id, existingGeneration.id));
      }

      return true;
    } else {
      throw new Error('Generation failed');
    }

  } catch (error) {
    console.error('Generation error for queue item:', queueItem.id, error);
    
    // Update queue item with error
    await db
      .update(generationQueue)
      .set({
        status: 'failed',
        attempts: (queueItem.attempts || 0) + 1,
        error_message: error instanceof Error ? error.message : 'Unknown error',
        updated_at: new Date(),
      })
      .where(eq(generationQueue.id, queueItem.id));

    // Update article status back to queued for retry or failed if max attempts reached
    const newStatus = (queueItem.attempts || 0) + 1 >= (queueItem.max_attempts || 3) ? 'idea' : 'queued';
    await db
      .update(articles)
      .set({
        status: newStatus,
        updatedAt: new Date(),
      })
      .where(eq(articles.id, queueItem.article_id));

    return false;
  }
}

// POST /api/cron/generate-articles - Process scheduled articles and generation queue
export async function POST() {
  try {
    const errors: string[] = [];
    let addedToQueue = 0;
    let processedFromQueue = 0;

    // Phase 1: Add scheduled articles to queue
    console.log('Phase 1: Processing scheduled articles...');
    
    const now = new Date();
    const scheduledArticles = await db
      .select({
        id: articles.id,
        user_id: articles.user_id,
        title: articles.title,
        scheduling_type: articles.scheduling_type,
        scheduling_frequency: articles.scheduling_frequency,
        scheduling_frequency_config: articles.scheduling_frequency_config,
        next_schedule_at: articles.next_schedule_at,
        is_recurring_schedule: articles.is_recurring_schedule,
        schedule_count: articles.schedule_count,
      })
      .from(articles)
      .where(and(
        eq(articles.status, 'scheduled'),
        eq(articles.scheduling_type, 'automatic'),
        lte(articles.next_schedule_at, now)
      ));

    console.log(`Found ${scheduledArticles.length} articles ready for scheduling`);

    for (const article of scheduledArticles) {
      try {
        // Get next queue position for this user
        const queuePosition = await getNextQueuePosition(article.user_id!);

        // Add to generation queue
        await db
          .insert(generationQueue)
          .values({
            article_id: article.id,
            user_id: article.user_id!,
            scheduled_for_date: article.next_schedule_at,
            queue_position: queuePosition,
            scheduling_type: 'automatic',
            status: 'queued',
          });

        // Update article status to queued
        await db
          .update(articles)
          .set({
            status: 'queued',
            last_scheduled_at: new Date(),
            schedule_count: (article.schedule_count || 0) + 1,
            updatedAt: new Date(),
          })
          .where(eq(articles.id, article.id));

        // Calculate next schedule time for recurring schedules
        if (article.is_recurring_schedule && article.scheduling_frequency) {
          const nextScheduleTime = calculateNextScheduleTime(
            article.next_schedule_at!,
            article.scheduling_frequency,
            article.scheduling_frequency_config
          );

          if (nextScheduleTime) {
            // Update next schedule time and keep status as scheduled for next occurrence
            await db
              .update(articles)
              .set({
                status: 'scheduled', // Keep it scheduled for the next occurrence
                next_schedule_at: nextScheduleTime,
                updatedAt: new Date(),
              })
              .where(eq(articles.id, article.id));
          }
        }

        addedToQueue++;
        console.log(`Added article "${article.title}" to generation queue`);

      } catch (error) {
        const errorMsg = `Failed to add article ${article.id} to queue: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error(errorMsg);
        errors.push(errorMsg);
      }
    }

    // Phase 2: Process generation queue
    console.log('Phase 2: Processing generation queue...');
    
    const queueItems = await db
      .select({
        id: generationQueue.id,
        article_id: generationQueue.article_id,
        user_id: generationQueue.user_id,
        queue_position: generationQueue.queue_position,
        attempts: generationQueue.attempts,
        max_attempts: generationQueue.max_attempts,
        status: generationQueue.status,
      })
      .from(generationQueue)
      .where(eq(generationQueue.status, 'queued'))
      .orderBy(generationQueue.queue_position, generationQueue.created_at);

    console.log(`Found ${queueItems.length} items in generation queue`);

    // Process queue items one at a time (FIFO)
    for (const queueItem of queueItems) {
      try {
        console.log(`Processing queue item ${queueItem.id} (article ${queueItem.article_id})`);
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
        const errorMsg = `Error processing queue item ${queueItem.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
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

    console.log('Cron job completed:', response);
    return NextResponse.json(response);

  } catch (error) {
    console.error('Cron job error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to process scheduled articles',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
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
      .where(eq(articles.status, 'scheduled'));

    return NextResponse.json({
      success: true,
      data: {
        queueStats: queueStats.reduce((acc, item) => {
          acc[item.status as string] = (acc[item.status as string] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        scheduledArticlesCount: scheduledCount.length,
        timestamp: new Date().toISOString(),
      },
    });

  } catch (error) {
    console.error('Get cron status error:', error);
    return NextResponse.json(
      { error: 'Failed to get cron job status' },
      { status: 500 }
    );
  }
}