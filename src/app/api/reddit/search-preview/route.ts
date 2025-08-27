import { auth, clerkClient } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { env } from "@/env";
import { db } from "@/server/db";
import { projects } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import type { ClerkPrivateMetadata } from "@/types";

// TypeScript interfaces for Reddit API responses
export interface RedditSearchPreviewRequest {
  subreddit: string;
  keywords: string[];
  timeRange: "1h" | "24h";
  maxResults: number;
  projectId: number;
}

export interface RedditSearchPreviewResponse {
  success: boolean;
  posts: RedditPost[];
  totalFound: number;
  error?: string;
}

interface RedditPost {
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

interface RedditTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

interface RedditListing {
  data: {
    children: Array<{
      data: RedditPost;
    }>;
  };
}

export async function POST(request: NextRequest) {
  
  try {
    const { userId } = await auth();
    console.log("👤 User ID:", userId ? "authenticated" : "not authenticated");
    
    if (!userId) {
      return NextResponse.json(
        { success: false, posts: [], totalFound: 0, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = (await request.json()) as RedditSearchPreviewRequest;
    console.log("📦 Request body:", { subreddit: body.subreddit, projectId: body.projectId, timeRange: body.timeRange });
    
    const { subreddit, keywords, timeRange, maxResults, projectId } = body;

    // Validate required fields
    if (!subreddit || !projectId) {
      console.log("❌ Missing required fields:", { subreddit, projectId });
      return NextResponse.json(
        { success: false, posts: [], totalFound: 0, error: "Subreddit and project ID are required" },
        { status: 400 }
      );
    }

    // Verify project ownership
    console.log("🔍 Verifying project ownership...");
    const [project] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
      .limit(1);

    console.log("📝 Project found:", project ? "yes" : "no");

    if (!project) {
      return NextResponse.json(
        { success: false, posts: [], totalFound: 0, error: "Project not found or access denied" },
        { status: 404 }
      );
    }

    // Get project-specific refresh token from Clerk private metadata
    console.log("🔑 Checking Reddit token...");
    const clerk = await clerkClient();
    const user = await clerk.users.getUser(userId);
    const metadata = (user.privateMetadata ?? {}) as ClerkPrivateMetadata;
    const projectConnection = metadata.redditTokens?.[projectId.toString()];

    console.log("🎯 Reddit token found:", projectConnection ? "yes" : "no");

    if (!projectConnection) {
      console.log("❌ No Reddit token for project");
      return NextResponse.json(
        { success: false, posts: [], totalFound: 0, error: "Reddit account not connected for this project" },
        { status: 401 }
      );
    }

    // Exchange refresh token for access token
    const tokenResponse = await fetch(
      "https://www.reddit.com/api/v1/access_token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "Contentbot/1.0",
          Authorization: `Basic ${Buffer.from(
            `${env.REDDIT_CLIENT_ID}:${env.REDDIT_CLIENT_SECRET}`,
          ).toString("base64")}`,
        },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: projectConnection.refreshToken,
        }),
      }
    );

    if (!tokenResponse.ok) {
      return NextResponse.json(
        { success: false, posts: [], totalFound: 0, error: `Reddit token refresh failed: ${tokenResponse.status}` },
        { status: 500 }
      );
    }

    const tokenData = (await tokenResponse.json()) as RedditTokenResponse;
    const accessToken = tokenData.access_token;

    // Determine the time range for Reddit API
    let sortParam = "hot";
    let timeParam = "";
    
    if (timeRange === "24h") {
      sortParam = "top";
      timeParam = "&t=day";
    } else if (timeRange === "1h") {
      sortParam = "top";
      timeParam = "&t=hour";
    }

    // Fetch posts from Reddit API
    const response = await fetch(
      `https://oauth.reddit.com/r/${subreddit}/${sortParam}.json?limit=${Math.min(maxResults * 3, 100)}${timeParam}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "User-Agent": "Contentbot/1.0",
        },
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json(
          { success: false, posts: [], totalFound: 0, error: `Subreddit '${subreddit}' not found` },
          { status: 404 }
        );
      }
      if (response.status === 403) {
        return NextResponse.json(
          { success: false, posts: [], totalFound: 0, error: `Access denied to subreddit '${subreddit}'` },
          { status: 403 }
        );
      }
      return NextResponse.json(
        { success: false, posts: [], totalFound: 0, error: `Reddit API error: ${response.status}` },
        { status: 500 }
      );
    }

    const data = (await response.json()) as RedditListing;
    let allPosts: RedditPost[] = data.data.children.map((child) => child.data);

    // Filter by keywords if specified
    if (keywords && keywords.length > 0) {
      allPosts = allPosts.filter((post) => {
        const content = `${post.title} ${post.selftext}`.toLowerCase();
        return keywords.some((keyword: string) =>
          content.includes(keyword.toLowerCase())
        );
      });
    }

    // Limit to requested number of results
    const limitedPosts = allPosts.slice(0, maxResults);

    // Format posts for response
    const formattedPosts = limitedPosts.map((post) => ({
      id: post.id,
      title: post.title,
      author: post.author,
      url: post.url,
      selftext: post.selftext.substring(0, 200), // Preview text (first 200 chars)
      ups: post.ups,
      num_comments: post.num_comments,
      created_utc: post.created_utc,
      subreddit: post.subreddit,
    }));

    return NextResponse.json({
      success: true,
      posts: formattedPosts,
      totalFound: allPosts.length,
    } satisfies RedditSearchPreviewResponse);

  } catch (error) {
    
    // Log the error details for debugging
    if (error instanceof Error) {
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
    }
    
    return NextResponse.json(
      { success: false, posts: [], totalFound: 0, error: "Internal server error" },
      { status: 500 }
    );
  }
}
