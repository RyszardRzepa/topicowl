import { NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { db } from "@/server/db";
import {
  generationQueue,
  articles,
  articleGeneration,
} from "@/server/db/schema";
import { and, eq, lte } from "drizzle-orm";
import {
  validateAndSetupGeneration,
  generateArticle,
  createOrResetArticleGeneration,
  claimArticleForGeneration,
} from "@/lib/services/generation-orchestrator";

type ProcessResult = {
  success: boolean;
  data: {
    processed: number;
    started: number;
    failed: number;
    queueItemIds: number[];
  };
  message: string;
};

async function processDueQueue(): Promise<ProcessResult["data"]> {
  const now = new Date();

  // Find due queue items (status queued, scheduledForDate <= now)
  const due = await db
    .select({
      id: generationQueue.id,
      articleId: generationQueue.articleId,
      userId: generationQueue.userId,
      scheduledForDate: generationQueue.scheduledForDate,
      attempts: generationQueue.attempts,
      articleStatus: articles.status,
    })
    .from(generationQueue)
    .innerJoin(articles, eq(articles.id, generationQueue.articleId))
    .where(
      and(
        eq(generationQueue.status, "queued"),
        lte(generationQueue.scheduledForDate, now),
      ),
    )
    .orderBy(generationQueue.queuePosition, generationQueue.createdAt);

  let started = 0;
  let failed = 0;
  const processedIds: number[] = [];

  for (const item of due) {
    processedIds.push(item.id);
    try {
      // Validate credits/access first using current status
      const context = await validateAndSetupGeneration(
        item.userId,
        String(item.articleId),
        false,
      );

      // Atomic claim to close race with other triggers
      const claim = await claimArticleForGeneration(item.articleId);

      if (claim !== "claimed") {
        // Someone else took it or state changed; clean up this queue item
        await db.delete(generationQueue).where(eq(generationQueue.id, item.id));
        continue;
      }

      // Ensure a generation record exists, set anchor time for calendar UX
      const genRecord = await createOrResetArticleGeneration(
        item.articleId,
        item.userId,
      );
      await db
        .update(articleGeneration)
        .set({ scheduledAt: item.scheduledForDate ?? now, updatedAt: new Date() })
        .where(eq(articleGeneration.id, genRecord.id));

      // Remove from queue (calendar hides queued blocks; generating UI uses scheduledAt anchor)
      await db.delete(generationQueue).where(eq(generationQueue.id, item.id));

      // Kick off generation in background
      waitUntil(generateArticle(context));
      started++;
    } catch (error) {
      // Mark queue item as failed with an error message but keep it for visibility
      failed++;
      const message = error instanceof Error ? error.message : "Unknown error";
      await db
        .update(generationQueue)
        .set({
          status: "failed",
          attempts: (item.attempts ?? 0) + 1,
          errorMessage: message,
          updatedAt: new Date(),
        })
        .where(eq(generationQueue.id, item.id));
    }
  }

  return { processed: due.length, started, failed, queueItemIds: processedIds };
}

// GET /api/cron/process-generation-queue - Vercel Cron trigger
export async function GET() {
  try {
    const result = await processDueQueue();
    return NextResponse.json({
      success: true,
      data: result,
      message: `Processed ${result.processed} due items; started ${result.started}, failed ${result.failed}`,
    } as ProcessResult);
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        data: { processed: 0, started: 0, failed: 0, queueItemIds: [] },
        message: "Failed to process generation queue",
      } as ProcessResult,
      { status: 500 },
    );
  }
}

// POST /api/cron/process-generation-queue - Manual trigger
export async function POST() {
  return GET();
}
