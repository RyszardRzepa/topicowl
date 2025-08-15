import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { env } from "@/env";
import { db } from "@/server/db";
import { projects } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import type { ClerkPrivateMetadata } from "@/types";

// TypeScript interfaces for Reddit API responses
export interface RedditPostSubmissionRequest {
  subreddit: string;
  title: string;
  text: string;
  projectId: number;
}

export interface RedditPostSubmissionResponse {
  success: boolean;
  post_id?: string;
  url?: string;
  error?: string;
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

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: RedditPostSubmissionRequest = await request.json();
    const { subreddit, title, text, projectId } = body;

    // Validate required fields
    if (!subreddit || !title || !text || !projectId) {
      return NextResponse.json({ 
        error: "Missing required fields: subreddit, title, text, and projectId are required" 
      }, { status: 400 });
    }

    // Validate subreddit name format
    if (!/^[a-zA-Z0-9_]+$/.test(subreddit)) {
      return NextResponse.json({ error: "Invalid subreddit name format" }, { status: 400 });
    }

    // Validate title length (Reddit limit is 300 characters)
    if (title.length > 300) {
      return NextResponse.json({ error: "Title must be 300 characters or less" }, { status: 400 });
    }

    // Verify project exists and user owns it
    const [project] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
      .limit(1);

    if (!project) {
      return NextResponse.json({ error: "Project not found or access denied" }, { status: 404 });
    }

    // Get project-specific refresh token from Clerk private metadata
    const clerk = await clerkClient();
    const user = await clerk.users.getUser(userId);
    const metadata = (user.privateMetadata ?? {}) as ClerkPrivateMetadata;
    const projectConnection = metadata.redditTokens?.[projectId.toString()];

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
    if (updatedMetadata.redditTokens?.[projectId.toString()]) {
      updatedMetadata.redditTokens[projectId.toString()].lastUsedAt = new Date().toISOString();
      await clerk.users.updateUserMetadata(userId, {
        privateMetadata: updatedMetadata
      });
    }

    // Submit post to Reddit
    const submitResponse = await fetch("https://oauth.reddit.com/api/submit", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${tokenData.access_token}`,
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
        return NextResponse.json({ 
          error: "Access denied. You may not have permission to post in this subreddit." 
        }, { status: 403 });
      }
      if (submitResponse.status === 429) {
        return NextResponse.json({ 
          error: "Rate limit exceeded. Please try again later." 
        }, { status: 429 });
      }
      return NextResponse.json({ error: "Failed to submit post to Reddit" }, { status: 500 });
    }

    const submitData: RedditSubmitApiResponse = await submitResponse.json();

    // Check for Reddit API errors
    if (submitData.json.errors && submitData.json.errors.length > 0) {
      const errorMessages = submitData.json.errors.map(error => error[1] ?? error[0]).join(", ");
      return NextResponse.json({ 
        error: `Reddit API error: ${errorMessages}` 
      }, { status: 400 });
    }

    // Check if post was created successfully
    if (!submitData.json.data?.id) {
      return NextResponse.json({ 
        error: "Post submission failed - no post ID returned" 
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      post_id: submitData.json.data.id,
      url: submitData.json.data.url,
    } satisfies RedditPostSubmissionResponse);

  } catch (error) {
    console.error("Reddit post submission error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}