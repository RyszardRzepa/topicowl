import { NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { db } from "@/server/db";
import { socialPosts } from "@/server/db/schema";
import { and, count, eq, gte, lte } from "drizzle-orm";
import { env } from "@/env";
import type { ClerkPrivateMetadata } from "@/types";
import { z } from "zod";

interface CronResponse {
  success: boolean;
  data: {
    processed: number;
    published: number;
    failed: number;
    errors: string[];
  };
  message: string;
}

const socialPostPayloadSchema = z
  .object({
    base: z.object({ text: z.string() }),
    reddit: z
      .object({
        subreddit: z.string(),
        title: z.string(),
        text: z.string().optional(),
      })
      .optional(),
    x: z
      .object({
        text: z.string().optional(),
        mediaUrls: z.array(z.string()).optional(),
      })
      .optional(),
  })
  .passthrough();

type SocialPostPayload = z.infer<typeof socialPostPayloadSchema>;

const socialPostRowSchema = z
  .object({
    id: z.number(),
    provider: z.string(),
    userId: z.string(),
    projectId: z.number(),
    payload: z.unknown(),
  })
  .passthrough();

const clerkMetadataSchema = z
  .object({
    redditTokens: z
      .record(
        z
          .object({
            refreshToken: z.string(),
            redditUsername: z.string(),
            redditUserId: z.string(),
            connectedAt: z.string(),
            lastUsedAt: z.string().optional(),
            scopes: z.array(z.string()),
          })
          .passthrough(),
      )
      .optional(),
    xTokens: z
      .record(
        z
          .object({
            refreshToken: z.string(),
            accessToken: z.string().optional(),
            expiresAt: z.string().optional(),
            xUsername: z.string(),
            xUserId: z.string(),
            connectedAt: z.string(),
            lastUsedAt: z.string().optional(),
            scopes: z.array(z.string()),
          })
          .passthrough(),
      )
      .optional(),
  })
  .passthrough();

// Helpers
async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function postToReddit(
  refreshToken: string,
  subreddit: string,
  title: string,
  text: string,
): Promise<string> {
  // Get access token from refresh token
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
  const accessToken = tokenData.access_token;

  // Submit post to Reddit
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

export async function POST() {
  try {
    const now = new Date();
    let processed = 0,
      published = 0,
      failed = 0;
    const errors: string[] = [];

    const due = await db.query.socialPosts.findMany({
      columns: {
        id: true,
        provider: true,
        userId: true,
        projectId: true,
        payload: true,
      },
      where: (posts, { eq, lte }) =>
        and(eq(posts.status, "scheduled"), lte(posts.publishScheduledAt, now)),
    });

    for (const rawRow of due) {
      processed++;
      const rowResult = socialPostRowSchema.safeParse(rawRow);
      if (!rowResult.success) {
        failed++;
        const identifier =
          typeof rawRow === "object" &&
          rawRow !== null &&
          "id" in rawRow &&
          (typeof rawRow.id === "number" || typeof rawRow.id === "string")
            ? String(rawRow.id)
            : "unknown";
        errors.push(
          `Post ${identifier}: Invalid record - ${rowResult.error.message}`,
        );
        continue;
      }
      const row = rowResult.data;

      try {
        const clerk = await clerkClient();
        const user = await clerk.users.getUser(row.userId);
        const metadataResult = clerkMetadataSchema.safeParse(
          user.privateMetadata ?? {},
        );
        const meta: ClerkPrivateMetadata = metadataResult.success
          ? metadataResult.data
          : {};
        const payloadResult = socialPostPayloadSchema.safeParse(row.payload);
        if (!payloadResult.success) {
          throw new Error("Invalid social post payload");
        }
        const payload: SocialPostPayload = payloadResult.data;

        if (row.provider === "reddit") {
          const redditConn = meta.redditTokens?.[row.projectId.toString()];
          if (!redditConn)
            throw new Error("Reddit not connected for this project");

          if (!payload.reddit?.subreddit || !payload.reddit?.title) {
            throw new Error("Missing Reddit subreddit or title");
          }

          const redditPostId = await postToReddit(
            redditConn.refreshToken,
            payload.reddit.subreddit,
            payload.reddit.title,
            payload.reddit.text ?? payload.base.text,
          );

          await db
            .update(socialPosts)
            .set({
              status: "published",
              publishedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(socialPosts.id, row.id));

          // Update last used timestamp
          redditConn.lastUsedAt = new Date().toISOString();
          await clerk.users.updateUserMetadata(row.userId, {
            privateMetadata: meta,
          });

          console.log(
            `Successfully published Reddit post ${row.id} (Reddit ID: ${redditPostId})`,
          );
          published++;
        } else if (row.provider === "x") {
          const xConn = meta.xTokens?.[row.projectId.toString()];
          if (!xConn) throw new Error("X not connected for this project");

          if (!xConn.refreshToken) {
            throw new Error(
              "X refresh token is missing - please reconnect your X account",
            );
          }

          try {
            const { accessToken, newRefreshToken } = await ensureXAccessToken(
              xConn.refreshToken,
            );
            const text = payload.x?.text ?? payload.base.text;
            if (!text) throw new Error("Missing text for X");

            const tweetId = await postToX(accessToken, text);

            await db
              .update(socialPosts)
              .set({
                status: "published",
                publishedAt: new Date(),
                updatedAt: new Date(),
              })
              .where(eq(socialPosts.id, row.id));

            if (newRefreshToken) {
              // persist rotated token
              xConn.refreshToken = newRefreshToken;
            }
            xConn.lastUsedAt = new Date().toISOString();
            await clerk.users.updateUserMetadata(row.userId, {
              privateMetadata: meta,
            });

            console.log(
              `Successfully published X post ${row.id} (Tweet ID: ${tweetId})`,
            );
            published++;
          } catch (tokenError) {
            const tokenErrorMessage =
              tokenError instanceof Error
                ? tokenError.message
                : "Unknown token error";
            // If it's an authentication error, provide helpful message
            if (
              tokenErrorMessage.includes("401") ||
              tokenErrorMessage.includes("invalid_client") ||
              tokenErrorMessage.includes("invalid_grant")
            ) {
              throw new Error(
                "X authentication expired - please reconnect your X account in settings",
              );
            } else {
              throw tokenError;
            }
          }
        }

        await sleep(100);
      } catch (e) {
        failed++;
        const msg = e instanceof Error ? e.message : "Unknown error";
        errors.push(`Post ${row.id}: ${msg}`);
        await db
          .update(socialPosts)
          .set({ status: "failed", errorMessage: msg, updatedAt: new Date() })
          .where(eq(socialPosts.id, row.id));
      }
    }

    const res: CronResponse = {
      success: true,
      data: { processed, published, failed, errors },
      message: `Processed ${processed}`,
    };
    return NextResponse.json(res);
  } catch (error) {
    console.error("Social posts cron error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to process social posts" },
      { status: 500 },
    );
  }
}

export async function GET() {
  try {
    const now = new Date();
    const dueCount = await db
      .select({ c: count() })
      .from(socialPosts)
      .where(
        and(
          eq(socialPosts.status, "scheduled"),
          lte(socialPosts.publishScheduledAt, now),
        ),
      );
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const publishedToday = await db
      .select({ c: count() })
      .from(socialPosts)
      .where(
        and(
          eq(socialPosts.status, "published"),
          gte(socialPosts.publishedAt, today),
        ),
      );
    const failedToday = await db
      .select({ c: count() })
      .from(socialPosts)
      .where(
        and(
          eq(socialPosts.status, "failed"),
          gte(socialPosts.updatedAt, today),
        ),
      );
    return NextResponse.json({
      success: true,
      data: {
        dueForPublishing: dueCount[0]?.c ?? 0,
        publishedToday: publishedToday[0]?.c ?? 0,
        failedToday: failedToday[0]?.c ?? 0,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Social cron status error:", error);
    return NextResponse.json(
      { error: "Failed to get cron status" },
      { status: 500 },
    );
  }
}
