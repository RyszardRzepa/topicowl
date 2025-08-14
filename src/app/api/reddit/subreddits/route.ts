import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { env } from "@/env";
import { db } from "@/server/db";
import { projects } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import type { ClerkPrivateMetadata } from "@/types";

// TypeScript interfaces for Reddit API responses
export interface RedditSubredditSearchResponse {
  names: string[];
}

interface RedditSearchNamesApiResponse {
  names: string[];
}

interface RedditTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query");
    const projectId = searchParams.get("projectId");

    if (!query) {
      return NextResponse.json({ error: "Query parameter is required" }, { status: 400 });
    }

    if (!projectId) {
      return NextResponse.json({ error: "Project ID is required" }, { status: 400 });
    }

    // Validate project ID format
    const projectIdNum = parseInt(projectId, 10);
    if (isNaN(projectIdNum)) {
      return NextResponse.json({ error: "Invalid project ID format" }, { status: 400 });
    }

    // Verify project exists and user owns it
    const [project] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, projectIdNum), eq(projects.userId, userId)))
      .limit(1);

    if (!project) {
      return NextResponse.json({ error: "Project not found or access denied" }, { status: 404 });
    }

    // Get project-specific refresh token from Clerk private metadata
    const clerk = await clerkClient();
    const user = await clerk.users.getUser(userId);
    const metadata = (user.privateMetadata ?? {}) as ClerkPrivateMetadata;
    const projectConnection = metadata.redditTokens?.[projectId];

    if (!projectConnection) {
      return NextResponse.json({ error: "Reddit account not connected for this project" }, { status: 401 });
    }

    // Exchange refresh token for access token
    const tokenResponse = await fetch("https://www.reddit.com/api/v1/access_token", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${Buffer.from(`${env.REDDIT_CLIENT_ID}:${env.REDDIT_CLIENT_SECRET}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "Contentbot/1.0",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: projectConnection.refreshToken,
      }),
    });

    if (!tokenResponse.ok) {
      return NextResponse.json({ error: "Failed to refresh Reddit token" }, { status: 401 });
    }

    const tokenData: RedditTokenResponse = await tokenResponse.json();

    // Update last used timestamp for this project connection
    const updatedMetadata = { ...metadata };
    if (updatedMetadata.redditTokens?.[projectId]) {
      updatedMetadata.redditTokens[projectId].lastUsedAt = new Date().toISOString();
      await clerk.users.updateUserMetadata(userId, {
        privateMetadata: updatedMetadata
      });
    }

    // Call Reddit's search_reddit_names API
    const searchResponse = await fetch(`https://oauth.reddit.com/api/search_reddit_names?query=${encodeURIComponent(query)}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${tokenData.access_token}`,
        "User-Agent": "Contentbot/1.0",
      },
    });

    if (!searchResponse.ok) {
      return NextResponse.json({ error: "Failed to search subreddits" }, { status: 500 });
    }

    const searchData: RedditSearchNamesApiResponse = await searchResponse.json();

    // Return formatted list of subreddit names
    return NextResponse.json({
      names: searchData.names ?? [],
    } satisfies RedditSubredditSearchResponse);

  } catch (error) {
    console.error("Reddit subreddit search error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}