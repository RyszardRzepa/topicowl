import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { articles, users } from "@/server/db/schema";
import { eq, and, lte } from "drizzle-orm";
import type { ApiResponse } from '@/types';
import crypto from "crypto";

// Type for article data
type ArticleData = {
  id: number;
  user_id: string | null;
  title: string;
  description: string | null;
  keywords: unknown;
  targetAudience: string | null;
  status: "idea" | "scheduled" | "queued" | "to_generate" | "generating" | "wait_for_publish" | "published" | "deleted";
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
async function sendWebhookAsync(userId: string, article: ArticleData): Promise<void> {
  try {
    // Get user webhook configuration
    const [userConfig] = await db
      .select({
        webhook_url: users.webhook_url,
        webhook_secret: users.webhook_secret,
        webhook_enabled: users.webhook_enabled,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    // Check if webhook is configured and enabled
    if (!userConfig?.webhook_enabled || !userConfig.webhook_url) {
      return; // No webhook configured, skip
    }

    // Prepare webhook payload
    const payload = {
        id: article.id,
        title: article.title,
        slug: article.slug,
        description: article.description,
        content: article.content ?? article.draft ?? '',
        keywords: Array.isArray(article.keywords) ? article.keywords : [],
        targetAudience: article.targetAudience,
        metaDescription: article.metaDescription,
        estimatedReadTime: article.estimatedReadTime,
        seoScore: article.seoScore,
        coverImageUrl: article.coverImageUrl,
        coverImageAlt: article.coverImageAlt,
        publishedAt: article.publishedAt?.toISOString(),
        sources: Array.isArray(article.sources) ? article.sources : [],
        internalLinks: Array.isArray(article.internalLinks) ? article.internalLinks : [],
        createdAt: article.createdAt.toISOString(),
        updatedAt: article.updatedAt.toISOString(),
    };

    const payloadString = JSON.stringify(payload);
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'Contentbot-Webhook/1.0',
    };

    // Generate HMAC signature if secret is provided
    if (userConfig.webhook_secret) {
      const signature = crypto
        .createHmac('sha256', userConfig.webhook_secret)
        .update(payloadString)
        .digest('hex');
      headers['X-Webhook-Signature'] = `sha256=${signature}`;
    }

    // Send webhook with simple fetch
    try {
      const response = await fetch(userConfig.webhook_url, {
        method: 'POST',
        headers,
        body: payloadString,
      });

      if (!response.ok) {
        console.error(`Webhook delivery failed: ${response.status} ${response.statusText}`);
      } else {
        console.log(`Webhook delivered successfully for article ${article.id}`);
      }
    } catch (fetchError) {
      console.error('Webhook delivery error:', fetchError);
    }

  } catch (error) {
    console.error('Error in sendWebhookAsync:', error);
  }
}

// POST /api/articles/publish - Publish scheduled articles or single article
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({})) as { articleId?: number };
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
            eq(articles.status, 'wait_for_publish'),
            lte(articles.publishScheduledAt, now)
          )
        );
    }

    const publishedArticles = [];

    // Update each article to published status and send webhook
    for (const article of articlesToPublish) {
      // Only update status if not already published
      if (article.status !== 'published') {
        const [updatedArticle] = await db
          .update(articles)
          .set({
            status: 'published',
            content: article.draft, // Freeze draft as published content
            publishScheduledAt: null, // Clear scheduled time when publishing
            updatedAt: new Date(),
            // Set publishedAt if not already set
            ...((!article.publishedAt) && { publishedAt: new Date() })
          })
          .where(eq(articles.id, article.id))
          .returning();

        if (updatedArticle) {
          publishedArticles.push(updatedArticle);
          
          // Send webhook directly if user has one configured
          if (updatedArticle.user_id) {
            void sendWebhookAsync(updatedArticle.user_id, updatedArticle).catch((error: unknown) => {
              console.error('Failed to send webhook for article', updatedArticle.id, ':', error);
            });
          }
        }
      }
    }
    
    console.log(`Published ${publishedArticles.length} articles`);
    
    return NextResponse.json({
      success: true,
      data: {
        publishedCount: publishedArticles.length,
        publishedArticles: publishedArticles.map(a => ({ 
          id: a.id.toString(), 
          title: a.title 
        })),
      },
    } as ApiResponse);

  } catch (error) {
    console.error('Publish articles error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to publish scheduled articles' 
      } as ApiResponse,
      { status: 500 }
    );
  }
}
