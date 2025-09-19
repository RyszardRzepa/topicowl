/**
 * Parallel AI Webhook Handler
 * Handles webhook notifications from Parallel API for research task completions
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { eq, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { articleGenerations } from "@/server/db/schema";
import type { ArticleGenerationStatus } from "@/types";
import { env } from "@/env";
import { logger } from "@/lib/utils/logger";
import {
  parallelRunResultSchema,
  type ParallelResearchResponse,
} from "@/lib/services/research-service";
import crypto from "crypto";
import { continueGenerationFromPhase } from "@/lib/services/generation-orchestrator";

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
 * Converts Parallel API response to our existing ResearchResponse format
 */
export function convertParallelResponseToResearchResponse(
  parallelResponse: ParallelResearchResponse
): {
  researchData: string;
  sources: Array<{ url: string; title?: string }>;
  videos: Array<{ title: string; url: string; reason: string }>;
} {
  // Parse sources from the source_urls string
  const sources: Array<{ url: string; title?: string }> = [];
  const sourceLines = parallelResponse.source_urls.split('\n').filter(line => line.trim());
  
  const sourceRegex = /^S\d+:\s*(.+)$/;
  for (const line of sourceLines) {
    const match = sourceRegex.exec(line);
    if (match) {
      const url = match[1]?.trim();
      if (url) {
        sources.push({ url, title: undefined });
      }
    }
  }

  // Parse videos if available
  const videos: Array<{ title: string; url: string; reason: string }> = [];
  if (parallelResponse.youtube_video_url && parallelResponse.youtube_video_title) {
    videos.push({
      title: parallelResponse.youtube_video_title,
      url: parallelResponse.youtube_video_url,
      reason: parallelResponse.youtube_selection_reason || "Selected as most relevant video for the topic"
    });
  }

  // Construct comprehensive research data
  const researchTimestamp = parallelResponse.research_timestamp ?? new Date().toISOString();
  const researchData = `# Research Brief

## Executive Summary
${parallelResponse.executive_summary}

## Search Intent Analysis
**Primary Intent:** ${parallelResponse.primary_intent}
${parallelResponse.secondary_intents ? `**Secondary Intents:** ${parallelResponse.secondary_intents}` : ''}

## Key Findings
${parallelResponse.key_insights}

## Statistics & Data
${parallelResponse.statistics_data}

## Content Opportunities
${parallelResponse.content_gaps}

## Frequently Asked Questions
${parallelResponse.frequently_asked_questions}

${parallelResponse.internal_linking_suggestions ? `## Internal Linking Opportunities
${parallelResponse.internal_linking_suggestions}` : ''}

${parallelResponse.risk_assessment ? `## Risk Assessment
${parallelResponse.risk_assessment}` : ''}

---
*Research conducted: ${researchTimestamp}*`;

  return {
    researchData,
    sources,
    videos
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
  secret: string,
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
        if (
          crypto.timingSafeEqual(
            Buffer.from(sig),
            Buffer.from(expectedSignature),
          )
        ) {
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
      id: articleGenerations.id,
      articleId: articleGenerations.articleId,
      projectId: articleGenerations.projectId,
      status: articleGenerations.status,
      artifacts: articleGenerations.artifacts,
    })
    .from(articleGenerations)
    .where(sql`artifacts->>'research_run_id' = ${runId}`);

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
  const response = await fetch(
    `https://api.parallel.ai/v1/tasks/runs/${runId}/result`,
    {
      method: "GET",
      headers: {
        "x-api-key": env.PARALLEL_API_KEY,
      },
    },
  );

  if (!response.ok) {
    throw new Error(
      `Failed to fetch task result: ${response.status} ${response.statusText}`,
    );
  }

  const parsedResult = parallelRunResultSchema.parse(await response.json());

  return convertParallelResponseToResearchResponse(parsedResult.output.content);
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
  },
) {
  // Get current artifacts and merge with new research data
  const [currentRecord] = await db
    .select({ artifacts: articleGenerations.artifacts })
    .from(articleGenerations)
    .where(eq(articleGenerations.id, generationId));

  const currentArtifacts =
    (currentRecord?.artifacts as Record<string, unknown>) ?? {};
  const updatedArtifacts = {
    ...currentArtifacts,
    research: researchResult,
    research_completed_at: new Date().toISOString(),
    research_status: "completed",
  };

  // Update the article_generation record with research results
  await db
    .update(articleGenerations)
    .set({
      artifacts: updatedArtifacts,
      status: "image" as ArticleGenerationStatus,
      updatedAt: new Date(),
    })
    .where(eq(articleGenerations.id, generationId));

  logger.info(
    "[PARALLEL_WEBHOOK] Updated article generation with research results",
    {
      generationId,
      sourceCount: researchResult.sources.length,
      hasVideos: researchResult.videos.length > 0,
    },
  );
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
        { status: 400 },
      );
    }

    // Get and verify the body
    const body = await request.text();

    // Verify webhook signature
    if (
      !verifyWebhookSignature(
        webhookId,
        webhookTimestamp,
        body,
        webhookSignature,
        env.PARALLEL_WEBHOOK_SECRET,
      )
    ) {
      logger.error("[PARALLEL_WEBHOOK] Invalid webhook signature");
      return NextResponse.json(
        { error: "Invalid webhook signature" },
        { status: 401 },
      );
    }

    // Parse webhook payload
    const payload = JSON.parse(body) as ParallelWebhookPayload;

    logger.info("[PARALLEL_WEBHOOK] Received webhook", {
      type: payload.type,
      runId: payload.data.run_id,
      status: payload.data.status,
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
      logger.warn(
        "[PARALLEL_WEBHOOK] No matching article generation found for run_id",
        { run_id },
      );
      return NextResponse.json({ received: true });
    }

    if (status === "completed") {
      try {
        // Fetch the completed task result
        const researchResult = await fetchTaskResult(run_id);

        // Update article generation with research results
        await updateArticleGenerationWithResearch(
          generationRecord.id,
          researchResult,
        );

        // Continue generation process after research completion
        logger.info(
          "[PARALLEL_WEBHOOK] Research completed, triggering next phase",
          {
            generationId: generationRecord.id,
            runId: run_id,
          },
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
        logger.error(
          "[PARALLEL_WEBHOOK] Failed to fetch or process task result",
          {
            run_id,
            error: fetchError,
          },
        );

        // Update article generation with error status
        const [currentRecord] = await db
          .select({ artifacts: articleGenerations.artifacts })
          .from(articleGenerations)
          .where(eq(articleGenerations.id, generationRecord.id));

        const currentArtifacts =
          (currentRecord?.artifacts as Record<string, unknown>) ?? {};
        const updatedArtifacts = {
          ...currentArtifacts,
          research_error: {
            error: "Failed to fetch research results",
            timestamp: new Date().toISOString(),
          },
        };

        await db
          .update(articleGenerations)
          .set({
            artifacts: updatedArtifacts,
            status: "failed" as ArticleGenerationStatus,
            updatedAt: new Date(),
          })
          .where(eq(articleGenerations.id, generationRecord.id));
      }
    } else if (status === "failed") {
      logger.error("[PARALLEL_WEBHOOK] Research task failed", {
        run_id,
        error: error?.message,
        details: error?.details,
      });

      // Update article generation with failure status
      const [currentRecord] = await db
        .select({ artifacts: articleGenerations.artifacts })
        .from(articleGenerations)
        .where(eq(articleGenerations.id, generationRecord.id));

      const currentArtifacts =
        (currentRecord?.artifacts as Record<string, unknown>) ?? {};
      const updatedArtifacts = {
        ...currentArtifacts,
        research_error: {
          error: error?.message ?? "Research task failed",
          details: error?.details,
          timestamp: new Date().toISOString(),
        },
      };

      await db
        .update(articleGenerations)
        .set({
          artifacts: updatedArtifacts,
          status: "failed" as ArticleGenerationStatus,
          updatedAt: new Date(),
        })
        .where(eq(articleGenerations.id, generationRecord.id));
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    logger.error("[PARALLEL_WEBHOOK] Error processing webhook", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
