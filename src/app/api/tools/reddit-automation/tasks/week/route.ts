import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { redditTasks, projects, users } from "@/server/db/schema";
import { eq, and, gte, lte } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify user exists in database
    const [userRecord] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId));
    if (!userRecord) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json(
        { error: "Project ID is required" },
        { status: 400 },
      );
    }

    const projectIdNum = parseInt(projectId, 10);
    if (isNaN(projectIdNum)) {
      return NextResponse.json(
        { error: "Invalid project ID format" },
        { status: 400 },
      );
    }

    // Verify project ownership
    const [projectRecord] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, projectIdNum), eq(projects.userId, userRecord.id)));

    if (!projectRecord) {
      return NextResponse.json(
        { error: "Project not found or access denied" },
        { status: 404 },
      );
    }

    // Calculate week start and end dates
    const weekStartParam = searchParams.get("weekStartDate");
    const weekStartDate = weekStartParam 
      ? new Date(weekStartParam)
      : getCurrentWeekStart();
    
    const weekEndDate = new Date(weekStartDate);
    weekEndDate.setDate(weekStartDate.getDate() + 6);
    weekEndDate.setHours(23, 59, 59, 999);

    // Get tasks for the specified week
    const tasks = await db
      .select()
      .from(redditTasks)
      .where(and(
        eq(redditTasks.projectId, projectIdNum),
        gte(redditTasks.scheduledDate, weekStartDate),
        lte(redditTasks.scheduledDate, weekEndDate)
      ))
      .orderBy(redditTasks.scheduledDate, redditTasks.taskOrder);

    // Group tasks by day
    const tasksByDay = tasks.reduce((acc, task) => {
      const dayKey = task.scheduledDate.toISOString().split('T')[0]; // YYYY-MM-DD format
      if (dayKey) {
        acc[dayKey] ??= [];
        acc[dayKey]?.push(task);
      }
      return acc;
    }, {} as Record<string, typeof tasks>);

    // Calculate statistics
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(task => task.status === 'completed').length;
    const skippedTasks = tasks.filter(task => task.status === 'skipped').length;
    const pendingTasks = tasks.filter(task => task.status === 'pending').length;

    return NextResponse.json({
      success: true,
      weekStartDate: weekStartDate.toISOString(),
      weekEndDate: weekEndDate.toISOString(),
      tasks: tasksByDay,
      statistics: {
        totalTasks,
        completedTasks,
        skippedTasks,
        pendingTasks,
        completionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0
      }
    });

  } catch (error) {
    console.error("Get weekly tasks error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

function getCurrentWeekStart(): Date {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Convert to days from Monday
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - daysFromMonday);
  weekStart.setHours(0, 0, 0, 0);
  return weekStart;
}
