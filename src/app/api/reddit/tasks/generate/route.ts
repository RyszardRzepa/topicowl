import { auth, clerkClient } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "@/server/db";
import {
  redditSettings,
  redditTasks,
  projects,
  users,
} from "@/server/db/schema";
import { eq, and, gte, lt } from "drizzle-orm";
import { z } from "zod";
import type { ClerkPrivateMetadata } from "@/types";
import {
  generateRedditTasks,
  type RedditTaskOrchestrationConfig,
} from "@/lib/reddit/task-generation-orchestrator";
import {
  getCurrentWeekStart,
  discoverUserSubreddits,
} from "@/lib/reddit/utils";
import { refreshRedditToken } from "@/lib/reddit/api";

export const maxDuration = 800;

const GenerateTasksSchema = z.object({
  projectId: z.number(),
  weekStartDate: z.string().optional(), // ISO date string, defaults to current Monday
});

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify user exists in database
    const [userRecord] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, userId));
    if (!userRecord) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = (await request.json()) as unknown;
    const validatedData = GenerateTasksSchema.parse(body);

    // Verify project ownership
    const [projectRecord] = await db
      .select({
        id: projects.id,
        companyName: projects.companyName,
        productDescription: projects.productDescription,
        keywords: projects.keywords,
        toneOfVoice: projects.toneOfVoice,
        domain: projects.domain,
      })
      .from(projects)
      .where(
        and(
          eq(projects.id, validatedData.projectId),
          eq(projects.userId, userRecord.id),
        ),
      );

    if (!projectRecord) {
      return NextResponse.json(
        { error: "Project not found or access denied" },
        { status: 404 },
      );
    }

    // Get Reddit settings for the project
    const [settings] = await db
      .select()
      .from(redditSettings)
      .where(eq(redditSettings.projectId, validatedData.projectId))
      .limit(1);

    if (!settings) {
      return NextResponse.json(
        {
          error: "Reddit settings not found. Please configure settings first.",
        },
        { status: 404 },
      );
    }

    // Calculate week start date (current Monday if not provided)
    const weekStartDate = validatedData.weekStartDate
      ? new Date(validatedData.weekStartDate)
      : getCurrentWeekStart();

    // Check if tasks already exist for this week (inclusive start, exclusive end)
    const existingTasks = await db
      .select({ id: redditTasks.id })
      .from(redditTasks)
      .where(
        and(
          eq(redditTasks.projectId, validatedData.projectId),
          gte(redditTasks.scheduledDate, weekStartDate),
          lt(
            redditTasks.scheduledDate,
            new Date(weekStartDate.getTime() + 7 * 24 * 60 * 60 * 1000),
          ),
        ),
      )
      .limit(1);

    if (existingTasks.length > 0) {
      return NextResponse.json(
        {
          error:
            "Tasks already exist for this week. Delete existing tasks first if you want to regenerate.",
        },
        { status: 400 },
      );
    }

    // Determine target subreddits: prefer settings.targetSubreddits, otherwise discover
    const targetSubreddits: string[] = Array.isArray(settings.targetSubreddits)
      ? (settings.targetSubreddits as string[])
      : [];

    const subredditsToUse =
      targetSubreddits.length > 0
        ? targetSubreddits
        : await discoverUserSubreddits(
            userRecord.id,
            validatedData.projectId,
            projectRecord,
          );

    // Get Reddit access token if available
    const clerk = await clerkClient();
    const user = await clerk.users.getUser(userRecord.id);
    const metadata = (user.privateMetadata ?? {}) as ClerkPrivateMetadata;
    const projectConnection =
      metadata.redditTokens?.[validatedData.projectId.toString()];

    let accessToken: string | undefined;
    if (projectConnection) {
      try {
        accessToken = await refreshRedditToken(projectConnection.refreshToken);
      } catch (error) {
        console.warn(
          "Failed to refresh Reddit token, using public API:",
          error,
        );
      }
    }

    // Prepare orchestration configuration
    const orchestrationConfig: RedditTaskOrchestrationConfig = {
      projectId: validatedData.projectId,
      userId: userRecord.id,
      weekStartDate,
      subreddits: subredditsToUse,
      projectContext: {
        companyName: projectRecord.companyName ?? "Unknown",
        domain: projectRecord.domain ?? "",
        productDescription: projectRecord.productDescription ?? "",
        toneOfVoice: projectRecord.toneOfVoice ?? "professional and helpful",
        keywords: (projectRecord.keywords as string[]) ?? [],
      },
      accessToken,
      fetchConfig: {
        limit: 30,
      },
      taskConfig: {
        maxTasks: 7,
        defaultTaskTime: { hours: 9, minutes: 0 },
        commentRatio: settings.commentRatio ?? 80,
      },
    };

    // Execute orchestration function
    const orchestrationResult = await generateRedditTasks(orchestrationConfig);

    if (!orchestrationResult.success) {
      return NextResponse.json(
        {
          error: orchestrationResult.error,
          duplicateFilteringStats:
            orchestrationResult.statistics.duplicateFilteringStats,
          duplicatesFiltered: orchestrationResult.statistics.duplicatesFiltered,
          duplicateDetails: orchestrationResult.statistics.duplicateDetails,
        },
        { status: 400 },
      );
    }

    // Save tasks to database
    const savedTasks = await db
      .insert(redditTasks)
      .values(orchestrationResult.tasks)
      .returning();

    // Update last generated date (optional; guard in case column doesn't exist)
    try {
      await db
        .update(redditSettings)
        .set({ lastGeneratedDate: new Date() })
        .where(eq(redditSettings.projectId, validatedData.projectId));
    } catch (e) {
      console.warn(
        "Optional update: failed to set redditSettings.lastGeneratedDate",
        e,
      );
    }

    // Transform orchestration results into HTTP response
    const stats = orchestrationResult.statistics;
    
    // Calculate actual task distribution
    const commentTasks = savedTasks.filter(task => task.taskType === "comment").length;
    const postTasks = savedTasks.filter(task => task.taskType === "post").length;
    const actualCommentRatio = savedTasks.length > 0 ? Math.round((commentTasks / savedTasks.length) * 100) : 0;
    
    return NextResponse.json({
      success: true,
      tasksGenerated: savedTasks.length,
      weekStartDate: weekStartDate.toISOString(),
      taskDistribution: {
        comments: commentTasks,
        posts: postTasks,
        commentRatio: actualCommentRatio,
        expectedRatio: settings.commentRatio ?? 80,
      },
      duplicateFilteringStats: stats.duplicateFilteringStats,
      duplicatesFiltered: stats.duplicatesFiltered,
      duplicateDetails: stats.duplicateDetails,
      totalPostsEvaluated: stats.totalPostsEvaluated,
      averageScore: stats.averageScore,
      recommendedCount: stats.recommendedCount,
      highScoreCount: stats.highScoreCount,
      mediumScoreCount: stats.mediumScoreCount,
      lowScoreCount: stats.lowScoreCount,
      relevantPostsFound: stats.relevantPostsFound,
      draftsGenerated: stats.draftsGenerated,
      postsRecorded: stats.postsRecorded,
      processingTime: stats.totalProcessingTimeMs,
      tasks: savedTasks,
    });
  } catch (error) {
    console.error("Generate Reddit tasks error:", error);
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
