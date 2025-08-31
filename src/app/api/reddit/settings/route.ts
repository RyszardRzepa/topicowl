import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { redditSettings, projects, users } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const RedditSettingsSchema = z.object({
  projectId: z.number(),
  tasksPerDay: z.number().min(1).max(10).default(5),
  commentRatio: z.number().min(0).max(100).default(80),
  targetSubreddits: z.array(z.string()).default([]),
  expertiseTopics: z.array(z.string()).default([]),
  autoGenerateWeekly: z.boolean().default(true),
});

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

    // Get settings for the project
    const [settings] = await db
      .select()
      .from(redditSettings)
      .where(eq(redditSettings.projectId, projectIdNum))
      .limit(1);

    if (!settings) {
      return NextResponse.json(
        { error: "Settings not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      settings: {
        tasksPerDay: settings.tasksPerDay,
        commentRatio: settings.commentRatio,
        targetSubreddits: settings.targetSubreddits as string[],
        expertiseTopics: settings.expertiseTopics as string[],
        autoGenerateWeekly: settings.autoGenerateWeekly,
        lastGeneratedDate: settings.lastGeneratedDate?.toISOString(),
      },
    });
  } catch (error) {
    console.error("Get Reddit settings error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input data", details: error.errors },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
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

    const body = await request.json() as unknown;
    const validatedData = RedditSettingsSchema.parse(body);

    // Verify project ownership
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

    // Check if settings already exist for this project
    const [existingSettings] = await db
      .select({ id: redditSettings.id })
      .from(redditSettings)
      .where(eq(redditSettings.projectId, validatedData.projectId))
      .limit(1);

    let result;

    if (existingSettings) {
      // Update existing settings
      [result] = await db
        .update(redditSettings)
        .set({
          tasksPerDay: validatedData.tasksPerDay,
          commentRatio: validatedData.commentRatio,
          targetSubreddits: validatedData.targetSubreddits,
          expertiseTopics: validatedData.expertiseTopics,
          autoGenerateWeekly: validatedData.autoGenerateWeekly,
          updatedAt: new Date(),
        })
        .where(eq(redditSettings.projectId, validatedData.projectId))
        .returning();
    } else {
      // Create new settings
      [result] = await db
        .insert(redditSettings)
        .values({
          projectId: validatedData.projectId,
          userId: userRecord.id,
          tasksPerDay: validatedData.tasksPerDay,
          commentRatio: validatedData.commentRatio,
          targetSubreddits: validatedData.targetSubreddits,
          expertiseTopics: validatedData.expertiseTopics,
          autoGenerateWeekly: validatedData.autoGenerateWeekly,
        })
        .returning();
    }

    return NextResponse.json({
      success: true,
      settings: result,
    });
  } catch (error) {
    console.error("Save Reddit settings error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input data", details: error.errors },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
