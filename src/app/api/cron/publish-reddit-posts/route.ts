import { NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { db } from "@/server/db";
import { redditPosts } from "@/server/db/schema";
import { eq, and, lte, gte, count } from "drizzle-orm";
import { env } from "@/env";
import type { ClerkPrivateMetadata } from "@/types";

// Types colocated with this API route
export interface CronPublishRedditPostsResponse {
  success: boolean;
  data: {
    processed: number;
    published: number;
    failed: number;
    errors: string[];
  };
  message: string;
}

interface RedditTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

interface RedditSubmitApiResponse {
  json: {
    errors: string[][];
    data?: {
      id: string;
      url: string;
    };
  };
}

// Helper function to exchange refresh token for access token
async function getRedditAccessToken(refreshToken: string): Promise<string> {
  const tokenResponse = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      "Authorization": `Basic ${Buffer.from(`${env.REDDIT_CLIENT_ID}:${env.REDDIT_CLIENT_SECRET}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "Contentbot/1.0",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!tokenResponse.ok) {
    throw new Error(`Failed to refresh Reddit token: ${tokenResponse.status} ${tokenResponse.statusText}`);
  }

  const tokenData = await tokenResponse.json() as RedditTokenResponse;
  return tokenData.access_token;
}

// Helper function to submit post to Reddit
async function submitRedditPost(
  accessToken: string,
  subreddit: string,
  title: string,
  text: string
): Promise<string> {
  const submitResponse = await fetch("https://oauth.reddit.com/api/submit", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "Contentbot/1.0",
    },
    body: new URLSearchParams({
      kind: "self",
      sr: subreddit,
      title: title,
      text: text,
      api_type: "json",
    }),
  });

  if (!submitResponse.ok) {
    if (submitResponse.status === 403) {
      throw new Error("Access denied. You may not have permission to post in this subreddit.");
    }
    if (submitResponse.status === 429) {
      throw new Error("Rate limit exceeded. Please try again later.");
    }
    throw new Error(`Failed to submit post to Reddit: ${submitResponse.status} ${submitResponse.statusText}`);
  }

  const submitData = await submitResponse.json() as RedditSubmitApiResponse;

  // Check for Reddit API errors
  if (submitData.json.errors && submitData.json.errors.length > 0) {
    const errorMessages = submitData.json.errors.map(error => error[1] ?? error[0]).join(", ");
    throw new Error(`Reddit API error: ${errorMessages}`);
  }

  // Check if post was created successfully
  if (!submitData.json.data?.id) {
    throw new Error("Post submission failed - no post ID returned");
  }

  return submitData.json.data.id;
}

// Helper function to implement exponential backoff retry logic
async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Helper function to process a single scheduled post
async function processScheduledPost(post: {
  id: number;
  projectId: number;
  userId: string;
  subreddit: string;
  title: string;
  text: string;
  publishScheduledAt: Date | null;
}): Promise<{ success: boolean; error?: string }> {
  const maxRetries = 3;
  let lastError = "";

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Get user's Reddit refresh token from Clerk metadata
      const clerk = await clerkClient();
      const user = await clerk.users.getUser(post.userId);
      const metadata = (user.privateMetadata ?? {}) as ClerkPrivateMetadata;
      const projectConnection = metadata.redditTokens?.[post.projectId.toString()];

      if (!projectConnection) {
        throw new Error("Reddit account not connected for this project");
      }

      // Exchange refresh token for access token
      const accessToken = await getRedditAccessToken(projectConnection.refreshToken);

      // Submit post to Reddit
      const redditPostId = await submitRedditPost(
        accessToken,
        post.subreddit,
        post.title,
        post.text
      );

      // Update post status to published on success
      await db
        .update(redditPosts)
        .set({
          status: "published",
          publishedAt: new Date(),
          errorMessage: null, // Clear any previous error
          updatedAt: new Date(),
        })
        .where(eq(redditPosts.id, post.id));

      // Update last used timestamp for this project connection
      const updatedMetadata = { ...metadata };
      if (updatedMetadata.redditTokens?.[post.projectId.toString()]) {
        updatedMetadata.redditTokens[post.projectId.toString()]!.lastUsedAt = new Date().toISOString();
        await clerk.users.updateUserMetadata(post.userId, {
          privateMetadata: updatedMetadata
        });
      }

      console.log(`Successfully published Reddit post ${post.id} (Reddit ID: ${redditPostId})`);
      return { success: true };

    } catch (error) {
      lastError = error instanceof Error ? error.message : "Unknown error";
      console.error(`Attempt ${attempt}/${maxRetries} failed for post ${post.id}:`, lastError);

      // If this is not the last attempt, wait with exponential backoff
      if (attempt < maxRetries) {
        const backoffMs = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s
        console.log(`Retrying post ${post.id} in ${backoffMs}ms...`);
        await sleep(backoffMs);
      }
    }
  }

  // All retries failed, update post status to failed
  await db
    .update(redditPosts)
    .set({
      status: "failed",
      errorMessage: lastError,
      updatedAt: new Date(),
    })
    .where(eq(redditPosts.id, post.id));

  console.error(`Failed to publish Reddit post ${post.id} after ${maxRetries} attempts: ${lastError}`);
  return { success: false, error: lastError };
}

// POST /api/cron/publish-reddit-posts - Process scheduled Reddit posts
export async function POST() {
  try {
    const errors: string[] = [];
    let processed = 0;
    let published = 0;
    let failed = 0;

    console.log("Starting Reddit posts publishing cron job...");

    const now = new Date();

    // Query redditPosts table for posts with status 'scheduled' and publishScheduledAt <= NOW()
    const scheduledPosts = await db
      .select({
        id: redditPosts.id,
        projectId: redditPosts.projectId,
        userId: redditPosts.userId,
        subreddit: redditPosts.subreddit,
        title: redditPosts.title,
        text: redditPosts.text,
        publishScheduledAt: redditPosts.publishScheduledAt,
      })
      .from(redditPosts)
      .where(
        and(
          eq(redditPosts.status, "scheduled"),
          lte(redditPosts.publishScheduledAt, now)
        )
      );

    console.log(`Found ${scheduledPosts.length} posts ready for publishing`);

    // Process each due post
    for (const post of scheduledPosts) {
      // Validate that the post has all required fields
      if (!post.publishScheduledAt) {
        console.error(`Post ${post.id} has no scheduled time, skipping`);
        continue;
      }

      try {
        processed++;
        console.log(`Processing post ${post.id}: "${post.title}" to r/${post.subreddit}`);

        const result = await processScheduledPost(post);

        if (result.success) {
          published++;
        } else {
          failed++;
          if (result.error) {
            errors.push(`Post ${post.id}: ${result.error}`);
          }
        }

        // Add a small delay between posts to respect Reddit's rate limits
        await sleep(100); // 100ms delay between posts

      } catch (error) {
        processed++;
        failed++;
        const errorMsg = `Post ${post.id}: ${error instanceof Error ? error.message : "Unknown error"}`;
        console.error(`Error processing post ${post.id}:`, error);
        errors.push(errorMsg);

        // Update post status to failed
        try {
          await db
            .update(redditPosts)
            .set({
              status: "failed",
              errorMessage: errorMsg,
              updatedAt: new Date(),
            })
            .where(eq(redditPosts.id, post.id));
        } catch (dbError) {
          console.error(`Failed to update post ${post.id} status:`, dbError);
        }
      }
    }

    const response: CronPublishRedditPostsResponse = {
      success: true,
      data: {
        processed,
        published,
        failed,
        errors,
      },
      message: `Processed ${processed} posts: ${published} published, ${failed} failed`,
    };

    console.log("Reddit posts publishing cron job completed:", response);
    return NextResponse.json(response);

  } catch (error) {
    console.error("Reddit posts publishing cron job error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to process scheduled Reddit posts",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// GET /api/cron/publish-reddit-posts - Get cron job status (for monitoring)
export async function GET() {
  try {
    const now = new Date();

    // Get scheduled posts count
    const scheduledCountResult = await db
      .select({ count: count() })
      .from(redditPosts)
      .where(
        and(
          eq(redditPosts.status, "scheduled"),
          lte(redditPosts.publishScheduledAt, now)
        )
      );

    // Get total scheduled posts (including future ones)
    const totalScheduledCountResult = await db
      .select({ count: count() })
      .from(redditPosts)
      .where(eq(redditPosts.status, "scheduled"));

    // Get published posts count from today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    
    const publishedTodayCountResult = await db
      .select({ count: count() })
      .from(redditPosts)
      .where(
        and(
          eq(redditPosts.status, "published"),
          gte(redditPosts.publishedAt, todayStart)
        )
      );

    // Get failed posts count from today
    const failedTodayCountResult = await db
      .select({ count: count() })
      .from(redditPosts)
      .where(
        and(
          eq(redditPosts.status, "failed"),
          gte(redditPosts.updatedAt, todayStart)
        )
      );

    return NextResponse.json({
      success: true,
      data: {
        dueForPublishing: scheduledCountResult[0]?.count ?? 0,
        totalScheduled: totalScheduledCountResult[0]?.count ?? 0,
        publishedToday: publishedTodayCountResult[0]?.count ?? 0,
        failedToday: failedTodayCountResult[0]?.count ?? 0,
        timestamp: new Date().toISOString(),
      },
    });

  } catch (error) {
    console.error("Get Reddit cron status error:", error);
    return NextResponse.json(
      { error: "Failed to get Reddit cron job status" },
      { status: 500 }
    );
  }
}