import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/server/db";
import { articles, users, articleGeneration } from "@/server/db/schema";
import { eq, and, ne } from "drizzle-orm";
import type { ArticleStatus } from "@/types";

// Types colocated with this API route
export type DatabaseArticle = {
  id: number;
  user_id: string | null;
  title: string;
  description: string | null;
  keywords: unknown;
  targetAudience: string | null;
  status: ArticleStatus;
  scheduledAt?: Date | null; // For backward compatibility
  publishScheduledAt: Date | null;
  publishedAt: Date | null;
  estimatedReadTime: number | null;
  kanbanPosition: number;
  metaDescription: string | null;
  outline: unknown;
  draft: string | null;
  content: string | null;
  factCheckReport: unknown;
  seoScore: number | null;
  internalLinks: unknown;
  sources: unknown;
  coverImageUrl: string | null;
  coverImageAlt: string | null;
  createdAt: Date;
  updatedAt: Date;
  // Generation tracking fields
  generationScheduledAt: Date | null;
  generationStatus: string | null;
  generationProgress: number | null;
  generationError: string | null;
};

export interface KanbanColumn {
  id: string;
  title: string;
  status: Exclude<ArticleStatus, 'deleted'>; // Exclude deleted from kanban columns
  articles: DatabaseArticle[];
  color: string;
}

export interface KanbanBoard {
  columns: KanbanColumn[];
}

// GET /api/articles/board - Get kanban board with articles organized by status
export async function GET(_req: NextRequest) {
  try {
    // Get current user from Clerk
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user record from database
    const [userRecord] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerk_user_id, userId))
      .limit(1);

    if (!userRecord) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Get only this user's articles with generation tracking info
    const allArticles = await db
      .select({
        id: articles.id,
        user_id: articles.user_id,
        title: articles.title,
        description: articles.description,
        keywords: articles.keywords,
        targetAudience: articles.targetAudience,
        status: articles.status,
        publishScheduledAt: articles.publishScheduledAt,
        publishedAt: articles.publishedAt,
        estimatedReadTime: articles.estimatedReadTime,
        kanbanPosition: articles.kanbanPosition,
        metaDescription: articles.metaDescription,
        outline: articles.outline,
        draft: articles.draft,
        content: articles.content,
        factCheckReport: articles.factCheckReport,
        seoScore: articles.seoScore,
        internalLinks: articles.internalLinks,
        sources: articles.sources,
        coverImageUrl: articles.coverImageUrl,
        coverImageAlt: articles.coverImageAlt,
        createdAt: articles.createdAt,
        updatedAt: articles.updatedAt,
        // Generation tracking fields
        generationScheduledAt: articleGeneration.scheduledAt,
        generationStatus: articleGeneration.status,
        generationProgress: articleGeneration.progress,
        generationError: articleGeneration.error,
      })
      .from(articles)
      .leftJoin(articleGeneration, eq(articles.id, articleGeneration.articleId))
      .where(
        and(
          eq(articles.user_id, userRecord.id),
          ne(articles.status, "deleted")
        )
      )
      .orderBy(articles.kanbanPosition, articles.createdAt);

    // Sanitize the articles to ensure JSON fields have proper defaults
    const sanitizedArticles = allArticles.map(article => ({
      ...article,
      keywords: article.keywords ?? [],
      outline: article.outline ?? null,
      factCheckReport: article.factCheckReport ?? {},
      internalLinks: article.internalLinks ?? [],
      sources: article.sources ?? [],
      scheduledAt: article.publishScheduledAt, // Backward compatibility mapping
    }));

    // Define kanban columns
    const columns: KanbanColumn[] = [
      {
        id: 'idea',
        title: 'Ideas',
        status: 'idea',
        articles: [],
        color: '#6B7280', // gray
      },
      {
        id: 'scheduled',
        title: 'Scheduled',
        status: 'scheduled',
        articles: [],
        color: '#6366F1', // indigo
      },
      {
        id: 'queued',
        title: 'Generation Queue',
        status: 'queued',
        articles: [],
        color: '#F97316', // orange
      },
      {
        id: 'to_generate',
        title: 'To Generate',
        status: 'to_generate',
        articles: [],
        color: '#F59E0B', // yellow
      },
      {
        id: 'generating',
        title: 'Generating',
        status: 'generating',
        articles: [],
        color: '#3B82F6', // blue
      },
      {
        id: 'wait_for_publish',
        title: 'Wait for Publish',
        status: 'wait_for_publish',
        articles: [],
        color: '#8B5CF6', // purple
      },
      {
        id: 'published',
        title: 'Published',
        status: 'published',
        articles: [],
        color: '#10B981', // green
      },
    ];

    // Organize articles by status
    sanitizedArticles.forEach(article => {
      const column = columns.find(col => col.status === article.status);
      if (column) {
        column.articles.push(article);
      }
    });

    return NextResponse.json(columns);

  } catch (error) {
    console.error('Get kanban board error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch kanban board' },
      { status: 500 }
    );
  }
}
