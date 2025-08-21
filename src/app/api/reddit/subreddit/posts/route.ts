import { auth, clerkClient } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { env } from "@/env";
import { db } from "@/server/db";
import { projects } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import type { ClerkPrivateMetadata } from "@/types";

// TypeScript interfaces for Reddit API responses
export interface RedditPost {
  id: string;
  title: string;
  author: string;
  url: string;
  selftext: string;
  ups: number;
  num_comments: number;
  created_utc: number;
  subreddit: string;
}

export interface RedditSubredditPostsResponse {
  posts: RedditPost[];
}

interface RedditTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

interface RedditPostsApiResponse {
  data: {
    children: Array<{
      data: {
        id: string;
        title: string;
        author: string;
        url: string;
        selftext: string;
        ups: number;
        num_comments: number;
        created_utc: number;
        subreddit: string;
      };
    }>;
  };
}

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const subreddit = searchParams.get("subreddit");
    const projectId = searchParams.get("projectId");

    if (!subreddit) {
      return NextResponse.json(
        { error: "Subreddit parameter is required" },
        { status: 400 },
      );
    }

    if (!projectId) {
      return NextResponse.json(
        { error: "Project ID is required" },
        { status: 400 },
      );
    }

    // Validate project ID format
    const projectIdNum = parseInt(projectId, 10);
    if (isNaN(projectIdNum)) {
      return NextResponse.json(
        { error: "Invalid project ID format" },
        { status: 400 },
      );
    }

    // Validate subreddit name format (basic validation)
    if (!/^[a-zA-Z0-9_]+$/.test(subreddit)) {
      return NextResponse.json(
        { error: "Invalid subreddit name format" },
        { status: 400 },
      );
    }

    // Verify project exists and user owns it
    const [project] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, projectIdNum), eq(projects.userId, userId)))
      .limit(1);

    if (!project) {
      return NextResponse.json(
        { error: "Project not found or access denied" },
        { status: 404 },
      );
    }

    // Get project-specific refresh token from Clerk private metadata
    const clerk = await clerkClient();
    const user = await clerk.users.getUser(userId);
    const metadata = (user.privateMetadata ?? {}) as ClerkPrivateMetadata;
    const projectConnection = metadata.redditTokens?.[projectId];

    if (!projectConnection) {
      return NextResponse.json(
        { error: "Reddit account not connected for this project" },
        { status: 401 },
      );
    }

    // Exchange refresh token for access token
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
          refresh_token: projectConnection.refreshToken,
        }),
      },
    );

    if (!tokenResponse.ok) {
      return NextResponse.json(
        { error: "Failed to refresh Reddit token" },
        { status: 401 },
      );
    }

    const tokenData = (await tokenResponse.json()) as RedditTokenResponse;

    // Update last used timestamp for this project connection
    const updatedMetadata = { ...metadata };
    if (updatedMetadata.redditTokens?.[projectId]) {
      updatedMetadata.redditTokens[projectId].lastUsedAt =
        new Date().toISOString();
      await clerk.users.updateUserMetadata(userId, {
        privateMetadata: updatedMetadata,
      });
    }

    // Call Reddit API to fetch recent posts from subreddit
    const postsResponse = await fetch(
      `https://oauth.reddit.com/r/${subreddit}/hot?limit=25`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          "User-Agent": "Contentbot/1.0",
        },
      },
    );

    if (!postsResponse.ok) {
      if (postsResponse.status === 404) {
        return NextResponse.json(
          { error: `Subreddit '${subreddit}' not found` },
          { status: 404 },
        );
      }
      if (postsResponse.status === 403) {
        return NextResponse.json(
          { error: `Access denied to subreddit '${subreddit}'` },
          { status: 403 },
        );
      }
      return NextResponse.json(
        { error: "Failed to fetch subreddit posts" },
        { status: 500 },
      );
    }

    const postsData = (await postsResponse.json()) as RedditPostsApiResponse;

    // Format post data
    const posts = postsData.data.children.map((child) => ({
      id: child.data.id,
      title: child.data.title,
      author: child.data.author,
      url: child.data.url,
      selftext: child.data.selftext.substring(0, 200), // Preview text (first 200 chars)
      ups: child.data.ups,
      num_comments: child.data.num_comments,
      created_utc: child.data.created_utc,
      subreddit: child.data.subreddit,
    }));

    return NextResponse.json({
      posts,
    } satisfies RedditSubredditPostsResponse);
  } catch (error) {
    console.error("Reddit subreddit posts error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
