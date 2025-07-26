import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/server/db";
import { articles, users } from "@/server/db/schema";
import { eq } from "drizzle-orm";

// Types colocated with this API route
export type DatabaseArticle = typeof articles.$inferSelect;

export interface KanbanColumn {
  id: string;
  title: string;
  status: 'idea' | 'scheduled' | 'queued' | 'to_generate' | 'generating' | 'wait_for_publish' | 'published';
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

    // Get only this user's articles
    const allArticles = await db
      .select()
      .from(articles)
      .where(eq(articles.user_id, userRecord.id))
      .orderBy(articles.kanbanPosition, articles.createdAt);

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
    allArticles.forEach(article => {
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
