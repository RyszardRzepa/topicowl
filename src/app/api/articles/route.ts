import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/server/db";
import { articles, users, projects, articleGeneration } from "@/server/db/schema";
import { max, eq, and, ne } from "drizzle-orm";
import { z } from "zod";
import { logServerError } from "@/lib/posthog-server";

export const maxDuration = 800;

// Types colocated with this API route
export interface CreateArticleRequest {
  title: string;
  description?: string;
  keywords?: string[];
  targetAudience?: string;
  notes?: string;
  projectId: number;
  // Calendar scheduling parameters
  generationScheduledAt?: string; // ISO datetime string
  publishScheduledAt?: string; // ISO datetime string
}

const createArticleSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  keywords: z.array(z.string()).optional().default([]),
  targetAudience: z.string().optional(),
  notes: z.string().optional(),
  projectId: z.number().int().positive(),
  // Calendar scheduling parameters
  generationScheduledAt: z.string().datetime().optional(),
  publishScheduledAt: z.string().datetime().optional(),
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

    // Determine initial status based on scheduling
    let initialStatus: "idea" | "scheduled" = "idea";
    if (validatedData.generationScheduledAt) {
      initialStatus = "scheduled";
    }

    // Prepare article data excluding scheduling fields
    const { generationScheduledAt, publishScheduledAt, ...articleData } = validatedData;

    const [newArticle] = await db
      .insert(articles)
      .values({
        ...articleData,
        userId: userRecord.id,
        status: initialStatus,
        kanbanPosition: nextPosition,
        publishScheduledAt: publishScheduledAt ? new Date(publishScheduledAt) : null,
      })
      .returning();

    if (!newArticle) {
      return NextResponse.json(
        { error: "Failed to create article" },
        { status: 500 },
      );
    }

    // Create generation record if generation is scheduled
    if (generationScheduledAt) {
      const scheduledDate = new Date(generationScheduledAt);
      
      // Validate scheduled time is in the future
      if (scheduledDate <= new Date()) {
        // Rollback - delete the article we just created
        await db.delete(articles).where(eq(articles.id, newArticle.id));
        return NextResponse.json(
          { error: "Generation scheduled time must be in the future" },
          { status: 400 },
        );
      }

      await db
        .insert(articleGeneration)
        .values({
          articleId: newArticle.id,
          userId: userRecord.id,
          projectId: validatedData.projectId,
          scheduledAt: scheduledDate,
          status: "pending",
        });
    }

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
        .select()
        .from(articles)
        .where(
          and(
            eq(articles.projectId, projectId),
            ne(articles.status, "deleted"),
          ),
        )
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
          draft: articles.draft,
          content: articles.content,
          videos: articles.videos,
          factCheckReport: articles.factCheckReport,
          seoScore: articles.seoScore,
          internalLinks: articles.internalLinks,
          sources: articles.sources,
          coverImageUrl: articles.coverImageUrl,
          coverImageAlt: articles.coverImageAlt,
          notes: articles.notes,
          createdAt: articles.createdAt,
          updatedAt: articles.updatedAt,
        })
        .from(articles)
        .innerJoin(projects, eq(articles.projectId, projects.id))
        .where(
          and(
            eq(projects.userId, userRecord.id),
            ne(articles.status, "deleted"),
          ),
        )
        .orderBy(articles.kanbanPosition, articles.createdAt);
    }

    return NextResponse.json(userArticles);
  } catch (error) {
    await logServerError(error, { operation: "get_articles" });
    return NextResponse.json(
      { error: "Failed to fetch articles" },
      { status: 500 },
    );
  }
}
