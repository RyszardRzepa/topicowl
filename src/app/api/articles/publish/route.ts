import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/server/db";
import {
  articles,
  articleGeneration,
  projects,
  webhookDeliveries,
  users,
} from "@/server/db/schema";
import { eq, and, desc } from "drizzle-orm";
import type { ApiResponse } from "@/types";
import crypto from "crypto";

// Type for article data - updated to include failed status
type ArticleData = {
  id: number;
  userId: string | null;
  projectId: number;
  title: string;
  description: string | null;
  keywords: unknown;
  targetAudience: string | null;
  status:
    | "idea"
    | "scheduled"
    | "queued"
    | "to_generate"
    | "generating"
    | "wait_for_publish"
    | "published"
    | "failed"
    | "deleted";
  publishScheduledAt: Date | null;
  publishedAt: Date | null;
  estimatedReadTime: number | null;
  kanbanPosition: number;
  slug: string | null;
  metaDescription: string | null;
  metaKeywords: unknown;
  draft: string | null;
  content: string | null; // Final published content
  videos: unknown; // YouTube video embeds
  factCheckReport: unknown;
  seoScore: number | null;
  internalLinks: unknown;
  sources: unknown;
  coverImageUrl: string | null;
  coverImageAlt: string | null;
  createdAt: Date;
  updatedAt: Date;
};

// Webhook delivery function with proper tracking
async function deliverWebhook(article: ArticleData): Promise<void> {
  try {
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

    // Check if webhook is configured and enabled
    if (!projectConfig?.webhookEnabled || !projectConfig.webhookUrl) {
      console.log(`No webhook configured for project ${article.projectId}`);
      return; // No webhook configured, skip
    }

    // Get related articles from articleGeneration table
    let relatedArticles: string[] = [];
    try {
      const [generationRecord] = await db
        .select({ relatedArticles: articleGeneration.relatedArticles })
        .from(articleGeneration)
        .where(eq(articleGeneration.articleId, article.id))
        .orderBy(desc(articleGeneration.createdAt))
        .limit(1);

      relatedArticles = Array.isArray(generationRecord?.relatedArticles)
        ? generationRecord.relatedArticles
        : [];
    } catch (error) {
      console.error("Error fetching related articles for webhook:", error);
      // Continue without related articles
    }

    // Prepare webhook payload
    const payload = {
      id: article.id,
      title: article.title,
      slug: article.slug,
      description: article.description ?? article.metaDescription,
      content: article.content ?? article.draft ?? "",
      keywords: Array.isArray(article.keywords) ? article.keywords : [],
      targetAudience: article.targetAudience,
      metaDescription: article.metaDescription,
      estimatedReadTime: article.estimatedReadTime,
      seoScore: article.seoScore,
      coverImageUrl: article.coverImageUrl,
      coverImageAlt: article.coverImageAlt,
      publishedAt: article.publishedAt?.toISOString(),
      sources: Array.isArray(article.sources) ? article.sources : [],
      internalLinks: Array.isArray(article.internalLinks)
        ? article.internalLinks
        : [],
      relatedArticles: relatedArticles,
      createdAt: article.createdAt.toISOString(),
      updatedAt: article.updatedAt.toISOString(),
    };

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

// POST /api/articles/publish - Manual publish single article
// Note: Scheduled publishing is handled by /api/cron/publish-articles cron job
export async function POST(req: NextRequest) {
  try {
    // Authentication and authorization
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify user exists in database
    const [userRecord] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, userId));
    if (!userRecord) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      articleId?: number;
      projectId?: number;
    };
    const { articleId, projectId } = body;

    // Require articleId and projectId for manual publishing
    if (!articleId || !projectId) {
      return NextResponse.json(
        { error: "articleId and projectId are required" },
        { status: 400 },
      );
    }

    // Verify project ownership
    const [projectRecord] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(
        and(eq(projects.id, projectId), eq(projects.userId, userRecord.id)),
      );
    if (!projectRecord) {
      return NextResponse.json(
        { error: "Project not found or access denied" },
        { status: 404 },
      );
    }

    // Get the article and verify ownership
    const articlesToPublish = await db
      .select()
      .from(articles)
      .innerJoin(projects, eq(articles.projectId, projects.id))
      .where(
        and(
          eq(articles.id, articleId),
          eq(projects.userId, userRecord.id), // Ensure user owns the project
        ),
      )
      .limit(1);

    if (articlesToPublish.length === 0) {
      return NextResponse.json(
        { error: "Article not found or access denied" },
        { status: 404 },
      );
    }

    // Extract just the article data
    const article = articlesToPublish[0]!.articles;

    // Only update status if not already published
    if (article.status === "published") {
      return NextResponse.json({
        success: true,
        data: {
          publishedCount: 0,
          publishedArticles: [],
        },
        message: "Article is already published",
      } as ApiResponse);
    }

    // Update article to published status
    const [updatedArticle] = await db
      .update(articles)
      .set({
        status: "published",
        content: article.draft, // Freeze draft as published content
        publishScheduledAt: null, // Clear scheduled time when publishing
        updatedAt: new Date(),
        // Set publishedAt if not already set
        ...(!article.publishedAt && { publishedAt: new Date() }),
      })
      .where(eq(articles.id, article.id))
      .returning();

    if (updatedArticle) {
      console.log(
        `Manually published article: ${updatedArticle.title} (ID: ${updatedArticle.id})`,
      );

      // Send webhook with proper tracking
      void deliverWebhook(updatedArticle).catch((error: unknown) => {
        console.error(
          "Failed to deliver webhook for article",
          updatedArticle.id,
          ":",
          error,
        );
      });

      return NextResponse.json({
        success: true,
        data: {
          publishedCount: 1,
          publishedArticles: [
            {
              id: updatedArticle.id.toString(),
              title: updatedArticle.title,
            },
          ],
        },
        message: "Article published successfully",
      } as ApiResponse);
    } else {
      return NextResponse.json(
        {
          success: false,
          error: "Failed to update article status",
        } as ApiResponse,
        { status: 500 },
      );
    }
  } catch (error) {
    console.error("Manual publish article error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to publish article",
      } as ApiResponse,
      { status: 500 },
    );
  }
}
