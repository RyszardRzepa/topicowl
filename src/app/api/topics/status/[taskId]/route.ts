import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/server/db";
import { topicGenerationTasks, users } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    // Authenticate user
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { taskId } = await params;
    if (!taskId) {
      return NextResponse.json({ error: "Task ID required" }, { status: 400 });
    }

    // Verify user exists
    const [userRecord] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, userId));
    if (!userRecord) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get task status from database
    const [task] = await db
      .select({
        status: topicGenerationTasks.status,
        topicsGenerated: topicGenerationTasks.topicsGenerated,
        error: topicGenerationTasks.error,
      })
      .from(topicGenerationTasks)
      .where(
        and(
          eq(topicGenerationTasks.taskId, taskId),
          eq(topicGenerationTasks.userId, userRecord.id)
        )
      );

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    return NextResponse.json({
      status: task.status,
      topicsGenerated: task.topicsGenerated,
      error: task.error,
    });

  } catch (error) {
    console.error('[TOPIC_STATUS_API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch task status' },
      { status: 500 }
    );
  }
}