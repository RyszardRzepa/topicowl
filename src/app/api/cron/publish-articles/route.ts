import { NextResponse } from "next/server";
import { db } from "@/server/db";
import {
  articles,
  articleGenerations,
  projects,
  webhookDeliveries,
} from "@/server/db/schema";
import { eq, and, lte, desc } from "drizzle-orm";
import type {
  ArticleGenerationArtifacts,
  ValidationArtifact,
  WriteArtifact,
} from "@/types";
import crypto from "crypto";

// Types colocated with this API route
export interface CronPublishResponse {
  success: boolean;
  data: {
    publishedCount: number;
    publishedArticles: Array<{
      id: string;
      title: string;
      projectId: number;
    }>;
  };
  message: string;
}

// Type for article data - using schema enum values
type ArticleData = {
  id: number;
  userId: string | null;
  projectId: number;
  title: string;
  description: string | null;
  keywords: unknown;
  targetAudience: string | null;
  publishScheduledAt: Date | null;
  publishedAt: Date | null;
  estimatedReadTime: number | null;
  slug: string | null;
  metaDescription: string | null;
  metaKeywords: unknown;
  content: string | null;
  videos: unknown;
  seoScore?: number | null;
  coverImageUrl: string | null;
  coverImageAlt: string | null;
  createdAt: Date;
  updatedAt: Date;
  factCheckReport?: string | null;
  internalLinks?: string[];
  sources?: string[];
};

// Webhook delivery function with proper tracking - duplicated per architecture guidelines
async function deliverWebhook(article: ArticleData): Promise<void> {
  try {
    // Validate article has required fields for webhook delivery
    if (!article.projectId) {
      console.error(
        `Article ${article.id} missing projectId, cannot deliver webhook`,
      );
      return;
    }

    if (!article.title) {
      console.error(
        `Article ${article.id} missing title, cannot deliver webhook`,
      );
      return;
    }

    // Get project webhook configuration
    const [projectConfig] = await db
      .select({
        id: projects.id,
        userId: projects.userId,
        webhookUrl: projects.webhookUrl,
        webhookSecret: projects.webhookSecret,
        webhookEnabled: projects.webhookEnabled,
        webhookEvents: projects.webhookEvents,
      })
      .from(projects)
      .where(eq(projects.id, article.projectId))
      .limit(1);

    // Check if project exists
    if (!projectConfig) {
      console.error(
        `Project ${article.projectId} not found for article ${article.id}, cannot deliver webhook`,
      );
      return;
    }

    // Check if webhook is configured and enabled
    if (!projectConfig?.webhookEnabled || !projectConfig.webhookUrl) {
      console.log(`No webhook configured for project ${article.projectId}`);
      return; // No webhook configured, skip
    }

    const [generationRecord] = await db
      .select({ artifacts: articleGenerations.artifacts })
      .from(articleGenerations)
      .where(eq(articleGenerations.articleId, article.id))
      .orderBy(desc(articleGenerations.createdAt))
      .limit(1);

    const artifacts: ArticleGenerationArtifacts | undefined =
      generationRecord?.artifacts;
    const writeArtifact: WriteArtifact | undefined = artifacts?.write;
    const validationArtifact: ValidationArtifact | undefined = artifacts?.validation;
    const qualityControl = artifacts?.qualityControl;
    const relatedArticles = writeArtifact?.relatedPosts ?? [];
    const researchSources = artifacts?.research?.sources
      ? artifacts.research.sources.map((source) =>
          source.title ? `${source.title} — ${source.url}` : source.url,
        )
      : [];
    const internalLinks = writeArtifact?.internalLinks ?? [];
    const seoScore = validationArtifact?.seoScore ?? null;
    const factCheckReport = writeArtifact?.factCheckReport ?? qualityControl?.report ?? null;
    const finalContent = writeArtifact?.content ?? article.content ?? "";

    // Prepare webhook payload
    const payload = {
      id: article.id,
      title: article.title,
      slug: article.slug,
      description: article.description ?? article.metaDescription,
      content: finalContent,
      keywords: Array.isArray(article.keywords) ? article.keywords : [],
      targetAudience: article.targetAudience,
      metaDescription: article.metaDescription,
      estimatedReadTime: article.estimatedReadTime,
      seoScore,
      coverImageUrl: article.coverImageUrl,
      coverImageAlt: article.coverImageAlt,
      publishedAt: article.publishedAt?.toISOString(),
      sources: researchSources,
      internalLinks,
      factCheckReport,
      relatedArticles: relatedArticles,
      createdAt: article.createdAt.toISOString(),
      updatedAt: article.updatedAt.toISOString(),
    };

    console.log(
      `Preparing webhook delivery for article ${article.id} to ${projectConfig.webhookUrl}`,
    );

    // Create webhook delivery record
    const [webhookDelivery] = await db
      .insert(webhookDeliveries)
      .values({
        userId: projectConfig.userId,
        projectId: projectConfig.id,
        articleId: article.id,
        webhookUrl: projectConfig.webhookUrl,
        eventType: "article.published",
        status: "pending",
        attempts: 1,
        maxAttempts: 3,
        requestPayload: payload,
        retryBackoffSeconds: 30,
      })
      .returning({ id: webhookDeliveries.id });

    if (!webhookDelivery) {
      throw new Error("Failed to create webhook delivery record");
    }

    const payloadString = JSON.stringify(payload);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Webhook-Event": "article.published",
      "X-Webhook-Timestamp": Math.floor(Date.now() / 1000).toString(),
    };

    // Generate HMAC signature if secret is provided
    if (projectConfig.webhookSecret) {
      const signature = crypto
        .createHmac("sha256", projectConfig.webhookSecret)
        .update(payloadString)
        .digest("hex");
      headers["X-Webhook-Signature"] = `sha256=${signature}`;
    }

    // Attempt webhook delivery
    const startTime = Date.now();
    let responseStatus: number | undefined;
    let responseBody: string | undefined;
    let errorMessage: string | undefined;

    try {
      const response = await fetch(projectConfig.webhookUrl, {
        method: "POST",
        headers,
        body: payloadString,
        signal: AbortSignal.timeout(30000), // 30 second timeout
      });

      responseStatus = response.status;
      const deliveryTime = Date.now() - startTime;

      try {
        responseBody = await response.text();
      } catch {
        responseBody = "Unable to read response body";
      }

      if (response.ok) {
        // Update delivery record as successful
        await db
          .update(webhookDeliveries)
          .set({
            status: "success",
            responseStatus: responseStatus,
            responseBody: responseBody,
            deliveryTimeMs: deliveryTime,
            deliveredAt: new Date(),
          })
          .where(eq(webhookDeliveries.id, webhookDelivery.id));

        console.log(`Webhook delivered successfully for article ${article.id}`);
      } else {
        errorMessage = `HTTP ${response.status}: ${response.statusText}`;

        // Set up for retry
        await db
          .update(webhookDeliveries)
          .set({
            status: "retrying",
            responseStatus: responseStatus,
            responseBody: responseBody,
            deliveryTimeMs: deliveryTime,
            errorMessage: errorMessage,
            nextRetryAt: new Date(Date.now() + 30 * 1000), // Retry in 30 seconds
          })
          .where(eq(webhookDeliveries.id, webhookDelivery.id));

        console.error(
          `Webhook delivery failed for article ${article.id}: ${errorMessage}`,
        );
      }
    } catch (fetchError) {
      const deliveryTime = Date.now() - startTime;

      if (fetchError instanceof Error) {
        if (fetchError.name === "AbortError") {
          errorMessage = "Request timeout (30 seconds)";
        } else if (fetchError.name === "TypeError") {
          errorMessage = "Network error or invalid URL";
        } else {
          errorMessage = fetchError.message;
        }
      } else {
        errorMessage = "Unknown error";
      }

      // Set up for retry
      await db
        .update(webhookDeliveries)
        .set({
          status: "retrying",
          deliveryTimeMs: deliveryTime,
          errorMessage: errorMessage,
          errorDetails: {
            error:
              fetchError instanceof Error
                ? fetchError.message
                : "Unknown error",
          },
          nextRetryAt: new Date(Date.now() + 30 * 1000), // Retry in 30 seconds
        })
        .where(eq(webhookDeliveries.id, webhookDelivery.id));

      console.error(
        `Webhook delivery error for article ${article.id}:`,
        fetchError,
      );
    }
  } catch (error) {
    console.error(
      "Error in webhook delivery for article",
      article.id,
      ":",
      error,
    );
  }
}

// Core publish logic - extracts articles due for publishing and updates them
async function publishScheduledArticles(): Promise<
  CronPublishResponse["data"]
> {
  const now = new Date();
  console.log("📅 Current timestamp for comparison:", now.toISOString());

  // Find articles ready for publishing (no user filtering - system-wide)
  // Explicitly select all fields needed for publishing and webhook delivery
  const articlesToPublish = await db
    .select({
      id: articles.id,
      userId: articles.userId,
      projectId: articles.projectId,
      title: articles.title,
      description: articles.description,
      keywords: articles.keywords,
      targetAudience: articles.targetAudience,
      status: articles.status,
      publishScheduledAt: articles.publishScheduledAt,
      publishedAt: articles.publishedAt,
      estimatedReadTime: articles.estimatedReadTime,
      kanbanPosition: articles.kanbanPosition,
      slug: articles.slug,
      metaDescription: articles.metaDescription,
      metaKeywords: articles.metaKeywords,
      content: articles.content,
      videos: articles.videos,
      coverImageUrl: articles.coverImageUrl,
      coverImageAlt: articles.coverImageAlt,
      createdAt: articles.createdAt,
      updatedAt: articles.updatedAt,
    })
    .from(articles)
    .where(
      and(
        eq(articles.status, "scheduled"),
        lte(articles.publishScheduledAt, now),
      ),
    );

  console.log(
    `📋 Found ${articlesToPublish.length} articles ready for publishing`,
  );
  
  if (articlesToPublish.length > 0) {
    console.log("📄 Articles to publish:", articlesToPublish.map(a => ({ id: a.id, title: a.title, scheduledAt: a.publishScheduledAt })));
  }

  const publishedArticles = [];

  // Update each article to published status and send webhook
  for (const article of articlesToPublish) {
    try {
      // Validate article has required data for publishing
      if (!article.title || !article.projectId) {
        console.error(
          `Article ${article.id} missing required data: title=${article.title}, projectId=${article.projectId}`,
        );
        continue;
      }

      const [generationRecord] = await db
        .select({
          status: articleGenerations.status,
          artifacts: articleGenerations.artifacts,
        })
        .from(articleGenerations)
        .where(eq(articleGenerations.articleId, article.id))
        .orderBy(desc(articleGenerations.createdAt))
        .limit(1);

      if (generationRecord?.status !== "completed") {
        continue;
      }

      const artifacts: ArticleGenerationArtifacts | undefined =
        generationRecord?.artifacts;
      const finalContent = artifacts?.write?.content ?? article.content ?? "";

      console.log(
        `Publishing article: ${article.title} (ID: ${article.id}, Project: ${article.projectId})`,
      );

      // Atomic update with concurrency protection - only update if still scheduled
      // Explicitly return all fields needed for webhook delivery
      const [updatedArticle] = await db
        .update(articles)
        .set({
          content: finalContent,
          publishScheduledAt: null,
          updatedAt: new Date(),
          ...(!article.publishedAt && { publishedAt: new Date() }),
          status: "published",
        })
        .where(and(eq(articles.id, article.id), eq(articles.status, "scheduled")))
        .returning({
          id: articles.id,
          userId: articles.userId,
          projectId: articles.projectId,
          title: articles.title,
          description: articles.description,
          keywords: articles.keywords,
          targetAudience: articles.targetAudience,
          publishScheduledAt: articles.publishScheduledAt,
          publishedAt: articles.publishedAt,
          estimatedReadTime: articles.estimatedReadTime,
          slug: articles.slug,
          metaDescription: articles.metaDescription,
          metaKeywords: articles.metaKeywords,
          content: articles.content,
          videos: articles.videos,
          coverImageUrl: articles.coverImageUrl,
          coverImageAlt: articles.coverImageAlt,
          createdAt: articles.createdAt,
          updatedAt: articles.updatedAt,
        });

      if (updatedArticle) {
        publishedArticles.push(updatedArticle);
        void deliverWebhook(updatedArticle).catch((error: unknown) => {
          console.error(
            "Failed to deliver webhook for article",
            updatedArticle.id,
            ":",
            error,
          );
        });
      } else {
        console.log(
          `Article ${article.id} was already processed by another instance or status changed`,
        );
      }
    } catch (error) {
      console.error(
        `Error publishing article ${article.id} (${article.title}):`,
        error,
      );
    }
  }

  return {
    publishedCount: publishedArticles.length,
    publishedArticles: publishedArticles.map((a) => ({
      id: a.id.toString(),
      title: a.title,
      projectId: a.projectId,
    })),
  };
}

// GET /api/cron/publish-articles - Vercel Cron calls this with GET
export async function GET() {
  try {
    console.log("🚀 CRON JOB STARTED - Publish Articles:", new Date().toISOString());
    console.log("🔍 Environment check - Node env:", process.env.NODE_ENV);
    console.log("📊 Starting to look for scheduled articles...");

    const result = await publishScheduledArticles();

    console.log(
      `✅ CRON JOB COMPLETED: ${result.publishedCount} articles published`,
    );
    console.log("🏁 Cron job finished successfully at:", new Date().toISOString());

    return NextResponse.json({
      success: true,
      data: result,
      message: `Published ${result.publishedCount} scheduled articles`,
    } as CronPublishResponse);
  } catch (error) {
    console.error("❌ CRON JOB ERROR - Publish Articles:", error);
    console.error("🚨 Error details:", JSON.stringify(error, null, 2));
    return NextResponse.json(
      {
        success: false,
        data: { publishedCount: 0, publishedArticles: [] },
        message: "Failed to publish scheduled articles",
      } as CronPublishResponse,
      { status: 500 },
    );
  }
}