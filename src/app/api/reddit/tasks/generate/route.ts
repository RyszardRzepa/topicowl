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
import { eq, and } from "drizzle-orm";
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
import { getUserCredits, deductCredits } from "@/lib/utils/credits";
import { 
  getCreditCost,
  hasEnoughCreditsForOperation, 
  getInsufficientCreditsMessage 
} from "@/lib/utils/credit-costs";

export const maxDuration = 800;

const GenerateTasksSchema = z.object({
  projectId: z.number(),
  weekStartDate: z.string().datetime().optional(), // ISO date string, defaults to current Monday
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

    // Check if user has credits before proceeding
    console.log("[REDDIT_TASKS_GENERATE_API] Checking user credits...");
    const currentCredits = await getUserCredits(userRecord.id);

    if (!hasEnoughCreditsForOperation(currentCredits, "REDDIT_TASKS")) {
      return NextResponse.json(
        {
          error: getInsufficientCreditsMessage("REDDIT_TASKS"),
          credits: currentCredits,
        },
        { status: 402 }, // Payment Required
      );
    }

    console.log(
      "[REDDIT_TASKS_GENERATE_API] User has",
      currentCredits,
      "credits, proceeding with generation",
    );

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
    let weekStartDate: Date;
    if (validatedData.weekStartDate) {
      weekStartDate = new Date(validatedData.weekStartDate);
      // Ensure the provided date is a Monday (day 1) for consistency
      if (weekStartDate.getDay() !== 1) {
        return NextResponse.json(
          {
            error: "weekStartDate must be a Monday. Please provide the start of the week (Monday) for task generation.",
            providedDate: validatedData.weekStartDate,
            dayOfWeek: weekStartDate.getDay(),
          },
          { status: 400 },
        );
      }
    } else {
      weekStartDate = getCurrentWeekStart();
    }

    // Calculate week end date for response information
    const weekEndDate = new Date(weekStartDate.getTime() + 7 * 24 * 60 * 60 * 1000);

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
      const stats = orchestrationResult.statistics;
      return NextResponse.json(
        {
          success: false,
          error: orchestrationResult.error,
          weekStartDate: weekStartDate.toISOString(),
          weekEndDate: weekEndDate.toISOString(),
          weekRange: `${weekStartDate.toISOString().split('T')[0]} to ${weekEndDate.toISOString().split('T')[0]}`,
          // Comprehensive error statistics
          statistics: {
            totalSubredditsTargeted: stats.totalSubredditsTargeted,
            totalPostsFetched: stats.totalPostsFetched,
            fetchErrors: stats.fetchErrors,
            duplicateFilteringStats: stats.duplicateFilteringStats,
            duplicatesFiltered: stats.duplicatesFiltered,
            duplicateDetails: stats.duplicateDetails,
            totalPostsEvaluated: stats.totalPostsEvaluated,
            evaluationErrors: stats.evaluationErrors,
            averageScore: stats.averageScore,
            recommendedCount: stats.recommendedCount,
            highScoreCount: stats.highScoreCount,
            mediumScoreCount: stats.mediumScoreCount,
            lowScoreCount: stats.lowScoreCount,
            relevantPostsFound: stats.relevantPostsFound,
            tasksGenerated: stats.tasksGenerated,
            draftsGenerated: stats.draftsGenerated,
            postsRecorded: stats.postsRecorded,
            recordingErrors: stats.recordingErrors,
            processingTime: stats.totalProcessingTimeMs,
          },
          // Legacy fields for backward compatibility
          duplicateFilteringStats: stats.duplicateFilteringStats,
          duplicatesFiltered: stats.duplicatesFiltered,
          duplicateDetails: stats.duplicateDetails,
        },
        { status: 400 },
      );
    }

    // Save tasks to database
    const savedTasks = await db
      .insert(redditTasks)
      .values(orchestrationResult.tasks)
      .returning();

    // Deduct credits for successful generation
    const creditsToDeduct = getCreditCost("REDDIT_TASKS");
    console.log(`[REDDIT_TASKS_GENERATE_API] Deducting ${creditsToDeduct} credits for successful generation...`);
    const deductionSuccess = await deductCredits(userRecord.id, creditsToDeduct);

    if (!deductionSuccess) {
      console.warn(
        "[REDDIT_TASKS_GENERATE_API] Failed to deduct credits, but tasks were generated",
      );
      // We could choose to return an error here, but tasks were already generated
      // For better UX, we'll return the tasks but log the warning
    }

    const remainingCredits = deductionSuccess
      ? currentCredits - creditsToDeduct
      : currentCredits;
    console.log(
      "[REDDIT_TASKS_GENERATE_API] User now has",
      remainingCredits,
      "credits remaining",
    );

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
      weekEndDate: weekEndDate.toISOString(),
      weekRange: `${weekStartDate.toISOString().split('T')[0]} to ${weekEndDate.toISOString().split('T')[0]}`,
      taskDistribution: {
        comments: commentTasks,
        posts: postTasks,
        commentRatio: actualCommentRatio,
        expectedRatio: settings.commentRatio ?? 80,
      },
      // Comprehensive statistics as required by task 12
      statistics: {
        // Fetch statistics
        totalSubredditsTargeted: stats.totalSubredditsTargeted,
        totalPostsFetched: stats.totalPostsFetched,
        fetchErrors: stats.fetchErrors,
        
        // Duplicate filtering statistics
        duplicateFilteringStats: stats.duplicateFilteringStats,
        duplicatesFiltered: stats.duplicatesFiltered,
        duplicateDetails: stats.duplicateDetails,
        
        // Evaluation statistics
        totalPostsEvaluated: stats.totalPostsEvaluated,
        evaluationErrors: stats.evaluationErrors,
        averageScore: stats.averageScore,
        recommendedCount: stats.recommendedCount,
        highScoreCount: stats.highScoreCount,
        mediumScoreCount: stats.mediumScoreCount,
        lowScoreCount: stats.lowScoreCount,
        
        // Task generation statistics
        relevantPostsFound: stats.relevantPostsFound,
        tasksGenerated: stats.tasksGenerated,
        draftsGenerated: stats.draftsGenerated,
        
        // Post recording statistics
        postsRecorded: stats.postsRecorded,
        recordingErrors: stats.recordingErrors,
        
        // Processing time
        processingTime: stats.totalProcessingTimeMs,
      },
      // Legacy fields for backward compatibility
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
