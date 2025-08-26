import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { articles, users, projects } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";

export interface CancelPublishScheduleResponse {
  success: boolean;
  data?: {
    id: number;
    title: string;
    status: string;
    publishScheduledAt: string | null;
  };
  error?: string;
  message?: string;
}

// POST /api/articles/[id]/cancel-publish-schedule - Cancel a scheduled publishing date and keep article ready to publish
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // 1. Authenticate user with Clerk
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Verify user exists in database
    const [userRecord] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!userRecord) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { id } = await params;
    const articleId = parseInt(id, 10);
    if (isNaN(articleId)) {
      return NextResponse.json(
        { error: "Invalid article ID" },
        { status: 400 },
      );
    }

    // 3. Verify project ownership via join
    const [existing] = await db
      .select({
        id: articles.id,
        title: articles.title,
        status: articles.status,
        publishScheduledAt: articles.publishScheduledAt,
        projectId: articles.projectId,
      })
      .from(articles)
      .innerJoin(projects, eq(articles.projectId, projects.id))
      .where(
        and(eq(articles.id, articleId), eq(projects.userId, userRecord.id)),
      )
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        { error: "Article not found or access denied" },
        { status: 404 },
      );
    }

    // Ensure it has a scheduled publish time
    if (!existing.publishScheduledAt) {
      return NextResponse.json(
        { error: "Article is not scheduled for publishing" },
        { status: 400 },
      );
    }

    // Update: clear publishScheduledAt, status remains wait_for_publish
    const updatedRows = await db
      .update(articles)
      .set({
        publishScheduledAt: null,
        status: "wait_for_publish",
        updatedAt: new Date(),
      })
      .where(eq(articles.id, articleId))
      .returning();

    const updated = updatedRows[0];
    if (!updated) {
      return NextResponse.json(
        { error: "Failed to update article" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        id: updated.id,
        title: updated.title,
        status: updated.status,
        publishScheduledAt: null,
      },
      message: "Publishing schedule cancelled; article is ready to publish",
    } satisfies CancelPublishScheduleResponse);
  } catch (error) {
    console.error("Cancel publish schedule error:", error);
    return NextResponse.json(
      { error: "Failed to cancel publishing schedule" },
      { status: 500 },
    );
  }
}
