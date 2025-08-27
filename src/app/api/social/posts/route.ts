import { auth, clerkClient } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { users, projects, socialPosts } from "@/server/db/schema";
import { and, eq } from "drizzle-orm";
import type { ClerkPrivateMetadata } from "@/types";
import { env } from "@/env";

type Provider = "reddit" | "x";

interface SocialPostRequest {
  projectId: number;
  providers: Provider[];
  base: { text: string };
  reddit?: {
    subreddit: string;
    title: string;
    text?: string;
  };
  x?: {
    text?: string;
    mediaUrls?: string[];
  };
  publishScheduledAt?: string; // ISO string
}

interface SocialPostResponse {
  success: boolean;
  data?: Array<{
    id: number;
    provider: Provider;
    status: "scheduled" | "published";
    publishScheduledAt?: string;
  }>;
  error?: string;
}

// Helper function to get Reddit access token from refresh token
async function getRedditAccessToken(refreshToken: string): Promise<string> {
  const tokenResponse = await fetch(
    "https://www.reddit.com/api/v1/access_token",
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${env.REDDIT_CLIENT_ID}:${env.REDDIT_CLIENT_SECRET}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "Contentbot/1.0",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    },
  );

  if (!tokenResponse.ok) {
    throw new Error(
      `Failed to refresh Reddit token: ${tokenResponse.status} ${tokenResponse.statusText}`,
    );
  }

  const tokenData = (await tokenResponse.json()) as { access_token: string };
  return tokenData.access_token;
}

// Helper function to submit post to Reddit
async function submitRedditPost(
  accessToken: string,
  subreddit: string,
  title: string,
  text: string,
): Promise<string> {
  const submitResponse = await fetch("https://oauth.reddit.com/api/submit", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
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
      throw new Error(
        "Access denied. You may not have permission to post in this subreddit.",
      );
    }
    if (submitResponse.status === 429) {
      throw new Error("Rate limit exceeded. Please try again later.");
    }
    throw new Error(
      `Failed to submit post to Reddit: ${submitResponse.status} ${submitResponse.statusText}`,
    );
  }

  const submitData = (await submitResponse.json()) as {
    json: {
      errors: Array<[string, string]>;
      data?: { id: string };
    };
  };

  // Check for Reddit API errors
  if (submitData.json.errors && submitData.json.errors.length > 0) {
    const errorMessages = submitData.json.errors
      .map((error) => error[1] ?? error[0])
      .join(", ");
    throw new Error(`Reddit API error: ${errorMessages}`);
  }

  // Check if post was created successfully
  if (!submitData.json.data?.id) {
    throw new Error("Post submission failed - no post ID returned");
  }

  return submitData.json.data.id;
}

// Helper function to get X access token from refresh token
async function ensureXAccessToken(
  refreshToken: string,
): Promise<{ accessToken: string; newRefreshToken?: string }> {
  const X_CLIENT_ID = String(env.X_CLIENT_ID);
  const X_CLIENT_SECRET = String(env.X_CLIENT_SECRET);

  // Use Basic Auth header instead of including credentials in body
  const authHeader = Buffer.from(`${X_CLIENT_ID}:${X_CLIENT_SECRET}`).toString(
    "base64",
  );

  const params = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  const resp = await fetch("https://api.twitter.com/2/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${authHeader}`,
    },
    body: params,
  });

  if (!resp.ok) {
    const errorText = await resp.text();
    console.error(`X token refresh error details:`, errorText);
    throw new Error(
      `X token refresh failed: ${resp.status} ${resp.statusText} - ${errorText}`,
    );
  }

  const data = (await resp.json()) as {
    access_token: string;
    refresh_token?: string;
  };
  return {
    accessToken: data.access_token,
    newRefreshToken: data.refresh_token,
  };
}

// Helper function to post to X
async function postToX(accessToken: string, text: string): Promise<string> {
  const resp = await fetch("https://api.twitter.com/2/tweets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text }),
  });
  if (!resp.ok)
    throw new Error(`X tweet failed: ${resp.status} ${resp.statusText}`);
  const data = (await resp.json()) as { data?: { id: string } };
  if (!data.data?.id) throw new Error("X API: No tweet id returned");
  return data.data.id;
}

// Helper function to sleep for rate limiting
async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate user with Clerk
    const { userId } = await auth();
    if (!userId)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // 2. Verify user exists in database
    const [userRecord] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, userId));
    if (!userRecord)
      return NextResponse.json({ error: "User not found" }, { status: 404 });

    const body = (await request.json()) as SocialPostRequest;
    const { projectId, providers, base, reddit, x, publishScheduledAt } = body;

    // Validate required fields
    if (
      !projectId ||
      !providers ||
      providers.length === 0 ||
      !base?.text?.trim()
    ) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    // Validate provider-specific data
    if (providers.includes("reddit")) {
      if (!reddit?.subreddit?.trim() || !reddit?.title?.trim()) {
        return NextResponse.json(
          { error: "Reddit requires subreddit and title" },
          { status: 400 },
        );
      }
    }

    if (providers.includes("x")) {
      const xText = x?.text?.trim() ?? base.text.trim();
      if (!xText) {
        return NextResponse.json(
          { error: "X requires text content" },
          { status: 400 },
        );
      }
      if (xText.length > 280) {
        return NextResponse.json(
          { error: "X text must be 280 characters or less" },
          { status: 400 },
        );
      }
    }

    // 3. Verify project ownership
    const [projectRecord] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(
        and(eq(projects.id, projectId), eq(projects.userId, userRecord.id)),
      );
    if (!projectRecord) {
      return NextResponse.json(
        { error: "Project not found or access denied" },
        { status: 404 },
      );
    }

    // Validate schedule
    let scheduledDate: Date | null = null;
    if (publishScheduledAt) {
      scheduledDate = new Date(publishScheduledAt);
      if (isNaN(scheduledDate.getTime())) {
        return NextResponse.json(
          { error: "Invalid publishScheduledAt" },
          { status: 400 },
        );
      }
      if (scheduledDate <= new Date()) {
        return NextResponse.json(
          { error: "Scheduled date must be in the future" },
          { status: 400 },
        );
      }
    }

    const results: Array<{
      id: number;
      provider: Provider;
      status: "scheduled" | "published";
      publishScheduledAt?: string;
    }> = [];

    // If scheduling: insert one row per provider
    if (scheduledDate) {
      for (const provider of providers) {
        const payload = { base, reddit, x };
        const inserted = await db
          .insert(socialPosts)
          .values({
            projectId,
            userId,
            provider,
            payload,
            status: "scheduled",
            publishScheduledAt: scheduledDate,
          })
          .returning({ id: socialPosts.id });
        const row = inserted[0];
        if (!row)
          return NextResponse.json(
            { error: "Failed to create scheduled post" },
            { status: 500 },
          );
        results.push({
          id: row.id,
          provider,
          status: "scheduled",
          publishScheduledAt: scheduledDate.toISOString(),
        });
      }
      return NextResponse.json({
        success: true,
        data: results,
      } satisfies SocialPostResponse);
    }

    // Immediate posting: check connections and post per provider
    const clerk = await clerkClient();
    const user = await clerk.users.getUser(userId);
    const metadata = (user.privateMetadata ?? {}) as ClerkPrivateMetadata;

    const publishedResults: Array<{
      id: number;
      provider: Provider;
      status: "published";
    }> = [];
    const errors: string[] = [];

    for (const provider of providers) {
      try {
        if (provider === "reddit") {
          const conn = metadata.redditTokens?.[projectId.toString()];
          if (!conn) {
            errors.push("Reddit not connected for this project");
            continue;
          }

          if (!reddit?.subreddit || !reddit?.title) {
            errors.push("Reddit requires subreddit and title");
            continue;
          }

          // Get access token and submit post
          const accessToken = await getRedditAccessToken(conn.refreshToken);
          const redditPostId = await submitRedditPost(
            accessToken,
            reddit.subreddit,
            reddit.title,
            reddit.text ?? base.text,
          );

          // Store record as published for history
          const payload = { base, reddit };
          const inserted = await db
            .insert(socialPosts)
            .values({
              projectId,
              userId,
              provider,
              payload,
              status: "published",
              publishedAt: new Date(),
            })
            .returning({ id: socialPosts.id });

          const row = inserted[0];
          if (!row) {
            errors.push("Failed to record Reddit post");
            continue;
          }

          publishedResults.push({ id: row.id, provider, status: "published" });

          // Update last used timestamp
          const updatedMetadata = { ...metadata };
          if (updatedMetadata.redditTokens?.[projectId.toString()]) {
            updatedMetadata.redditTokens[projectId.toString()]!.lastUsedAt =
              new Date().toISOString();
            await clerk.users.updateUserMetadata(userId, {
              privateMetadata: updatedMetadata,
            });
          }

          console.log(`Successfully posted to Reddit: ${redditPostId}`);
        } else if (provider === "x") {
          const conn = metadata.xTokens?.[projectId.toString()];
          if (!conn) {
            errors.push("X not connected for this project");
            continue;
          }

          if (!conn.refreshToken) {
            errors.push(
              "X refresh token is missing - please reconnect your X account",
            );
            continue;
          }

          const text = x?.text ?? base.text;
          if (!text.trim()) {
            errors.push("X requires text content");
            continue;
          }

          // Get access token and submit post
          try {
            const { accessToken, newRefreshToken } = await ensureXAccessToken(
              conn.refreshToken,
            );
            const tweetId = await postToX(accessToken, text);

            // Store record as published for history
            const payload = { base, x };
            const inserted = await db
              .insert(socialPosts)
              .values({
                projectId,
                userId,
                provider,
                payload,
                status: "published",
                publishedAt: new Date(),
              })
              .returning({ id: socialPosts.id });

            const row = inserted[0];
            if (!row) {
              errors.push("Failed to record X post");
              continue;
            }

            publishedResults.push({
              id: row.id,
              provider,
              status: "published",
            });

            // Update tokens if refreshed
            if (newRefreshToken) {
              const updatedMetadata = { ...metadata };
              if (updatedMetadata.xTokens?.[projectId.toString()]) {
                updatedMetadata.xTokens[projectId.toString()]!.refreshToken =
                  newRefreshToken;
                updatedMetadata.xTokens[projectId.toString()]!.lastUsedAt =
                  new Date().toISOString();
                await clerk.users.updateUserMetadata(userId, {
                  privateMetadata: updatedMetadata,
                });
              }
            }

            console.log(`Successfully posted to X: ${tweetId}`);
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : "Unknown error";
            // Check if this is a token issue that requires re-authentication
            if (
              errorMessage.includes("401") ||
              errorMessage.includes("invalid_client") ||
              errorMessage.includes("invalid_grant")
            ) {
              errors.push(
                "X authentication expired - please reconnect your X account in settings",
              );
            } else {
              errors.push(`X: ${errorMessage}`);
            }
            console.error(`Failed to post to X:`, error);
            continue;
          }
        }

        // Rate limiting between posts
        await sleep(100);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        errors.push(`${provider}: ${errorMessage}`);
        console.error(`Failed to post to ${provider}:`, error);
      }
    }

    // Handle partial failures
    if (publishedResults.length === 0 && errors.length > 0) {
      return NextResponse.json(
        { error: `All posts failed: ${errors.join(", ")}` },
        { status: 400 },
      );
    }

    if (errors.length > 0) {
      console.warn(`Partial success: ${errors.join(", ")}`);
    }

    return NextResponse.json({
      success: true,
      data: publishedResults,
    } satisfies SocialPostResponse);
  } catch (error) {
    console.error("Social post submission error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { searchParams } = new URL(request.url);
    const projectIdParam = searchParams.get("projectId");
    if (!projectIdParam)
      return NextResponse.json(
        { error: "Project ID is required" },
        { status: 400 },
      );
    const projectId = parseInt(projectIdParam, 10);
    if (isNaN(projectId))
      return NextResponse.json(
        { error: "Invalid project ID" },
        { status: 400 },
      );

    const [projectRecord] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, userId)));
    if (!projectRecord)
      return NextResponse.json(
        { error: "Project not found or access denied" },
        { status: 404 },
      );

    const rows = await db
      .select({
        id: socialPosts.id,
        provider: socialPosts.provider,
        status: socialPosts.status,
        publishScheduledAt: socialPosts.publishScheduledAt,
        publishedAt: socialPosts.publishedAt,
        errorMessage: socialPosts.errorMessage,
        createdAt: socialPosts.createdAt,
      })
      .from(socialPosts)
      .where(
        and(
          eq(socialPosts.projectId, projectId),
          eq(socialPosts.userId, userId),
        ),
      );

    return NextResponse.json({
      success: true,
      data: rows.map((r) => ({
        id: r.id,
        provider: r.provider,
        status: r.status,
        publishScheduledAt: r.publishScheduledAt?.toISOString() ?? null,
        publishedAt: r.publishedAt?.toISOString() ?? null,
        errorMessage: r.errorMessage ?? null,
        createdAt: r.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("List social posts error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
