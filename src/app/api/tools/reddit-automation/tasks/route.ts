import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { redditTasks, projects, users } from "@/server/db/schema";
import { eq, and, gte, lte } from "drizzle-orm";
import { z } from "zod";

const createTaskSchema = z.object({
  projectId: z.number().int().positive(),
  scheduledDate: z.string().datetime(),
  taskType: z.enum(["comment", "post"]),
  subreddit: z.string().min(1),
  searchKeywords: z.string().optional(),
  prompt: z.string().min(1),
});

export async function POST(request: NextRequest) {
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

    // 3. Parse and validate request body
    const body = await request.json() as unknown;
    const validatedData = createTaskSchema.parse(body);

    // 4. Verify project ownership
    const [projectRecord] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, validatedData.projectId), eq(projects.userId, userRecord.id)));

    if (!projectRecord) {
      return NextResponse.json(
        { error: "Project not found or access denied" },
        { status: 404 },
      );
    }

    // 5. Get the next task order for the day
    const scheduledDate = new Date(validatedData.scheduledDate);
    const dayStart = new Date(scheduledDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(scheduledDate);
    dayEnd.setHours(23, 59, 59, 999);

    const existingTasksForDay = await db
      .select({ taskOrder: redditTasks.taskOrder })
      .from(redditTasks)
      .where(
        and(
          eq(redditTasks.projectId, validatedData.projectId),
          eq(redditTasks.userId, userRecord.id),
          gte(redditTasks.scheduledDate, dayStart),
          lte(redditTasks.scheduledDate, dayEnd),
        ),
      )
      .orderBy(redditTasks.taskOrder);

    const maxTaskOrder = existingTasksForDay.length > 0 
      ? Math.max(...existingTasksForDay.map(t => t.taskOrder ?? 0))
      : 0;

    // 6. Create the task
    const [newTask] = await db
      .insert(redditTasks)
      .values({
        projectId: validatedData.projectId,
        userId: userRecord.id,
        scheduledDate,
        taskOrder: maxTaskOrder + 1,
        taskType: validatedData.taskType,
        subreddit: validatedData.subreddit,
        searchKeywords: validatedData.searchKeywords ?? null,
        prompt: validatedData.prompt,
        status: "pending" as const,
      })
      .returning();

    return NextResponse.json({
      success: true,
      data: newTask,
    });
  } catch (error) {
    console.error("Error creating task:", error);
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
