import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { db } from "@/server/db";
import {
  articles,
  articleGenerations,
  projects,
  users,
  type ArticleStatus,
  type ArticleGenerationStatus,
} from "@/server/db/schema";
import {
  and,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  sql,
} from "drizzle-orm";

const IN_PROGRESS_STATUSES = new Set<ArticleGenerationStatus>([
  "research",
  "image",
  "writing",
  "quality-control",
  "validating",
  "updating",
]);

type QueueStatus = "queued" | "processing" | "completed" | "failed";

type QueueItemResponse = {
  id: number;
  articleId: number;
  title: string;
  addedToQueueAt: string;
  scheduledForDate: string;
  queuePosition: number;
  schedulingType: "manual" | "automatic";
  status: QueueStatus;
  attempts: number;
  errorMessage?: string;
};

function deriveQueueStatus(
  articleStatus: ArticleStatus,
  generationStatus: ArticleGenerationStatus | null | undefined,
): QueueStatus {
  if (
    generationStatus &&
    IN_PROGRESS_STATUSES.has(generationStatus)
  ) {
    return "processing";
  }

  if (
    generationStatus === "failed" ||
    articleStatus === "failed"
  ) {
    return "failed";
  }

  if (articleStatus === "published" || generationStatus === "completed") {
    return "completed";
  }

  return "queued";
}

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const [userRecord] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!userRecord) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 },
      );
    }

    const { searchParams } = new URL(req.url);
    const projectIdParam = searchParams.get("projectId");

    let projectIdFilter: number | undefined;
    if (projectIdParam) {
      const parsed = Number(projectIdParam);
      if (!Number.isInteger(parsed)) {
        return NextResponse.json(
          { success: false, error: "Invalid project ID" },
          { status: 400 },
        );
      }

      const [projectRecord] = await db
        .select({ id: projects.id })
        .from(projects)
        .where(and(eq(projects.id, parsed), eq(projects.userId, userRecord.id)))
        .limit(1);

      if (!projectRecord) {
        return NextResponse.json(
          { success: false, error: "Project not found or access denied" },
          { status: 404 },
        );
      }

      projectIdFilter = parsed;
    }

    let whereClause = and(
      eq(projects.userId, userRecord.id),
      isNotNull(articles.publishScheduledAt),
    );
    whereClause = and(whereClause, isNull(articles.publishedAt));
    if (projectIdFilter !== undefined) {
      whereClause = and(whereClause, eq(articles.projectId, projectIdFilter));
    }

    const scheduledArticles = await db
      .select({
        id: articles.id,
        projectId: articles.projectId,
        title: articles.title,
        publishScheduledAt: articles.publishScheduledAt,
        createdAt: articles.createdAt,
        status: articles.status,
      })
      .from(articles)
      .innerJoin(projects, eq(articles.projectId, projects.id))
      .where(whereClause)
      .orderBy(articles.publishScheduledAt, articles.createdAt);

    const articleIds = scheduledArticles.map((article) => article.id);

    if (articleIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: { articles: [] },
      });
    }

    const generationRows = await db
      .select({
        articleId: articleGenerations.articleId,
        status: articleGenerations.status,
        error: articleGenerations.error,
        createdAt: articleGenerations.createdAt,
        scheduledAt: articleGenerations.scheduledAt,
      })
      .from(articleGenerations)
      .where(inArray(articleGenerations.articleId, articleIds))
      .orderBy(desc(articleGenerations.createdAt));

    const latestGenerationByArticle = new Map<
      number,
      {
        status: ArticleGenerationStatus;
        error: string | null;
        createdAt: Date;
        scheduledAt: Date | null;
      }
    >();

    for (const row of generationRows) {
      if (!latestGenerationByArticle.has(row.articleId)) {
        latestGenerationByArticle.set(row.articleId, {
          status: row.status,
          error: row.error,
          createdAt: row.createdAt,
          scheduledAt: row.scheduledAt ?? null,
        });
      }
    }

    const attemptRows = await db
      .select({
        articleId: articleGenerations.articleId,
        count: sql<number>`count(*)`,
      })
      .from(articleGenerations)
      .where(inArray(articleGenerations.articleId, articleIds))
      .groupBy(articleGenerations.articleId);

    const attemptsByArticle = new Map<number, number>();
    for (const row of attemptRows) {
      attemptsByArticle.set(row.articleId, Number(row.count));
    }

    const queueItems: QueueItemResponse[] = scheduledArticles
      .filter((article) => article.publishScheduledAt !== null)
      .map((article, index) => {
        const scheduledDate = article.publishScheduledAt!;
        const generation = latestGenerationByArticle.get(article.id);
        const status = deriveQueueStatus(
          article.status,
          generation?.status ?? null,
        );
        const addedSource = generation?.scheduledAt
          ?? generation?.createdAt
          ?? scheduledDate
          ?? article.createdAt;

        return {
          id: article.id,
          articleId: article.id,
          title: article.title,
          addedToQueueAt: addedSource.toISOString(),
          scheduledForDate: scheduledDate.toISOString(),
          queuePosition: index + 1,
          schedulingType: "manual",
          status,
          attempts: attemptsByArticle.get(article.id) ?? 0,
          errorMessage: generation?.error ?? undefined,
        } satisfies QueueItemResponse;
      });

    return NextResponse.json({
      success: true,
      data: { articles: queueItems },
    });
  } catch (error) {
    console.error("Generation queue fetch error", error);
    return NextResponse.json(
      { success: false, error: "Failed to load generation queue" },
      { status: 500 },
    );
  }
}

const schedulePayloadSchema = z.object({
  articleId: z.union([z.number(), z.string()]).transform((value) => {
    if (typeof value === "number") return value;
    const parsed = Number(value);
    if (!Number.isInteger(parsed)) {
      throw new Error("Invalid article ID");
    }
    return parsed;
  }),
  scheduledForDate: z.string().datetime(),
});

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const [userRecord] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!userRecord) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 },
      );
    }

    const payload = schedulePayloadSchema.parse(await req.json());

    const [articleRecord] = await db
      .select({
        id: articles.id,
        projectId: articles.projectId,
        status: articles.status,
      })
      .from(articles)
      .innerJoin(projects, eq(articles.projectId, projects.id))
      .where(
        and(eq(articles.id, payload.articleId), eq(projects.userId, userRecord.id)),
      )
      .limit(1);

    if (!articleRecord) {
      return NextResponse.json(
        { success: false, error: "Article not found or access denied" },
        { status: 404 },
      );
    }

    const scheduleDate = new Date(payload.scheduledForDate);
    if (Number.isNaN(scheduleDate.getTime())) {
      return NextResponse.json(
        { success: false, error: "Invalid schedule date" },
        { status: 400 },
      );
    }

    await db
      .update(articles)
      .set({
        publishScheduledAt: scheduleDate,
        status: articleRecord.status === "published" ? articleRecord.status : "scheduled",
        updatedAt: new Date(),
      })
      .where(eq(articles.id, payload.articleId));

    const [latestGeneration] = await db
      .select({
        id: articleGenerations.id,
      })
      .from(articleGenerations)
      .where(eq(articleGenerations.articleId, payload.articleId))
      .orderBy(desc(articleGenerations.createdAt))
      .limit(1);

    if (latestGeneration) {
      await db
        .update(articleGenerations)
        .set({
          status: "scheduled",
          progress: 0,
          scheduledAt: scheduleDate,
          startedAt: null,
          completedAt: null,
          error: null,
          errorDetails: null,
          updatedAt: new Date(),
        })
        .where(eq(articleGenerations.id, latestGeneration.id));
    } else {
      await db.insert(articleGenerations).values({
        articleId: payload.articleId,
        userId: userRecord.id,
        projectId: articleRecord.projectId,
        status: "scheduled",
        progress: 0,
        scheduledAt: scheduleDate,
        artifacts: {},
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Generation queue schedule error", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: "Invalid input data", details: error.errors },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { success: false, error: "Failed to schedule article" },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const queueItemParam = searchParams.get("queueItemId");

    if (!queueItemParam) {
      return NextResponse.json(
        { success: false, error: "queueItemId is required" },
        { status: 400 },
      );
    }

    const articleId = Number(queueItemParam);
    if (!Number.isInteger(articleId)) {
      return NextResponse.json(
        { success: false, error: "Invalid queue item ID" },
        { status: 400 },
      );
    }

    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const [userRecord] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!userRecord) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 },
      );
    }

    const [articleRecord] = await db
      .select({
        id: articles.id,
        status: articles.status,
      })
      .from(articles)
      .innerJoin(projects, eq(articles.projectId, projects.id))
      .where(and(eq(articles.id, articleId), eq(projects.userId, userRecord.id)))
      .limit(1);

    if (!articleRecord) {
      return NextResponse.json(
        { success: false, error: "Article not found or access denied" },
        { status: 404 },
      );
    }

    await db
      .update(articles)
      .set({
        status: articleRecord.status,
        updatedAt: new Date(),
      })
      .where(eq(articles.id, articleId));

    const [latestGeneration] = await db
      .select({ id: articleGenerations.id })
      .from(articleGenerations)
      .where(eq(articleGenerations.articleId, articleId))
      .orderBy(desc(articleGenerations.createdAt))
      .limit(1);

    if (latestGeneration) {
      await db
        .update(articleGenerations)
        .set({
          status: "scheduled",
          progress: 0,
          scheduledAt: null,
          startedAt: null,
          completedAt: null,
          error: null,
          errorDetails: null,
          updatedAt: new Date(),
        })
        .where(eq(articleGenerations.id, latestGeneration.id));
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Generation queue delete error", error);
    return NextResponse.json(
      { success: false, error: "Failed to update queue" },
      { status: 500 },
    );
  }
}
