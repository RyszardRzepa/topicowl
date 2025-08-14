import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { env } from "@/env";

// TypeScript interfaces for Reddit API responses
export interface RedditProfile {
  name: string;
  icon_img: string;
  total_karma: number;
  created_utc: number;
}

export interface RedditSubreddit {
  display_name: string;
  display_name_prefixed: string;
  url: string;
  subscribers: number;
  public_description: string;
}

export interface RedditUserProfileResponse {
  profile: RedditProfile;
}

export interface RedditUserSubredditsResponse {
  subreddits: RedditSubreddit[];
}

interface RedditTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

interface RedditIdentityApiResponse {
  name: string;
  icon_img: string;
  total_karma: number;
  created_utc: number;
}

interface RedditSubredditsApiResponse {
  data: {
    children: Array<{
      data: {
        display_name: string;
        display_name_prefixed: string;
        url: string;
        subscribers: number;
        public_description: string;
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
    const action = searchParams.get("action");

    if (!action || (action !== "profile" && action !== "subreddits")) {
      return NextResponse.json({ error: "Action parameter must be 'profile' or 'subreddits'" }, { status: 400 });
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

    if (action === "profile") {
      // Call Reddit's identity API
      const profileResponse = await fetch("https://oauth.reddit.com/api/v1/me", {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${tokenData.access_token}`,
          "User-Agent": "Contentbot/1.0",
        },
      });

      if (!profileResponse.ok) {
        return NextResponse.json({ error: "Failed to fetch Reddit profile" }, { status: 500 });
      }

      const profileData: RedditIdentityApiResponse = await profileResponse.json();

      return NextResponse.json({
        profile: {
          name: profileData.name,
          icon_img: profileData.icon_img,
          total_karma: profileData.total_karma,
          created_utc: profileData.created_utc,
        },
      } satisfies RedditUserProfileResponse);

    } else if (action === "subreddits") {
      // Call Reddit's subscribed subreddits API
      const subredditsResponse = await fetch("https://oauth.reddit.com/subreddits/mine/subscriber", {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${tokenData.access_token}`,
          "User-Agent": "Contentbot/1.0",
        },
      });

      if (!subredditsResponse.ok) {
        return NextResponse.json({ error: "Failed to fetch subscribed subreddits" }, { status: 500 });
      }

      const subredditsData: RedditSubredditsApiResponse = await subredditsResponse.json();

      const subreddits = subredditsData.data.children.map(child => ({
        display_name: child.data.display_name,
        display_name_prefixed: child.data.display_name_prefixed,
        url: child.data.url,
        subscribers: child.data.subscribers,
        public_description: child.data.public_description,
      }));

      return NextResponse.json({
        subreddits,
      } satisfies RedditUserSubredditsResponse);
    }

  } catch (error) {
    console.error("Reddit user API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}