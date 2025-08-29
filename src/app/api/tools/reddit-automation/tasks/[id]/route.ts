import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/server/db";
import { redditTasks, users, projects } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const updateTaskSchema = z.object({
  status: z.enum(["pending", "completed", "skipped"]).optional(),
  redditUrl: z.string().url().optional(),
  karmaEarned: z.number().int().min(0).optional(),
  scheduledDate: z.string().datetime().optional(),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1. Authenticate user
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Verify user exists in database
    const [userRecord] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, userId));
    if (!userRecord) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // 3. Parse and validate task ID
    const { id } = await params;
    const taskId = parseInt(id);
    if (isNaN(taskId)) {
      return NextResponse.json({ error: "Invalid task ID" }, { status: 400 });
    }

    // 4. Parse and validate request body
    const body = await request.json() as unknown;
    const validatedData = updateTaskSchema.parse(body);

    // 5. Verify task exists and user has access to it
    const [existingTask] = await db
      .select({
        id: redditTasks.id,
        projectId: redditTasks.projectId,
        status: redditTasks.status,
      })
      .from(redditTasks)
      .innerJoin(projects, eq(projects.id, redditTasks.projectId))
      .where(
        and(
          eq(redditTasks.id, taskId),
          eq(projects.userId, userRecord.id)
        )
      );

    if (!existingTask) {
      return NextResponse.json(
        { error: "Task not found or access denied" },
        { status: 404 }
      );
    }

    // 6. Update the task
    const updateData: {
      updatedAt: Date;
      status?: "pending" | "completed" | "skipped";
      redditUrl?: string;
      karmaEarned?: number;
      completedAt?: Date;
      scheduledDate?: Date;
    } = {
      updatedAt: new Date(),
    };

    // Add optional fields if provided
    if (validatedData.status) {
      updateData.status = validatedData.status;
    }
    if (validatedData.redditUrl) {
      updateData.redditUrl = validatedData.redditUrl;
    }
    if (validatedData.karmaEarned !== undefined) {
      updateData.karmaEarned = validatedData.karmaEarned;
    }
    if (validatedData.scheduledDate) {
      updateData.scheduledDate = new Date(validatedData.scheduledDate);
    }

    // Set completion time if task is being marked as completed
    if (validatedData.status === "completed") {
      updateData.completedAt = new Date();
    }

    await db
      .update(redditTasks)
      .set(updateData)
      .where(eq(redditTasks.id, taskId));

    // 7. Fetch and return updated task
    const [updatedTask] = await db
      .select()
      .from(redditTasks)
      .where(eq(redditTasks.id, taskId));

    return NextResponse.json({
      success: true,
      data: updatedTask,
    });
  } catch (error) {
    console.error("Error updating task:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input data", details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1. Authenticate user
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Verify user exists in database
    const [userRecord] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, userId));
    if (!userRecord) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // 3. Parse and validate task ID
    const { id } = await params;
    const taskId = parseInt(id);
    if (isNaN(taskId)) {
      return NextResponse.json({ error: "Invalid task ID" }, { status: 400 });
    }

    // 4. Verify task exists and user has access to it
    const [existingTask] = await db
      .select({
        id: redditTasks.id,
        projectId: redditTasks.projectId,
      })
      .from(redditTasks)
      .innerJoin(projects, eq(projects.id, redditTasks.projectId))
      .where(
        and(
          eq(redditTasks.id, taskId),
          eq(projects.userId, userRecord.id)
        )
      );

    if (!existingTask) {
      return NextResponse.json(
        { error: "Task not found or access denied" },
        { status: 404 }
      );
    }

    // 5. Delete the task
    await db.delete(redditTasks).where(eq(redditTasks.id, taskId));

    return NextResponse.json({
      success: true,
      message: "Task deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting task:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
