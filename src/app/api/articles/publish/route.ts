import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { articles, articleGeneration, projects } from "@/server/db/schema";
import { eq, and, lte } from "drizzle-orm";
import type { ApiResponse } from "@/types";
import crypto from "crypto";

// Type for article data
type ArticleData = {
  id: number;
  userId: string | null;
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

// Webhook delivery function
async function sendWebhookAsync(
  userId: string,
  article: ArticleData,
): Promise<void> {
  try {
    // Get project webhook configuration through the article's project
    const [projectConfig] = await db
      .select({
        webhookUrl: projects.webhookUrl,
        webhookSecret: projects.webhookSecret,
        webhookEnabled: projects.webhookEnabled,
      })
      .from(projects)
      .innerJoin(articles, eq(articles.projectId, projects.id))
      .where(eq(articles.id, article.id))
      .limit(1);

    // Check if webhook is configured and enabled
    if (!projectConfig?.webhookEnabled || !projectConfig.webhookUrl) {
      return; // No webhook configured, skip
    }

    // Get related articles from articleGeneration table
    let relatedArticles: string[] = [];
    try {
      const [generationRecord] = await db
        .select({ relatedArticles: articleGeneration.relatedArticles })
        .from(articleGeneration)
        .where(eq(articleGeneration.articleId, article.id))
        .limit(1);

      relatedArticles = generationRecord?.relatedArticles ?? [];
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

    const payloadString = JSON.stringify(payload);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "Contentbot-Webhook/1.0",
    };

    // Generate HMAC signature if secret is provided
    if (projectConfig.webhookSecret) {
      const signature = crypto
        .createHmac("sha256", projectConfig.webhookSecret)
        .update(payloadString)
        .digest("hex");
      headers["X-Webhook-Signature"] = `sha256=${signature}`;
    }

    // Send webhook with simple fetch
    try {
      const response = await fetch(projectConfig.webhookUrl, {
        method: "POST",
        headers,
        body: payloadString,
      });

      if (!response.ok) {
        console.error(
          `Webhook delivery failed: ${response.status} ${response.statusText}`,
        );
      } else {
        console.log(`Webhook delivered successfully for article ${article.id}`);
      }
    } catch (fetchError) {
      console.error("Webhook delivery error:", fetchError);
    }
  } catch (error) {
    console.error("Error in sendWebhookAsync:", error);
  }
}

// POST /api/articles/publish - Publish scheduled articles or single article
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as { articleId?: number };
    const { articleId } = body;

    let articlesToPublish;

    if (articleId) {
      // Single article publishing (from manual publish button)
      articlesToPublish = await db
        .select()
        .from(articles)
        .where(eq(articles.id, articleId))
        .limit(1);
    } else {
      // Scheduled publishing (from cron job)
      const now = new Date();
      articlesToPublish = await db
        .select()
        .from(articles)
        .where(
          and(
            eq(articles.status, "wait_for_publish"),
            lte(articles.publishScheduledAt, now),
          ),
        );
    }

    const publishedArticles = [];

    // Update each article to published status and send webhook
    for (const article of articlesToPublish) {
      // Only update status if not already published
      if (article.status !== "published") {
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
          publishedArticles.push(updatedArticle);

          // Send webhook directly if user has one configured
          if (updatedArticle.userId) {
            void sendWebhookAsync(updatedArticle.userId, updatedArticle).catch(
              (error: unknown) => {
                console.error(
                  "Failed to send webhook for article",
                  updatedArticle.id,
                  ":",
                  error,
                );
              },
            );
          }
        }
      }
    }

    console.log(`Published ${publishedArticles.length} articles`);

    return NextResponse.json({
      success: true,
      data: {
        publishedCount: publishedArticles.length,
        publishedArticles: publishedArticles.map((a) => ({
          id: a.id.toString(),
          title: a.title,
        })),
      },
    } as ApiResponse);
  } catch (error) {
    console.error("Publish articles error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to publish scheduled articles",
      } as ApiResponse,
      { status: 500 },
    );
  }
}
