import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { articles, generationQueue, users, projects } from "@/server/db/schema";
import { eq, and, max } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@clerk/nextjs/server";

// Types colocated with this API route
export interface AddToQueueRequest {
  articleId: number;
  scheduledForDate?: string; // Optional date for tracking (defaults to today)
}

export interface GenerationQueueResponse {
  success: boolean;
  data: {
    articles: Array<{
      id: number; // queue item id
      articleId: number;
      title: string;
      addedToQueueAt: string;
      scheduledForDate: string;
      queuePosition: number;
      schedulingType: "manual" | "automatic";
      status: "queued" | "processing" | "completed" | "failed";
      attempts: number;
      errorMessage?: string;
    }>;
    totalCount: number;
    currentlyProcessing?: number; // article id currently being processed
  };
}

export interface RemoveFromQueueRequest {
  queueItemId: number;
}

const addToQueueSchema = z.object({
  articleId: z.number(),
  scheduledForDate: z.string().datetime().optional(),
});

// Helper function to get next queue position
async function getNextQueuePosition(userId: string): Promise<number> {
  const maxPositionResult = await db
    .select({ maxPosition: max(generationQueue.queuePosition) })
    .from(generationQueue)
    .where(
      and(
        eq(generationQueue.userId, userId),
        eq(generationQueue.status, "queued"),
      ),
    );

  return (maxPositionResult[0]?.maxPosition ?? -1) + 1;
}

// GET /api/articles/generation-queue - Get user's generation queue
export async function GET(_req: NextRequest) {
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

    // Get generation queue items for this user with article details
    const queueItems = await db
      .select({
        id: generationQueue.id,
        articleId: generationQueue.articleId,
        title: articles.title,
        addedToQueueAt: generationQueue.addedToQueueAt,
        scheduledForDate: generationQueue.scheduledForDate,
        queuePosition: generationQueue.queuePosition,
        schedulingType: generationQueue.schedulingType,
        status: generationQueue.status,
        attempts: generationQueue.attempts,
        errorMessage: generationQueue.errorMessage,
      })
      .from(generationQueue)
      .innerJoin(articles, eq(generationQueue.articleId, articles.id))
      .where(eq(generationQueue.userId, userRecord.id))
      .orderBy(generationQueue.queuePosition, generationQueue.createdAt);

    // Find currently processing item
    const currentlyProcessing = queueItems.find(
      (item) => item.status === "processing",
    )?.articleId;

    const response: GenerationQueueResponse = {
      success: true,
      data: {
        articles: queueItems.map((item) => ({
          id: item.id,
          articleId: item.articleId,
          title: item.title,
          addedToQueueAt: item.addedToQueueAt.toISOString(),
          scheduledForDate:
            item.scheduledForDate?.toISOString() ?? new Date().toISOString(),
          queuePosition: item.queuePosition ?? 0,
          schedulingType: item.schedulingType as "manual" | "automatic",
          status: item.status as
            | "queued"
            | "processing"
            | "completed"
            | "failed",
          attempts: item.attempts ?? 0,
          errorMessage: item.errorMessage ?? undefined,
        })),
        totalCount: queueItems.length,
        currentlyProcessing,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Get generation queue error:", error);
    return NextResponse.json(
      { error: "Failed to fetch generation queue" },
      { status: 500 },
    );
  }
}

// POST /api/articles/generation-queue - Add article to generation queue
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

    const body = (await req.json()) as unknown;
    const validatedData = addToQueueSchema.parse(body);
    const { articleId, scheduledForDate } = validatedData;

    // Check if article exists and belongs to current user's project using JOIN
    const [result] = await db
      .select({
        id: articles.id,
        userId: articles.userId,
        projectId: articles.projectId,
        title: articles.title,
        keywords: articles.keywords,
        status: articles.status,
      })
      .from(articles)
      .innerJoin(projects, eq(articles.projectId, projects.id))
      .where(
        and(eq(articles.id, articleId), eq(projects.userId, userRecord.id)),
      )
      .limit(1);

    if (!result) {
      return NextResponse.json(
        { error: "Article not found or access denied" },
        { status: 404 },
      );
    }

    const existingArticle = result;

    // Validate the article has required fields
    if (!existingArticle.title && !existingArticle.keywords) {
      return NextResponse.json(
        { error: "Article must have title and keywords before being queued" },
        { status: 400 },
      );
    }

    // Check if already in queue
    const [existingQueueItem] = await db
      .select()
      .from(generationQueue)
      .where(
        and(
          eq(generationQueue.articleId, articleId),
          eq(generationQueue.userId, userRecord.id),
          eq(generationQueue.status, "queued"),
        ),
      )
      .limit(1);

    if (existingQueueItem) {
      return NextResponse.json(
        { error: "Article is already in the generation queue" },
        { status: 400 },
      );
    }

    // Get next queue position
    const queuePosition = await getNextQueuePosition(userRecord.id);

    // Add to generation queue
    const [queueItem] = await db
      .insert(generationQueue)
      .values({
        articleId: articleId,
        userId: userRecord.id,
        projectId: existingArticle.projectId,
        scheduledForDate: scheduledForDate
          ? new Date(scheduledForDate)
          : new Date(),
        queuePosition: queuePosition,
        schedulingType: "manual", // Manual addition to queue
        status: "queued",
      })
      .returning();

    if (!queueItem) {
      return NextResponse.json(
        { error: "Failed to add item to queue" },
        { status: 500 },
      );
    }

    // Update article status to scheduled (replaces "queued")
    const [updatedArticle] = await db
      .update(articles)
      .set({
        status: "scheduled",
        updatedAt: new Date(),
      })
      .where(eq(articles.id, articleId))
      .returning();

    if (!updatedArticle) {
      return NextResponse.json(
        { error: "Failed to update article status" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        queueId: queueItem.id,
        articleId: updatedArticle.id,
        title: updatedArticle.title,
        status: updatedArticle.status,
        queuePosition: queueItem.queuePosition,
        addedAt: queueItem.addedToQueueAt.toISOString(),
      },
      message: "Article added to generation queue",
    });
  } catch (error) {
    console.error("Add to queue error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input data", details: error.errors },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: "Failed to add article to queue" },
      { status: 500 },
    );
  }
}

// DELETE /api/articles/generation-queue - Remove article from generation queue
export async function DELETE(req: NextRequest) {
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

    const { searchParams } = new URL(req.url);
    const queueItemIdParam = searchParams.get("queueItemId");

    if (!queueItemIdParam) {
      return NextResponse.json(
        { error: "Queue item ID is required" },
        { status: 400 },
      );
    }

    const queueItemId = parseInt(queueItemIdParam);

    // Check if queue item exists and belongs to current user's project using JOIN
    const [result] = await db
      .select({
        id: generationQueue.id,
        articleId: generationQueue.articleId,
        userId: generationQueue.userId,
        projectId: generationQueue.projectId,
        status: generationQueue.status,
        queuePosition: generationQueue.queuePosition,
      })
      .from(generationQueue)
      .innerJoin(projects, eq(generationQueue.projectId, projects.id))
      .where(
        and(
          eq(generationQueue.id, queueItemId),
          eq(projects.userId, userRecord.id),
        ),
      )
      .limit(1);

    if (!result) {
      return NextResponse.json(
        { error: "Queue item not found or access denied" },
        { status: 404 },
      );
    }

    const existingQueueItem = result;

    // Don't allow removing if currently processing
    if (existingQueueItem.status === "processing") {
      return NextResponse.json(
        { error: "Cannot remove article while it is being processed" },
        { status: 400 },
      );
    }

    // Remove from queue
    await db.delete(generationQueue).where(eq(generationQueue.id, queueItemId));

    // Update article status back to scheduled or idea
    const [article] = await db
      .select({
        id: articles.id,
        title: articles.title,
        status: articles.status,
      })
      .from(articles)
      .where(eq(articles.id, existingQueueItem.articleId))
      .limit(1);

    if (article) {
      // Put article back to idea status since generation was cancelled
      await db
        .update(articles)
        .set({
          status: "idea",
          updatedAt: new Date(),
        })
        .where(eq(articles.id, article.id));
    }

    // Reorder remaining queue items to fill the gap
    const remainingItems = await db
      .select()
      .from(generationQueue)
      .where(
        and(
          eq(generationQueue.userId, userRecord.id),
          eq(generationQueue.status, "queued"),
        ),
      )
      .orderBy(generationQueue.queuePosition);

    // Update positions to be sequential
    for (let i = 0; i < remainingItems.length; i++) {
      if (remainingItems[i]) {
        await db
          .update(generationQueue)
          .set({ queuePosition: i })
          .where(eq(generationQueue.id, remainingItems[i]!.id));
      }
    }

    return NextResponse.json({
      success: true,
      message: "Article removed from generation queue",
    });
  } catch (error) {
    console.error("Remove from queue error:", error);
    return NextResponse.json(
      { error: "Failed to remove article from queue" },
      { status: 500 },
    );
  }
}
