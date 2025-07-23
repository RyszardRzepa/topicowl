import { db } from "@/server/db";
import { articles } from "@/server/db/schema";
import { eq, lte, and } from "drizzle-orm";

export interface ScheduleRequest {
  id: number;
  scheduledAt: string | null;
  status: 'idea' | 'to_generate' | 'generating' | 'wait_for_publish' | 'published';
}

export interface ScheduledArticle {
  id: number;
  title: string;
  scheduledAt: Date;
  status: 'idea' | 'to_generate' | 'generating' | 'wait_for_publish' | 'published';
}

export class SchedulingService {
  async scheduleArticle(request: ScheduleRequest) {
    if (!request.id) {
      throw new Error("Article ID is required");
    }

    const updateData: {
      status: 'idea' | 'to_generate' | 'generating' | 'wait_for_publish' | 'published';
      scheduledAt?: Date | null;
      publishedAt?: Date | null;
    } = {
      status: request.status,
    };

    if (request.status === 'wait_for_publish' && request.scheduledAt) {
      const scheduledDate = new Date(request.scheduledAt);
      if (scheduledDate <= new Date()) {
        throw new Error("Scheduled time must be in the future");
      }
      updateData.scheduledAt = scheduledDate;
    } else if (request.status === 'published') {
      updateData.publishedAt = new Date();
      updateData.scheduledAt = null;
    } else {
      updateData.scheduledAt = null;
    }

    const [updatedArticle] = await db
      .update(articles)
      .set(updateData)
      .where(eq(articles.id, request.id))
      .returning();

    if (!updatedArticle) {
      throw new Error("Article not found");
    }

    return updatedArticle;
  }

  async getScheduledArticles(): Promise<ScheduledArticle[]> {
    const now = new Date();
    const results = await db
      .select({
        id: articles.id,
        title: articles.title,
        scheduledAt: articles.scheduledAt,
        status: articles.status,
      })
      .from(articles)
      .where(
        and(
          eq(articles.status, 'wait_for_publish'),
          lte(articles.scheduledAt, now)
        )
      );

    // Filter out null scheduledAt values and cast to proper type
    return results
      .filter((article): article is ScheduledArticle => 
        article.scheduledAt !== null
      )
      .map(article => ({
        id: article.id,
        title: article.title,
        scheduledAt: article.scheduledAt!,
        status: article.status,
      }));
  }

  async publishScheduledArticles(): Promise<any[]> {
    const scheduledArticles = await this.getScheduledArticles();
    const publishedArticles = [];

    for (const article of scheduledArticles) {
      try {
        const published = await this.scheduleArticle({
          id: article.id,
          scheduledAt: null,
          status: 'published'
        });
        publishedArticles.push(published);
      } catch (error) {
        console.error(`Failed to publish article ${article.id}:`, error);
      }
    }

    return publishedArticles;
  }
}

export const schedulingService = new SchedulingService();