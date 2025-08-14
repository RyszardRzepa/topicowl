import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { env } from "@/env";

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

    if (!query) {
      return NextResponse.json({ error: "Query parameter is required" }, { status: 400 });
    }

    // Get refresh token from Clerk private metadata
    const { clerkClient } = await import("@clerk/nextjs/server");
    const clerk = await clerkClient();
    const user = await clerk.users.getUser(userId);
    const refreshToken = user.privateMetadata?.redditRefreshToken as string;

    if (!refreshToken) {
      return NextResponse.json({ error: "Reddit account not connected" }, { status: 401 });
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
        refresh_token: refreshToken,
      }),
    });

    if (!tokenResponse.ok) {
      return NextResponse.json({ error: "Failed to refresh Reddit token" }, { status: 401 });
    }

    const tokenData: RedditTokenResponse = await tokenResponse.json();

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