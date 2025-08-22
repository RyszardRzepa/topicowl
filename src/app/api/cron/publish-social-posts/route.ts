import { NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { db } from "@/server/db";
import { socialPosts } from "@/server/db/schema";
import { and, count, eq, gte, lte } from "drizzle-orm";
import { env } from "@/env";
import type { ClerkPrivateMetadata } from "@/types";

interface CronResponse {
  success: boolean;
  data: { processed: number; published: number; failed: number; errors: string[] };
  message: string;
}

// Helpers
async function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

async function postToReddit(
  refreshToken: string,
  subreddit: string,
  title: string,
  text: string,
): Promise<string> {
  // This cron is focused on social_posts; reddit immediate flow remains in existing cron for reddit_posts
  // For now we won't implement immediate Reddit publish here; placeholder for future if needed.
  // You can reuse the logic from publish-reddit-posts if migrating fully.
  throw new Error("Reddit publish via social_posts not implemented in this phase");
}

async function ensureXAccessToken(refreshToken: string): Promise<{ accessToken: string; newRefreshToken?: string }> {
  const params = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: String(env.X_CLIENT_ID),
    client_secret: String(env.X_CLIENT_SECRET),
    refresh_token: refreshToken,
  });
  const resp = await fetch("https://api.twitter.com/2/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });
  if (!resp.ok) throw new Error(`X token refresh failed: ${resp.status} ${resp.statusText}`);
  const data = (await resp.json()) as { access_token: string; refresh_token?: string };
  return { accessToken: data.access_token, newRefreshToken: data.refresh_token };
}

async function postToX(accessToken: string, text: string): Promise<string> {
  const resp = await fetch("https://api.twitter.com/2/tweets", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!resp.ok) throw new Error(`X tweet failed: ${resp.status} ${resp.statusText}`);
  const data = (await resp.json()) as { data?: { id: string } };
  if (!data.data?.id) throw new Error("X API: No tweet id returned");
  return data.data.id;
}

export async function POST() {
  try {
    const now = new Date();
    let processed = 0, published = 0, failed = 0;
    const errors: string[] = [];

    const due = await db
      .select({ id: socialPosts.id, provider: socialPosts.provider, userId: socialPosts.userId, projectId: socialPosts.projectId, payload: socialPosts.payload })
      .from(socialPosts)
      .where(and(eq(socialPosts.status, "scheduled"), lte(socialPosts.publishScheduledAt, now)));

    for (const row of due) {
      processed++;
      try {
        const clerk = await clerkClient();
        const user = await clerk.users.getUser(row.userId);
        const meta = (user.privateMetadata ?? {}) as ClerkPrivateMetadata;
        if (row.provider === "x") {
          const xConn = meta.xTokens?.[row.projectId.toString()];
          if (!xConn) throw new Error("X not connected for this project");
          const { accessToken, newRefreshToken } = await ensureXAccessToken(xConn.refreshToken);
          const text: string = (row.payload as any)?.x?.text ?? (row.payload as any)?.base?.text ?? "";
          if (!text) throw new Error("Missing text for X");
          const tweetId = await postToX(accessToken, text);
          await db.update(socialPosts).set({ status: "published", publishedAt: new Date(), updatedAt: new Date() }).where(eq(socialPosts.id, row.id));
          if (newRefreshToken) {
            // persist rotated token
            meta.xTokens![row.projectId.toString()]!.refreshToken = newRefreshToken;
            await clerk.users.updateUserMetadata(row.userId, { privateMetadata: meta });
          }
          published++;
        } else if (row.provider === "reddit") {
          // Placeholder: we keep reddit_posts cron as source of truth for now
          throw new Error("Reddit via social_posts not enabled yet");
        }
        await sleep(100);
      } catch (e) {
        failed++;
        const msg = e instanceof Error ? e.message : "Unknown error";
        errors.push(`Post ${row.id}: ${msg}`);
        await db.update(socialPosts).set({ status: "failed", errorMessage: msg, updatedAt: new Date() }).where(eq(socialPosts.id, row.id));
      }
    }

    const res: CronResponse = { success: true, data: { processed, published, failed, errors }, message: `Processed ${processed}` };
    return NextResponse.json(res);
  } catch (error) {
    console.error("Social posts cron error:", error);
    return NextResponse.json({ success: false, error: "Failed to process social posts" }, { status: 500 } as any);
  }
}

export async function GET() {
  try {
    const now = new Date();
    const dueCount = await db.select({ c: count() }).from(socialPosts).where(and(eq(socialPosts.status, "scheduled"), lte(socialPosts.publishScheduledAt, now)));
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const publishedToday = await db.select({ c: count() }).from(socialPosts).where(and(eq(socialPosts.status, "published"), gte(socialPosts.publishedAt, today)));
    const failedToday = await db.select({ c: count() }).from(socialPosts).where(and(eq(socialPosts.status, "failed"), gte(socialPosts.updatedAt, today)));
    return NextResponse.json({ success: true, data: { dueForPublishing: dueCount[0]?.c ?? 0, publishedToday: publishedToday[0]?.c ?? 0, failedToday: failedToday[0]?.c ?? 0, timestamp: new Date().toISOString() } });
  } catch (error) {
    console.error("Social cron status error:", error);
    return NextResponse.json({ error: "Failed to get cron status" }, { status: 500 });
  }
}
