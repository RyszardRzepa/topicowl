import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { redditPosts, projects } from "@/server/db/schema";
import { eq, and, asc } from "drizzle-orm";

// TypeScript interfaces for scheduled posts API
export interface ScheduledRedditPost {
  id: number;
  subreddit: string;
  title: string;
  text: string;
  status: string;
  publishScheduledAt: string;
  publishedAt?: string;
  errorMessage?: string;
  createdAt: string;
}

export interface ScheduledPostsResponse {
  success: boolean;
  data: ScheduledRedditPost[];
  error?: string;
}

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get projectId from query parameters
    const { searchParams } = new URL(request.url);
    const projectIdParam = searchParams.get("projectId");

    if (!projectIdParam) {
      return NextResponse.json(
        {
          error: "Missing required parameter: projectId",
        },
        { status: 400 },
      );
    }

    const projectId = parseInt(projectIdParam, 10);
    if (isNaN(projectId)) {
      return NextResponse.json(
        {
          error: "Invalid projectId format",
        },
        { status: 400 },
      );
    }

    // Verify project exists and user owns it
    const [project] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
      .limit(1);

    if (!project) {
      return NextResponse.json(
        {
          error: "Project not found or access denied",
        },
        { status: 404 },
      );
    }

    // Query all Reddit posts for this project (scheduled, published, failed), sorted by scheduled time
    const scheduledPosts = await db
      .select({
        id: redditPosts.id,
        subreddit: redditPosts.subreddit,
        title: redditPosts.title,
        text: redditPosts.text,
        status: redditPosts.status,
        publishScheduledAt: redditPosts.publishScheduledAt,
        publishedAt: redditPosts.publishedAt,
        errorMessage: redditPosts.errorMessage,
        createdAt: redditPosts.createdAt,
      })
      .from(redditPosts)
      .where(
        and(
          eq(redditPosts.projectId, projectId),
          eq(redditPosts.userId, userId),
        ),
      )
      .orderBy(asc(redditPosts.publishScheduledAt));

    // Transform the data to match the response interface
    const responseData: ScheduledRedditPost[] = scheduledPosts.map((post) => ({
      id: post.id,
      subreddit: post.subreddit,
      title: post.title,
      text: post.text,
      status: post.status,
      publishScheduledAt: post.publishScheduledAt?.toISOString() ?? "",
      publishedAt: post.publishedAt?.toISOString(),
      errorMessage: post.errorMessage ?? undefined,
      createdAt: post.createdAt.toISOString(),
    }));

    return NextResponse.json({
      success: true,
      data: responseData,
    } satisfies ScheduledPostsResponse);
  } catch (error) {
    console.error("Error fetching scheduled Reddit posts:", error);
    return NextResponse.json(
      {
        success: false,
        data: [],
        error: "Internal server error",
      },
      { status: 500 },
    );
  }
}
