import { db } from "@/server/db";
import { redditProcessedPosts } from "@/server/db/schema";
import { inArray, eq, and } from "drizzle-orm";
import type { RedditPost } from "./api";

// Interfaces for duplicate prevention
export interface DuplicateFilterResult {
  newPosts: RedditPost[];
  duplicateCount: number;
  duplicatePosts: Array<{
    postId: string;
    title: string;
    subreddit: string;
  }>;
  totalProcessed: number;
  filteringStats: {
    originalCount: number;
    duplicatesFound: number;
    newPostsCount: number;
    processingTimeMs: number;
  };
}

export interface ProcessedPostRecord {
  projectId: number;
  postId: string;
  subreddit: string;
  postTitle: string;
  postUrl: string;
}

export interface RecordProcessedPostsResult {
  recordedCount: number;
  skippedCount: number;
  errors: Array<{
    postId: string;
    error: string;
  }>;
}

/**
 * Normalizes Reddit post ID to consistent "t3_" format
 */
function normalizeRedditPostId(postId: string): string {
  if (postId.startsWith("t3_")) {
    return postId;
  }
  return `t3_${postId}`;
}

/**
 * Validates Reddit post data for processing
 */
function validateRedditPost(post: RedditPost): boolean {
  return !!(
    post.id &&
    post.subreddit &&
    post.title &&
    post.permalink
  );
}

/**
 * Constructs full Reddit URL from permalink
 */
function constructRedditUrl(permalink: string): string {
  if (permalink.startsWith("http")) {
    return permalink;
  }
  return `https://www.reddit.com${permalink}`;
}

/**
 * Gets existing processed post IDs for batch duplicate checking
 */
export async function getExistingProcessedPostIds(
  projectId: number,
  postIds: string[]
): Promise<Set<string>> {
  if (postIds.length === 0) {
    return new Set();
  }

  try {
    // Normalize all post IDs to t3_ format for consistent checking
    const normalizedPostIds = postIds.map(normalizeRedditPostId);

    const existingPosts = await db
      .select({ postId: redditProcessedPosts.postId })
      .from(redditProcessedPosts)
      .where(
        and(
          eq(redditProcessedPosts.projectId, projectId),
          inArray(redditProcessedPosts.postId, normalizedPostIds)
        )
      );

    return new Set(existingPosts.map(post => post.postId));
  } catch (error) {
    console.warn("Failed to check for existing processed posts:", error);
    // Return empty set to allow processing to continue
    return new Set();
  }
}

/**
 * Filters out duplicate posts that have already been processed
 */
export async function filterDuplicatePosts(
  projectId: number,
  posts: RedditPost[]
): Promise<DuplicateFilterResult> {
  const startTime = Date.now();
  const originalCount = posts.length;

  if (posts.length === 0) {
    return {
      newPosts: [],
      duplicateCount: 0,
      duplicatePosts: [],
      totalProcessed: 0,
      filteringStats: {
        originalCount: 0,
        duplicatesFound: 0,
        newPostsCount: 0,
        processingTimeMs: Date.now() - startTime,
      },
    };
  }

  try {
    // Validate posts and extract IDs
    const validPosts = posts.filter(validateRedditPost);
    const postIds = validPosts.map(post => post.id);

    if (validPosts.length !== posts.length) {
      console.warn(
        `Filtered out ${posts.length - validPosts.length} invalid posts during duplicate checking`
      );
    }

    // Get existing processed post IDs
    const existingPostIds = await getExistingProcessedPostIds(projectId, postIds);

    // Separate new posts from duplicates
    const newPosts: RedditPost[] = [];
    const duplicatePosts: Array<{
      postId: string;
      title: string;
      subreddit: string;
    }> = [];

    for (const post of validPosts) {
      const normalizedPostId = normalizeRedditPostId(post.id);
      
      if (existingPostIds.has(normalizedPostId)) {
        duplicatePosts.push({
          postId: normalizedPostId,
          title: post.title,
          subreddit: post.subreddit,
        });
      } else {
        newPosts.push(post);
      }
    }

    const processingTimeMs = Date.now() - startTime;

    // Log filtering statistics
    console.log(
      `Duplicate filtering completed: ${originalCount} original posts, ` +
      `${duplicatePosts.length} duplicates found, ${newPosts.length} new posts remaining ` +
      `(${processingTimeMs}ms)`
    );

    if (duplicatePosts.length > 0) {
      console.log(
        `Duplicate posts filtered: ${duplicatePosts.map(p => 
          `${p.postId} (r/${p.subreddit}: "${p.title.substring(0, 50)}...")`
        ).join(", ")}`
      );
    }

    return {
      newPosts,
      duplicateCount: duplicatePosts.length,
      duplicatePosts,
      totalProcessed: validPosts.length,
      filteringStats: {
        originalCount,
        duplicatesFound: duplicatePosts.length,
        newPostsCount: newPosts.length,
        processingTimeMs,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn("Duplicate filtering failed, allowing all posts through:", errorMessage);

    // Fall back to processing all posts when duplicate checking fails
    const validPosts = posts.filter(validateRedditPost);
    
    return {
      newPosts: validPosts,
      duplicateCount: 0,
      duplicatePosts: [],
      totalProcessed: validPosts.length,
      filteringStats: {
        originalCount,
        duplicatesFound: 0,
        newPostsCount: validPosts.length,
        processingTimeMs: Date.now() - startTime,
      },
    };
  }
}

/**
 * Records processed posts in the database with batch insertion and conflict handling
 */
export async function recordProcessedPosts(
  records: ProcessedPostRecord[]
): Promise<RecordProcessedPostsResult> {
  if (records.length === 0) {
    return {
      recordedCount: 0,
      skippedCount: 0,
      errors: [],
    };
  }

  const errors: Array<{ postId: string; error: string }> = [];
  let recordedCount = 0;
  let skippedCount = 0;

  try {
    // Prepare records for insertion with normalized post IDs
    const insertRecords = records.map(record => ({
      projectId: record.projectId,
      postId: normalizeRedditPostId(record.postId),
      subreddit: record.subreddit,
      postTitle: record.postTitle,
      postUrl: constructRedditUrl(record.postUrl),
    }));

    // Use batch insertion with conflict handling
    // The unique constraint on (projectId, postId) will prevent duplicates
    const result = await db
      .insert(redditProcessedPosts)
      .values(insertRecords)
      .onConflictDoNothing({
        target: [redditProcessedPosts.projectId, redditProcessedPosts.postId],
      })
      .returning({ postId: redditProcessedPosts.postId });

    recordedCount = result.length;
    skippedCount = records.length - recordedCount;

    console.log(
      `Recorded ${recordedCount} processed posts, skipped ${skippedCount} duplicates`
    );

    if (recordedCount > 0) {
      console.log(
        `Recorded posts: ${result.map(r => r.postId).join(", ")}`
      );
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Failed to record processed posts:", errorMessage);

    // Add error for all records if batch insertion fails
    for (const record of records) {
      errors.push({
        postId: normalizeRedditPostId(record.postId),
        error: errorMessage,
      });
    }
  }

  return {
    recordedCount,
    skippedCount,
    errors,
  };
}