import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/server/db";
import { articles, users, projects, articleGenerations } from "@/server/db/schema";
import { max, eq, and, desc, inArray } from "drizzle-orm";
import { z } from "zod";
import { logServerError } from "@/lib/posthog-server";
import type {
  ArticleGenerationArtifacts,
  ValidationArtifact,
  WriteArtifact,
} from "@/types";

export const maxDuration = 800;

// Types colocated with this API route
export interface CreateArticleRequest {
  title: string;
  description?: string;
  keywords?: string[];
  targetAudience?: string;
  notes?: string;
  projectId: number;
}

const createArticleSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  keywords: z.array(z.string()).optional().default([]),
  targetAudience: z.string().optional(),
  notes: z.string().optional(),
  projectId: z.number().int().positive(),
});

// POST /api/articles - Create new article
export async function POST(req: NextRequest) {
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

    const body: unknown = await req.json();
    const validatedData = createArticleSchema.parse(body);

    // Verify project ownership
    const [projectRecord] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(
        and(
          eq(projects.id, validatedData.projectId),
          eq(projects.userId, userRecord.id),
        ),
      )
      .limit(1);

    if (!projectRecord) {
      return NextResponse.json(
        { error: "Project not found or access denied" },
        { status: 404 },
      );
    }

    // Get the maximum kanban position for this project's articles
    const maxPositionResult = await db
      .select({ maxPosition: max(articles.kanbanPosition) })
      .from(articles)
      .where(eq(articles.projectId, validatedData.projectId));

    const nextPosition = (maxPositionResult[0]?.maxPosition ?? -1) + 1;

    const [newArticle] = await db
      .insert(articles)
      .values({
        ...validatedData,
        userId: userRecord.id,
        status: "idea",
        kanbanPosition: nextPosition,
      })
      .returning();

    return NextResponse.json(newArticle, { status: 201 });
  } catch (error) {
    console.error("Create article error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input data", details: error.errors },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: "Failed to create article" },
      { status: 500 },
    );
  }
}

// GET /api/articles - Get user's articles (optionally filtered by project)
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

    let userArticles;

    if (projectIdParam) {
      const projectId = parseInt(projectIdParam, 10);
      if (isNaN(projectId)) {
        return NextResponse.json(
          { error: "Invalid project ID" },
          { status: 400 },
        );
      }

      // Verify project ownership
      const [projectRecord] = await db
        .select({ id: projects.id })
        .from(projects)
        .where(
          and(eq(projects.id, projectId), eq(projects.userId, userRecord.id)),
        )
        .limit(1);

      if (!projectRecord) {
        return NextResponse.json(
          { error: "Project not found or access denied" },
          { status: 404 },
        );
      }

      // Get articles for specific project
      userArticles = await db
        .select({
          id: articles.id,
          title: articles.title,
          description: articles.description,
          status: articles.status,
          projectId: articles.projectId,
          userId: articles.userId,
          keywords: articles.keywords,
          targetAudience: articles.targetAudience,
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
          notes: articles.notes,
          createdAt: articles.createdAt,
          updatedAt: articles.updatedAt,
        })
        .from(articles)
        .where(eq(articles.projectId, projectId))
        .orderBy(articles.kanbanPosition, articles.createdAt);
    } else {
      // Get all articles for user's projects
      userArticles = await db
        .select({
          id: articles.id,
          title: articles.title,
          description: articles.description,
          status: articles.status,
          projectId: articles.projectId,
          userId: articles.userId,
          keywords: articles.keywords,
          targetAudience: articles.targetAudience,
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
          notes: articles.notes,
          createdAt: articles.createdAt,
          updatedAt: articles.updatedAt,
        })
        .from(articles)
        .innerJoin(projects, eq(articles.projectId, projects.id))
        .where(eq(projects.userId, userRecord.id))
        .orderBy(articles.kanbanPosition, articles.createdAt);
    }

    const articleIds = userArticles.map((article: { id: number }) => article.id);

    const generationMap = new Map<number, ArticleGenerationArtifacts>();
    if (articleIds.length > 0) {
      const generationRows = await db
        .select({
          articleId: articleGenerations.articleId,
          artifacts: articleGenerations.artifacts,
          createdAt: articleGenerations.createdAt,
        })
        .from(articleGenerations)
        .where(inArray(articleGenerations.articleId, articleIds))
        .orderBy(desc(articleGenerations.createdAt));

      for (const row of generationRows) {
        if (!generationMap.has(row.articleId)) {
          generationMap.set(row.articleId, row.artifacts);
        }
      }
    }

    const enrichedArticles = userArticles.map((article: Record<string, unknown>) => {
      const generationArtifacts = generationMap.get(article.id as number);
      const writeArtifact: WriteArtifact | undefined = generationArtifacts?.write;
      const validationArtifact: ValidationArtifact | undefined =
        generationArtifacts?.validation;
      const qualityControl = generationArtifacts?.qualityControl;

      const factCheckReport =
        writeArtifact?.factCheckReport ??
        qualityControl?.report ??
        null;

      const internalLinksCandidate = writeArtifact?.internalLinks;
      const internalLinks =
        Array.isArray(internalLinksCandidate) &&
        internalLinksCandidate.every((link): link is string => typeof link === "string")
          ? internalLinksCandidate
          : [];

      const seoScore = validationArtifact?.seoScore ?? null;

      const sources = generationArtifacts?.research?.sources
        ? generationArtifacts.research.sources.map((source) =>
            source.title ? `${source.title} — ${source.url}` : source.url,
          )
        : [];

      return {
        ...article,
        factCheckReport,
        internalLinks,
        seoScore,
        sources,
      };
    });

    return NextResponse.json(enrichedArticles);
  } catch (error) {
    await logServerError(error, { operation: "get_articles" });
    return NextResponse.json(
      { error: "Failed to fetch articles" },
      { status: 500 },
    );
  }
}
