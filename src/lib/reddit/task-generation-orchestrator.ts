import type { ProjectContext, EvaluationConfig } from "./evaluation";
import type { TaskGenerationConfig } from "./task-generation";
import type { ProcessedPostRecord } from "./duplicate-prevention";
import { fetchLatestPosts, type FetchLatestPostsParams } from "./api";
import {
  filterDuplicatePosts,
  recordProcessedPosts,
} from "./duplicate-prevention";
import { evaluatePostsForRelevance } from "./evaluation";
import { generateTasksFromPosts } from "./task-generation";

// Orchestrator configuration interface
export interface RedditTaskOrchestrationConfig {
  projectId: number;
  userId: string;
  weekStartDate: Date;
  subreddits: string[];
  projectContext: ProjectContext;
  accessToken?: string;
  fetchConfig?: {
    limit?: number;
  };
  evaluationConfig?: EvaluationConfig;
  taskConfig?: {
    maxTasks?: number;
    defaultTaskTime?: { hours: number; minutes: number };
    commentRatio?: number; // Percentage of tasks that should be comments (0-100)
  };
}

// Comprehensive orchestration result
export interface RedditTaskOrchestrationResult {
  success: boolean;
  tasks: Array<{
    projectId: number;
    userId: string;
    scheduledDate: Date;
    taskOrder: number;
    taskType: "comment" | "post";
    subreddit: string;
    searchKeywords: string | null;
    prompt: string;
    aiDraft: string | null;
    redditUrl: string | null;
    status: "pending";
  }>;
  statistics: {
    // Fetch statistics
    totalSubredditsTargeted: number;
    totalPostsFetched: number;
    fetchErrors: Array<{
      subreddit: string;
      error: string;
      status?: number;
    }>;

    // Duplicate filtering statistics
    duplicateFilteringStats: {
      originalCount: number;
      duplicatesFound: number;
      newPostsCount: number;
      processingTimeMs: number;
    };
    duplicatesFiltered: number;
    duplicateDetails: Array<{
      postId: string;
      title: string;
      subreddit: string;
    }>;

    // Evaluation statistics
    totalPostsEvaluated: number;
    evaluationErrors: Array<{
      postId: string;
      error: string;
    }>;
    averageScore: number;
    recommendedCount: number;
    highScoreCount: number;
    mediumScoreCount: number;
    lowScoreCount: number;

    // Task generation statistics
    relevantPostsFound: number;
    tasksGenerated: number;
    draftsGenerated: number;

    // Post recording statistics
    postsRecorded: number;
    recordingErrors: Array<{
      postId: string;
      error: string;
    }>;

    // Overall timing
    totalProcessingTimeMs: number;
  };
  error?: string;
}

/**
 * Main orchestration function for Reddit task generation
 * Chains together: fetch posts → filter duplicates → evaluate → generate tasks → record
 */
export async function generateRedditTasks(
  config: RedditTaskOrchestrationConfig,
): Promise<RedditTaskOrchestrationResult> {
  const startTime = Date.now();

  try {
    // Step 1: Fetch latest posts from subreddits
    console.log("=== FETCHING LATEST POSTS ===");
    const fetchParams: FetchLatestPostsParams = {
      subreddits: config.subreddits,
      limit: config.fetchConfig?.limit ?? 30,
      accessToken: config.accessToken,
    };

    const { posts: latestPosts, errors: fetchErrors } =
      await fetchLatestPosts(fetchParams);

    console.log(`Target subreddits: ${config.subreddits.join(", ")}`);
    console.log(
      `Fetched a total of ${latestPosts.length} posts for evaluation.`,
    );

    if (fetchErrors.length > 0) {
      console.warn("Errors during post fetching:");
      fetchErrors.forEach((error) => {
        console.warn(`  r/${error.subreddit}: ${error.error}`);
      });
    }

    if (latestPosts.length === 0) {
      const errorDetails =
        fetchErrors.length > 0
          ? ` Errors: ${fetchErrors.map((e) => `r/${e.subreddit} (${e.error})`).join(", ")}`
          : "";

      return {
        success: false,
        tasks: [],
        statistics: {
          totalSubredditsTargeted: config.subreddits.length,
          totalPostsFetched: 0,
          fetchErrors,
          duplicateFilteringStats: {
            originalCount: 0,
            duplicatesFound: 0,
            newPostsCount: 0,
            processingTimeMs: 0,
          },
          duplicatesFiltered: 0,
          duplicateDetails: [],
          totalPostsEvaluated: 0,
          evaluationErrors: [],
          averageScore: 0,
          recommendedCount: 0,
          highScoreCount: 0,
          mediumScoreCount: 0,
          lowScoreCount: 0,
          relevantPostsFound: 0,
          tasksGenerated: 0,
          draftsGenerated: 0,
          postsRecorded: 0,
          recordingErrors: [],
          totalProcessingTimeMs: Date.now() - startTime,
        },
        error: `No posts found in target subreddits: ${config.subreddits.join(", ")}. Check if subreddits are active or exist.${errorDetails}`,
      };
    }

    // Step 2: Filter out duplicate posts
    console.log("=== FILTERING DUPLICATE POSTS ===");
    const duplicateFilterResult = await filterDuplicatePosts(
      config.projectId,
      latestPosts,
    );

    console.log(`Duplicate filtering results:`);
    console.log(
      `  Original posts: ${duplicateFilterResult.filteringStats.originalCount}`,
    );
    console.log(
      `  Duplicates found: ${duplicateFilterResult.filteringStats.duplicatesFound}`,
    );
    console.log(
      `  New posts for evaluation: ${duplicateFilterResult.filteringStats.newPostsCount}`,
    );
    console.log(
      `  Processing time: ${duplicateFilterResult.filteringStats.processingTimeMs}ms`,
    );

    if (duplicateFilterResult.duplicateCount > 0) {
      console.log(`Duplicate posts filtered out:`);
      duplicateFilterResult.duplicatePosts.forEach((duplicate) => {
        console.log(
          `  ${duplicate.postId} - r/${duplicate.subreddit}: "${duplicate.title.substring(0, 60)}..."`,
        );
      });
    }

    const postsToEvaluate = duplicateFilterResult.newPosts;

    if (postsToEvaluate.length === 0) {
      return {
        success: false,
        tasks: [],
        statistics: {
          totalSubredditsTargeted: config.subreddits.length,
          totalPostsFetched: latestPosts.length,
          fetchErrors,
          duplicateFilteringStats: duplicateFilterResult.filteringStats,
          duplicatesFiltered: duplicateFilterResult.duplicateCount,
          duplicateDetails: duplicateFilterResult.duplicatePosts,
          totalPostsEvaluated: 0,
          evaluationErrors: [],
          averageScore: 0,
          recommendedCount: 0,
          highScoreCount: 0,
          mediumScoreCount: 0,
          lowScoreCount: 0,
          relevantPostsFound: 0,
          tasksGenerated: 0,
          draftsGenerated: 0,
          postsRecorded: 0,
          recordingErrors: [],
          totalProcessingTimeMs: Date.now() - startTime,
        },
        error: `All ${latestPosts.length} posts have already been processed. No new posts found for task generation.`,
      };
    }

    // Step 3: Evaluate posts for relevance
    console.log("=== EVALUATING POSTS FOR RELEVANCE ===");
    const evaluationResult = await evaluatePostsForRelevance(
      postsToEvaluate,
      config.projectContext,
      config.evaluationConfig,
    );

    console.log(`Total posts evaluated: ${evaluationResult.totalEvaluated}`);
    console.log(`Average score: ${evaluationResult.statistics.averageScore}`);
    console.log(
      `Recommended posts: ${evaluationResult.statistics.recommendedCount}`,
    );
    console.log(
      `High score posts (>=8): ${evaluationResult.statistics.highScoreCount}`,
    );
    console.log(
      `Medium score posts (5-7): ${evaluationResult.statistics.mediumScoreCount}`,
    );
    console.log(
      `Low score posts (<5): ${evaluationResult.statistics.lowScoreCount}`,
    );

    if (evaluationResult.errors.length > 0) {
      console.warn("Errors during post evaluation:");
      evaluationResult.errors.forEach((error) => {
        console.warn(`  ${error.postId}: ${error.error}`);
      });
    }

    // Log top 10 results for debugging
    const sortedByScore = evaluationResult.results.sort(
      (a, b) => b.score - a.score,
    );
    sortedByScore.slice(0, 10).forEach((result, index) => {
      console.log(
        `${index + 1}. r/${result.post.subreddit}: "${result.post.title.slice(0, 60)}..."`,
      );
      console.log(
        `   Score: ${result.score}/10, ShouldReply: ${result.shouldReply}`,
      );
      console.log(`   Reasoning: ${result.reasoning.slice(0, 100)}...`);
      console.log("---");
    });

    // Convert evaluation results to the format expected by task generation
    const evaluatedPosts = evaluationResult.results.map((result) => ({
      post: {
        ...result.post,
        redditUrl: `https://www.reddit.com${result.post.permalink}`,
      },
      score: result.score,
      shouldReply: result.shouldReply,
      reasoning: result.reasoning,
    }));

    // Step 4: Generate tasks from relevant posts
    console.log("=== GENERATING TASKS FROM POSTS ===");
    const taskGenerationConfig: TaskGenerationConfig = {
      projectId: config.projectId,
      userId: config.userId,
      weekStartDate: config.weekStartDate,
      maxTasks: config.taskConfig?.maxTasks ?? 7,
      defaultTaskTime: config.taskConfig?.defaultTaskTime ?? {
        hours: 9,
        minutes: 0,
      },
      commentRatio: config.taskConfig?.commentRatio ?? 80,
    };

    const taskGenerationResult = await generateTasksFromPosts(
      evaluatedPosts,
      taskGenerationConfig,
    );

    console.log(
      `Generated ${taskGenerationResult.tasks.length} tasks from relevant posts`,
    );
    console.log(
      `Drafts generated: ${taskGenerationResult.statistics.draftsGenerated}`,
    );

    if (taskGenerationResult.tasks.length === 0) {
      // Provide detailed error message with the actual scores
      const topScores = sortedByScore
        .slice(0, 5)
        .map(
          (r) =>
            `r/${r.post.subreddit}: ${r.score}/10 (${r.shouldReply ? "recommended" : "not recommended"})`,
        )
        .join(", ");

      return {
        success: false,
        tasks: [],
        statistics: {
          totalSubredditsTargeted: config.subreddits.length,
          totalPostsFetched: latestPosts.length,
          fetchErrors,
          duplicateFilteringStats: duplicateFilterResult.filteringStats,
          duplicatesFiltered: duplicateFilterResult.duplicateCount,
          duplicateDetails: duplicateFilterResult.duplicatePosts,
          totalPostsEvaluated: evaluationResult.totalEvaluated,
          evaluationErrors: evaluationResult.errors,
          averageScore: evaluationResult.statistics.averageScore,
          recommendedCount: evaluationResult.statistics.recommendedCount,
          highScoreCount: evaluationResult.statistics.highScoreCount,
          mediumScoreCount: evaluationResult.statistics.mediumScoreCount,
          lowScoreCount: evaluationResult.statistics.lowScoreCount,
          relevantPostsFound:
            taskGenerationResult.statistics.relevantPostsFound,
          tasksGenerated: 0,
          draftsGenerated: 0,
          postsRecorded: 0,
          recordingErrors: [],
          totalProcessingTimeMs: Date.now() - startTime,
        },
        error: `No relevant posts found for comment generation. Highest scores: ${topScores}. Try adjusting your target subreddits or project keywords.`,
      };
    }

    // Step 5: Record processed posts after successful task creation
    console.log("=== RECORDING PROCESSED POSTS ===");
    let recordingResult = {
      recordedCount: 0,
      skippedCount: 0,
      errors: [] as Array<{ postId: string; error: string }>,
    };

    // Only record posts that were actually used for task generation
    const postsUsedForTasks = evaluatedPosts
      .filter((ep) => ep.shouldReply || ep.score >= 6)
      .slice(0, taskGenerationResult.tasks.length)
      .map((ep) => ep.post);

    if (postsUsedForTasks.length > 0) {
      try {
        const processedPostRecords: ProcessedPostRecord[] =
          postsUsedForTasks.map((post) => ({
            projectId: config.projectId,
            postId: post.id,
            subreddit: post.subreddit,
            postTitle: post.title,
            postUrl: post.permalink,
          }));

        recordingResult = await recordProcessedPosts(processedPostRecords);

        console.log(
          `Post recording completed: ${recordingResult.recordedCount} recorded, ` +
            `${recordingResult.skippedCount} skipped, ${recordingResult.errors.length} errors`,
        );

        if (recordingResult.errors.length > 0) {
          console.warn("Errors during post recording:");
          recordingResult.errors.forEach((error) => {
            console.warn(`  ${error.postId}: ${error.error}`);
          });
        }
      } catch (error) {
        // Log the error but don't break the main workflow
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.error(
          "Failed to record processed posts, but task generation succeeded:",
          error,
        );
        recordingResult.errors.push({
          postId: "batch_operation",
          error: errorMessage,
        });
      }
    }

    const totalProcessingTimeMs = Date.now() - startTime;
    console.log(`=== ORCHESTRATION COMPLETED (${totalProcessingTimeMs}ms) ===`);

    return {
      success: true,
      tasks: taskGenerationResult.tasks,
      statistics: {
        totalSubredditsTargeted: config.subreddits.length,
        totalPostsFetched: latestPosts.length,
        fetchErrors,
        duplicateFilteringStats: duplicateFilterResult.filteringStats,
        duplicatesFiltered: duplicateFilterResult.duplicateCount,
        duplicateDetails: duplicateFilterResult.duplicatePosts,
        totalPostsEvaluated: evaluationResult.totalEvaluated,
        evaluationErrors: evaluationResult.errors,
        averageScore: evaluationResult.statistics.averageScore,
        recommendedCount: evaluationResult.statistics.recommendedCount,
        highScoreCount: evaluationResult.statistics.highScoreCount,
        mediumScoreCount: evaluationResult.statistics.mediumScoreCount,
        lowScoreCount: evaluationResult.statistics.lowScoreCount,
        relevantPostsFound: taskGenerationResult.statistics.relevantPostsFound,
        tasksGenerated: taskGenerationResult.statistics.tasksGenerated,
        draftsGenerated: taskGenerationResult.statistics.draftsGenerated,
        postsRecorded: recordingResult.recordedCount,
        recordingErrors: recordingResult.errors,
        totalProcessingTimeMs,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Reddit task orchestration failed:", error);

    return {
      success: false,
      tasks: [],
      statistics: {
        totalSubredditsTargeted: config.subreddits.length,
        totalPostsFetched: 0,
        fetchErrors: [],
        duplicateFilteringStats: {
          originalCount: 0,
          duplicatesFound: 0,
          newPostsCount: 0,
          processingTimeMs: 0,
        },
        duplicatesFiltered: 0,
        duplicateDetails: [],
        totalPostsEvaluated: 0,
        evaluationErrors: [],
        averageScore: 0,
        recommendedCount: 0,
        highScoreCount: 0,
        mediumScoreCount: 0,
        lowScoreCount: 0,
        relevantPostsFound: 0,
        tasksGenerated: 0,
        draftsGenerated: 0,
        postsRecorded: 0,
        recordingErrors: [],
        totalProcessingTimeMs: Date.now() - startTime,
      },
      error: errorMessage,
    };
  }
}
