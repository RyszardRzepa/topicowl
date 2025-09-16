/**
 * Parallel AI Webhook Handler
 * Handles webhook notifications from Parallel API for research task completions
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { eq, sql } from "drizzle-orm";
import { db } from "@/server/db";
import {
  articleGeneration,
  type ArticleGenerationStatus,
} from "@/server/db/schema";
import { env } from "@/env";
import { logger } from "@/lib/utils/logger";
import { convertParallelResponseToResearchResponse, type ParallelResearchResponse } from "@/lib/services/research-service";
import crypto from "crypto";

export const maxDuration = 800;

// Parallel webhook payload structure
interface ParallelWebhookPayload {
  timestamp: string;
  type: "task_run.status";
  data: {
    run_id: string;
    status: "completed" | "failed";
    is_active: boolean;
    warnings?: string | null;
    error?: {
      message: string;
      details?: string;
    } | null;
    processor: string;
    metadata?: {
      article_title?: string;
      keywords?: string;
      timestamp?: string;
    };
    created_at: string;
    modified_at: string;
  };
}

/**
 * Verify webhook signature using HMAC-SHA256
 */
function verifyWebhookSignature(
  webhookId: string,
  webhookTimestamp: string,
  body: string,
  signature: string,
  secret: string
): boolean {
  try {
    // Construct the payload string as per Parallel docs
    const payload = `${webhookId}.${webhookTimestamp}.${body}`;
    
    // Compute HMAC signature
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(payload, "utf8")
      .digest("base64");

    // Parse the signature header - can be space-delimited with multiple v1,signature entries
    const signatureParts = signature.split(" ");
    
    for (const part of signatureParts) {
      const [version, sig] = part.split(",", 2);
      if (version === "v1" && sig) {
        // Use constant-time comparison
        if (crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSignature))) {
          return true;
        }
      }
    }

    return false;
  } catch (error) {
    logger.error("[PARALLEL_WEBHOOK] Error verifying signature", error);
    return false;
  }
}

/**
 * Find article generation record by run_id in metadata
 */
async function findArticleGenerationByRunId(runId: string) {
  const results = await db
    .select({
      id: articleGeneration.id,
      articleId: articleGeneration.articleId,
      projectId: articleGeneration.projectId,
      status: articleGeneration.status,
      artifacts: articleGeneration.artifacts,
    })
    .from(articleGeneration)
    .where(
      sql`artifacts->>'research_run_id' = ${runId} AND status = 'researching'`,
    );

  return results.length > 0 ? results[0] : null;
}

/**
 * Fetch completed task result from Parallel API
 */
async function fetchTaskResult(runId: string): Promise<{
  researchData: string;
  sources: Array<{ url: string; title?: string }>;
  videos: Array<{ title: string; url: string; reason: string }>;
}> {
  const response = await fetch(`https://api.parallel.ai/v1/tasks/runs/${runId}/result`, {
    method: "GET",
    headers: {
      "x-api-key": env.PARALLEL_API_KEY as string
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch task result: ${response.status} ${response.statusText}`);
  }

  const result = await response.json() as {
    output: {
      content: ParallelResearchResponse;
    };
  };

  return convertParallelResponseToResearchResponse(result.output.content);
}

/**
 * Update article generation with research results
 */
async function updateArticleGenerationWithResearch(
  generationId: number,
  researchResult: {
    researchData: string;
    sources: Array<{ url: string; title?: string }>;
    videos: Array<{ title: string; url: string; reason: string }>;
  }
) {
  // Get current artifacts and merge with new research data
  const [currentRecord] = await db
    .select({ artifacts: articleGeneration.artifacts })
    .from(articleGeneration)
    .where(eq(articleGeneration.id, generationId));

  const currentArtifacts = (currentRecord?.artifacts as Record<string, unknown>) ?? {};
  const updatedArtifacts = {
    ...currentArtifacts,
    research: researchResult,
    research_completed_at: new Date().toISOString(),
    research_status: "completed",
  };

  // Update the article_generation record with research results
  await db
    .update(articleGeneration)
    .set({
      artifacts: updatedArtifacts,
      status: "outline" as ArticleGenerationStatus,
      updatedAt: new Date(),
    })
    .where(eq(articleGeneration.id, generationId));

  logger.info("[PARALLEL_WEBHOOK] Updated article generation with research results", {
    generationId,
    sourceCount: researchResult.sources.length,
    hasVideos: researchResult.videos.length > 0
  });
}

export async function POST(request: NextRequest) {
  try {
    // Get webhook headers
    const webhookId = request.headers.get("webhook-id");
    const webhookTimestamp = request.headers.get("webhook-timestamp");
    const webhookSignature = request.headers.get("webhook-signature");

    if (!webhookId || !webhookTimestamp || !webhookSignature) {
      logger.warn("[PARALLEL_WEBHOOK] Missing required webhook headers");
      return NextResponse.json(
        { error: "Missing required webhook headers" },
        { status: 400 }
      );
    }

    // Get and verify the body
    const body = await request.text();
    
    // Verify webhook signature
    if (!verifyWebhookSignature(
      webhookId,
      webhookTimestamp,
      body,
      webhookSignature,
      env.PARALLEL_WEBHOOK_SECRET as string
    )) {
      logger.error("[PARALLEL_WEBHOOK] Invalid webhook signature");
      return NextResponse.json(
        { error: "Invalid webhook signature" },
        { status: 401 }
      );
    }

    // Parse webhook payload
    const payload = JSON.parse(body) as ParallelWebhookPayload;

    logger.info("[PARALLEL_WEBHOOK] Received webhook", {
      type: payload.type,
      runId: payload.data.run_id,
      status: payload.data.status
    });

    // Only handle task_run.status events
    if (payload.type !== "task_run.status") {
      logger.debug("[PARALLEL_WEBHOOK] Ignoring non-status webhook event");
      return NextResponse.json({ received: true });
    }

    const { run_id, status, error } = payload.data;

    // Find the corresponding article generation
    const generationRecord = await findArticleGenerationByRunId(run_id);

    if (!generationRecord) {
      logger.warn("[PARALLEL_WEBHOOK] No matching article generation found for run_id", { run_id });
      return NextResponse.json({ received: true });
    }

    if (status === "completed") {
      try {
        // Fetch the completed task result
        const researchResult = await fetchTaskResult(run_id);

        // Update article generation with research results
        await updateArticleGenerationWithResearch(generationRecord.id, researchResult);

        // Continue generation process after research completion
        logger.info("[PARALLEL_WEBHOOK] Research completed, triggering next phase", {
          generationId: generationRecord.id,
          runId: run_id
        });

        // Call generation continuation function directly (no HTTP/auth needed)
        const { continueGenerationFromPhase } = await import(
          "@/lib/services/generation-orchestrator"
        );

        waitUntil(
          (async () => {
            await continueGenerationFromPhase(
              generationRecord.id,
              "image",
              researchResult,
            );
          })(),
        );

      } catch (fetchError) {
        logger.error("[PARALLEL_WEBHOOK] Failed to fetch or process task result", {
          run_id,
          error: fetchError
        });

        // Update article generation with error status
        const [currentRecord] = await db
          .select({ artifacts: articleGeneration.artifacts })
          .from(articleGeneration)
          .where(eq(articleGeneration.id, generationRecord.id));

        const currentArtifacts = (currentRecord?.artifacts as Record<string, unknown>) ?? {};
        const updatedArtifacts = {
          ...currentArtifacts,
          research_error: {
            error: "Failed to fetch research results",
            timestamp: new Date().toISOString(),
          },
        };

        await db
          .update(articleGeneration)
          .set({
            artifacts: updatedArtifacts,
            status: "research_failed" as ArticleGenerationStatus,
            updatedAt: new Date(),
          })
          .where(eq(articleGeneration.id, generationRecord.id));
      }
    } else if (status === "failed") {
      logger.error("[PARALLEL_WEBHOOK] Research task failed", {
        run_id,
        error: error?.message,
        details: error?.details
      });

      // Update article generation with failure status
      const [currentRecord] = await db
        .select({ artifacts: articleGeneration.artifacts })
        .from(articleGeneration)
        .where(eq(articleGeneration.id, generationRecord.id));

      const currentArtifacts = (currentRecord?.artifacts as Record<string, unknown>) ?? {};
      const updatedArtifacts = {
        ...currentArtifacts,
        research_error: {
          error: error?.message ?? "Research task failed",
          details: error?.details,
          timestamp: new Date().toISOString(),
        },
      };

      await db
        .update(articleGeneration)
        .set({
          artifacts: updatedArtifacts,
          status: "research_failed" as ArticleGenerationStatus,
          updatedAt: new Date(),
        })
        .where(eq(articleGeneration.id, generationRecord.id));
    }

    return NextResponse.json({ received: true });

  } catch (error) {
    logger.error("[PARALLEL_WEBHOOK] Error processing webhook", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}