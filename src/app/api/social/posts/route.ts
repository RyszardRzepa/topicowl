import { auth, clerkClient } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { users, projects, socialPosts } from "@/server/db/schema";
import { and, eq } from "drizzle-orm";
import type { ClerkPrivateMetadata } from "@/types";

type Provider = "reddit" | "x";

interface SocialPostRequest {
  projectId: number;
  providers: Provider[];
  base: { text: string };
  reddit?: { subreddit: string; title: string; text?: string };
  x?: { text?: string; mediaUrls?: string[] };
  publishScheduledAt?: string; // ISO
}

interface SocialPostResponse {
  success: boolean;
  data?: Array<{ id: number; provider: Provider; status: "scheduled" | "published"; publishScheduledAt?: string }>;
  error?: string;
}

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate user with Clerk
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // 2. Verify user exists in database
    const [userRecord] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId));
    if (!userRecord) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const body = (await request.json()) as SocialPostRequest;
    const { projectId, providers, base, reddit, x, publishScheduledAt } = body;

    if (!projectId || !providers || providers.length === 0 || !base?.text) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // 3. Verify project ownership
    const [projectRecord] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, userRecord.id)));
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
        return NextResponse.json({ error: "Invalid publishScheduledAt" }, { status: 400 });
      }
      if (scheduledDate <= new Date()) {
        return NextResponse.json({ error: "Scheduled date must be in the future" }, { status: 400 });
      }
    }

    const results: Array<{ id: number; provider: Provider; status: "scheduled" | "published"; publishScheduledAt?: string }> = [];

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
        if (!row) return NextResponse.json({ error: "Failed to create scheduled post" }, { status: 500 });
        results.push({ id: row.id, provider, status: "scheduled", publishScheduledAt: scheduledDate.toISOString() });
      }
      return NextResponse.json({ success: true, data: results } satisfies SocialPostResponse);
    }

    // Immediate posting: check connections and post per provider (minimal stub, full per-provider handlers will be in cron & here later)
    const clerk = await clerkClient();
    const user = await clerk.users.getUser(userId);
    const metadata = (user.privateMetadata ?? {}) as ClerkPrivateMetadata;

    for (const provider of providers) {
      if (provider === "reddit") {
        const conn = metadata.redditTokens?.[projectId.toString()];
        if (!conn) return NextResponse.json({ error: "Reddit not connected for this project" }, { status: 401 });
        // For now, do not post immediately in this version; store as published history for parity later if desired.
        const payload = { base, reddit };
        const inserted = await db
          .insert(socialPosts)
          .values({ projectId, userId, provider, payload, status: "published", publishedAt: new Date() })
          .returning({ id: socialPosts.id });
        const row = inserted[0];
        if (!row) return NextResponse.json({ error: "Failed to record post" }, { status: 500 });
        results.push({ id: row.id, provider, status: "published" });
      } else if (provider === "x") {
        const conn = metadata.xTokens?.[projectId.toString()];
        if (!conn) return NextResponse.json({ error: "X not connected for this project" }, { status: 401 });
        const payload = { base, x };
        const inserted = await db
          .insert(socialPosts)
          .values({ projectId, userId, provider, payload, status: "published", publishedAt: new Date() })
          .returning({ id: socialPosts.id });
        const row = inserted[0];
        if (!row) return NextResponse.json({ error: "Failed to record post" }, { status: 500 });
        results.push({ id: row.id, provider, status: "published" });
      }
    }

    return NextResponse.json({ success: true, data: results } satisfies SocialPostResponse);
  } catch (error) {
    console.error("Social post submission error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { searchParams } = new URL(request.url);
    const projectIdParam = searchParams.get("projectId");
    if (!projectIdParam) return NextResponse.json({ error: "Project ID is required" }, { status: 400 });
    const projectId = parseInt(projectIdParam, 10);
    if (isNaN(projectId)) return NextResponse.json({ error: "Invalid project ID" }, { status: 400 });

    const [projectRecord] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, userId)));
    if (!projectRecord) return NextResponse.json({ error: "Project not found or access denied" }, { status: 404 });

    const rows = await db
      .select({ id: socialPosts.id, provider: socialPosts.provider, status: socialPosts.status, publishScheduledAt: socialPosts.publishScheduledAt, publishedAt: socialPosts.publishedAt, errorMessage: socialPosts.errorMessage, createdAt: socialPosts.createdAt })
      .from(socialPosts)
      .where(and(eq(socialPosts.projectId, projectId), eq(socialPosts.userId, userId)));

    return NextResponse.json({ success: true, data: rows.map((r) => ({
      id: r.id,
      provider: r.provider,
      status: r.status,
      publishScheduledAt: r.publishScheduledAt?.toISOString() ?? null,
      publishedAt: r.publishedAt?.toISOString() ?? null,
      errorMessage: r.errorMessage ?? null,
      createdAt: r.createdAt.toISOString(),
    })) });
  } catch (error) {
    console.error("List social posts error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
