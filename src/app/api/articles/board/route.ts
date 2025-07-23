import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { articles } from "@/server/db/schema";

// Types colocated with this API route
type DatabaseArticle = typeof articles.$inferSelect;

export interface KanbanColumn {
  id: string;
  title: string;
  status: 'idea' | 'to_generate' | 'generating' | 'wait_for_publish' | 'published';
  articles: DatabaseArticle[];
  color: string;
}

export interface KanbanBoard {
  columns: KanbanColumn[];
}

// GET /api/articles/board - Get kanban board with articles organized by status
export async function GET(_req: NextRequest) {
  try {
    // Get all articles
    const allArticles = await db
      .select()
      .from(articles)
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
