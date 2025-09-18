import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/server/db";
import {
  articles,
  users,
  articleGenerations,
  projects,
} from "@/server/db/schema";
import { eq, and, inArray, desc } from "drizzle-orm";
import type {
  ArticleStatus,
  ArticleGenerationStatus,
  ArticleGenerationArtifacts,
  ValidationArtifact,
  WriteArtifact,
} from "@/types";

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
  content: string | null;
  seoScore: number | null;
  coverImageUrl: string | null;
  coverImageAlt: string | null;
  notes: string | null;
  factCheckReport?: string | null;
  createdAt: Date;
  updatedAt: Date;
  // Generation tracking fields
  generationScheduledAt: Date | null;
  generationStatus: GenerationStatusValue | null;
  generationProgress: number | null;
  generationError: string | null;
};

const IN_PROGRESS_STATUSES = new Set<ArticleGenerationStatus>([
  "research",
  "image",
  "writing",
  "quality-control",
  "validating",
  "updating",
]);

type GenerationStatusValue = ArticleGenerationStatus;

type ArticleRow = {
  id: number;
  user_id: string | null;
  projectId: number;
  title: string;
  description: string | null;
  keywords: unknown;
  targetAudience: string | null;
  publishScheduledAt: Date | null;
  publishedAt: Date | null;
  estimatedReadTime: number | null;
  kanbanPosition: number;
  metaDescription: string | null;
  content: string | null;
  seoScore?: number | null;
  coverImageUrl: string | null;
  coverImageAlt: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type GenerationSnapshot = {
  status: GenerationStatusValue;
  progress: number;
  error: string | null;
  scheduledAt: Date | null;
  completedAt: Date | null;
  artifacts: ArticleGenerationArtifacts;
};

function deriveArticleStatus(
  article: ArticleRow,
  generation: GenerationSnapshot | undefined,
): ArticleStatus {
  if (article.publishedAt) return "published";

  const generationStatus = generation?.status;

  if (generationStatus === "failed") {
    return "failed";
  }

  if (generationStatus && IN_PROGRESS_STATUSES.has(generationStatus)) {
    return "generating";
  }

  if (generationStatus === "completed") {
    if (article.publishScheduledAt && !article.publishedAt) {
      return "wait_for_publish";
    }
    return "idea";
  }

  if (generationStatus === "scheduled") {
    return "scheduled";
  }

  if (article.publishScheduledAt) return "scheduled";

  return "idea";
}

export interface KanbanColumn {
  id: "idea" | "scheduled" | "generating" | "wait_for_publish" | "published" | "failed";
  title: string;
  status: "idea" | "scheduled" | "generating" | "wait_for_publish" | "published" | "failed";
  articles: DatabaseArticle[];
  color: string;
}

export interface KanbanBoard {
  columns: KanbanColumn[];
}

// GET /api/articles/board - Get kanban board with articles organized by status (optionally filtered by project)
export async function GET(req: NextRequest) {
  try {
    // Get current user from Clerk
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify user exists in database
    const [userRecord] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!userRecord) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check for project filter in query params
    const { searchParams } = new URL(req.url);
    const projectIdParam = searchParams.get("projectId");

    let allArticles: ArticleRow[];

    if (projectIdParam) {
      const projectId = parseInt(projectIdParam, 10);
      if (isNaN(projectId)) {
        return NextResponse.json(
          { error: "Invalid project ID" },
          { status: 400 },
        );
      }

      allArticles = await db
        .select({
          id: articles.id,
          user_id: articles.userId,
          projectId: articles.projectId,
          title: articles.title,
          description: articles.description,
          keywords: articles.keywords,
          targetAudience: articles.targetAudience,
          publishScheduledAt: articles.publishScheduledAt,
          publishedAt: articles.publishedAt,
          estimatedReadTime: articles.estimatedReadTime,
          kanbanPosition: articles.kanbanPosition,
          metaDescription: articles.metaDescription,
          content: articles.content,
        coverImageUrl: articles.coverImageUrl,
        coverImageAlt: articles.coverImageAlt,
        notes: articles.notes,
        createdAt: articles.createdAt,
        updatedAt: articles.updatedAt,
        })
        .from(articles)
        .innerJoin(projects, eq(articles.projectId, projects.id))
        .where(
          and(eq(projects.userId, userRecord.id), eq(articles.projectId, projectId)),
        )
        .orderBy(articles.kanbanPosition, articles.createdAt);
    } else {
      allArticles = await db
        .select({
          id: articles.id,
          user_id: articles.userId,
          projectId: articles.projectId,
          title: articles.title,
          description: articles.description,
          keywords: articles.keywords,
          targetAudience: articles.targetAudience,
          publishScheduledAt: articles.publishScheduledAt,
          publishedAt: articles.publishedAt,
          estimatedReadTime: articles.estimatedReadTime,
          kanbanPosition: articles.kanbanPosition,
          metaDescription: articles.metaDescription,
          content: articles.content,
        coverImageUrl: articles.coverImageUrl,
        coverImageAlt: articles.coverImageAlt,
        notes: articles.notes,
        createdAt: articles.createdAt,
        updatedAt: articles.updatedAt,
        })
        .from(articles)
        .innerJoin(projects, eq(articles.projectId, projects.id))
        .where(eq(projects.userId, userRecord.id))
        .orderBy(articles.kanbanPosition, articles.createdAt);
    }

    const articleIds = allArticles.map((article) => article.id);

    const generationMap = new Map<number, GenerationSnapshot>();

    if (articleIds.length > 0) {
      const generationRows = await db
        .select({
          articleId: articleGenerations.articleId,
          status: articleGenerations.status,
          progress: articleGenerations.progress,
          error: articleGenerations.error,
          scheduledAt: articleGenerations.scheduledAt,
          completedAt: articleGenerations.completedAt,
          artifacts: articleGenerations.artifacts,
          createdAt: articleGenerations.createdAt,
        })
        .from(articleGenerations)
        .where(inArray(articleGenerations.articleId, articleIds))
        .orderBy(desc(articleGenerations.createdAt));

      for (const row of generationRows) {
        if (!generationMap.has(row.articleId)) {
          generationMap.set(row.articleId, {
            status: row.status,
            progress: row.progress,
            error: row.error,
            scheduledAt: row.scheduledAt,
            completedAt: row.completedAt,
            artifacts: row.artifacts,
          });
        }
      }
    }

    const sanitizedArticles: DatabaseArticle[] = allArticles.map((article) => {
      const generation = generationMap.get(article.id);
      const derivedStatus = deriveArticleStatus(article, generation);
      const writeArtifact: WriteArtifact | undefined =
        generation?.artifacts?.write;
      const validationArtifact: ValidationArtifact | undefined =
        generation?.artifacts?.validation;

      return {
        ...article,
        status: derivedStatus,
        keywords: article.keywords ?? [],
        scheduledAt: article.publishScheduledAt,
        generationScheduledAt: generation?.scheduledAt ?? null,
        generationStatus: generation?.status ?? null,
        generationProgress: generation?.progress ?? 0,
        generationError: generation?.error ?? null,
        seoScore:
          validationArtifact?.seoScore ??
          null,
        factCheckReport:
          writeArtifact?.factCheckReport ??
          (generation?.artifacts?.qualityControl as { report?: string } | undefined)?.report ??
          null,
      };
    });

    // Define kanban columns
    const columns: KanbanColumn[] = [
      {
        id: "idea",
        title: "Ideas",
        status: "idea",
        articles: [],
        color: "#6B7280", // gray
      },
      {
        id: "scheduled",
        title: "Scheduled",
        status: "scheduled",
        articles: [],
        color: "#6366F1", // indigo
      },
      {
        id: "generating",
        title: "Generating",
        status: "generating",
        articles: [],
        color: "#3B82F6", // blue
      },
      {
        id: "failed",
        title: "Failed",
        status: "failed",
        articles: [],
        color: "#DC2626", // red
      },
      {
        id: "wait_for_publish",
        title: "Wait for Publish",
        status: "wait_for_publish",
        articles: [],
        color: "#8B5CF6", // purple
      },
      {
        id: "published",
        title: "Published",
        status: "published",
        articles: [],
        color: "#10B981", // green
      },
    ];

    // Organize articles by status
    sanitizedArticles.forEach((article) => {
      const column = columns.find((col) => col.status === article.status);
      if (column) {
        column.articles.push(article);
      }
    });

    return NextResponse.json(columns);
  } catch (error) {
    console.error("Get kanban board error:", error);
    return NextResponse.json(
      { error: "Failed to fetch kanban board" },
      { status: 500 },
    );
  }
}
