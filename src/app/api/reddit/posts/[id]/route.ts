import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { redditPosts, projects } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";

// Database query result types
type ExistingPostQuery = {
  id: number;
  projectId: number;
  userId: string;
  status: string;
  subreddit: string;
  title: string;
  text: string;
  publishScheduledAt: Date | null;
};

type ProjectQuery = {
  id: number;
};

type UpdatedPostQuery = {
  id: number;
  subreddit: string;
  title: string;
  text: string;
  status: string;
  publishScheduledAt: Date | null;
  updatedAt: Date;
};

// TypeScript interfaces for individual post management
export interface UpdateScheduledPostRequest {
  subreddit?: string;
  title?: string;
  text?: string;
  publishScheduledAt?: string;
}

export interface UpdatedRedditPost {
  id: number;
  subreddit: string;
  title: string;
  text: string;
  status: string;
  publishScheduledAt: string;
  updatedAt: string;
}

export interface UpdatePostResponse {
  success: boolean;
  data?: UpdatedRedditPost;
  error?: string;
}

export interface DeletePostResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const postId = parseInt(params.id, 10);
    if (isNaN(postId)) {
      return NextResponse.json({ 
        error: "Invalid post ID format" 
      }, { status: 400 });
    }

    const body = await request.json() as UpdateScheduledPostRequest;
    const { subreddit, title, text, publishScheduledAt } = body;

    // Validate at least one field is provided for update
    if (!subreddit && !title && !text && !publishScheduledAt) {
      return NextResponse.json({ 
        error: "At least one field must be provided for update" 
      }, { status: 400 });
    }

    // Validate field formats if provided
    if (subreddit && !/^[a-zA-Z0-9_]+$/.test(subreddit)) {
      return NextResponse.json({ 
        error: "Invalid subreddit name format" 
      }, { status: 400 });
    }

    if (title && title.length > 300) {
      return NextResponse.json({ 
        error: "Title must be 300 characters or less" 
      }, { status: 400 });
    }

    // Validate scheduling date if provided
    let scheduledDate: Date | undefined;
    if (publishScheduledAt) {
      scheduledDate = new Date(publishScheduledAt);
      const now = new Date();
      
      if (isNaN(scheduledDate.getTime())) {
        return NextResponse.json({ 
          error: "Invalid date format for publishScheduledAt" 
        }, { status: 400 });
      }
      
      if (scheduledDate <= now) {
        return NextResponse.json({ 
          error: "Scheduled date must be in the future" 
        }, { status: 400 });
      }
    }

    // First, get the existing post to verify ownership and status
    const existingPostResult = await db
      .select({
        id: redditPosts.id,
        projectId: redditPosts.projectId,
        userId: redditPosts.userId,
        status: redditPosts.status,
        subreddit: redditPosts.subreddit,
        title: redditPosts.title,
        text: redditPosts.text,
        publishScheduledAt: redditPosts.publishScheduledAt,
      })
      .from(redditPosts)
      .where(eq(redditPosts.id, postId))
      .limit(1) as ExistingPostQuery[];

    const existingPost = existingPostResult[0];

    if (!existingPost) {
      return NextResponse.json({ 
        error: "Post not found" 
      }, { status: 404 });
    }

    // Verify user owns the post through project ownership
    const projectResult = await db
      .select({ id: projects.id })
      .from(projects)
      .where(
        and(
          eq(projects.id, existingPost.projectId),
          eq(projects.userId, userId)
        )
      )
      .limit(1) as ProjectQuery[];

    const project = projectResult[0];

    if (!project) {
      return NextResponse.json({ 
        error: "Access denied" 
      }, { status: 403 });
    }

    // Only allow editing posts with 'scheduled' status
    if (existingPost.status !== "scheduled") {
      return NextResponse.json({ 
        error: "Only scheduled posts can be edited" 
      }, { status: 400 });
    }

    // Build update object with only provided fields
    const updateData: {
      subreddit?: string;
      title?: string;
      text?: string;
      publishScheduledAt?: Date;
      updatedAt: Date;
    } = {
      updatedAt: new Date(),
    };
    
    if (subreddit !== undefined) updateData.subreddit = subreddit;
    if (title !== undefined) updateData.title = title;
    if (text !== undefined) updateData.text = text;
    if (scheduledDate !== undefined) updateData.publishScheduledAt = scheduledDate;

    // Update the post
    const updatedPostResult = await db
      .update(redditPosts)
      .set(updateData)
      .where(eq(redditPosts.id, postId))
      .returning({
        id: redditPosts.id,
        subreddit: redditPosts.subreddit,
        title: redditPosts.title,
        text: redditPosts.text,
        status: redditPosts.status,
        publishScheduledAt: redditPosts.publishScheduledAt,
        updatedAt: redditPosts.updatedAt,
      }) as UpdatedPostQuery[];

    const updatedPost = updatedPostResult[0];

    if (!updatedPost) {
      return NextResponse.json({ 
        error: "Failed to update post" 
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: {
        id: updatedPost.id,
        subreddit: updatedPost.subreddit,
        title: updatedPost.title,
        text: updatedPost.text,
        status: updatedPost.status,
        publishScheduledAt: updatedPost.publishScheduledAt?.toISOString() ?? "",
        updatedAt: updatedPost.updatedAt.toISOString(),
      },
    } satisfies UpdatePostResponse);

  } catch (error) {
    console.error("Error updating scheduled Reddit post:", error);
    return NextResponse.json({ 
      success: false,
      error: "Internal server error" 
    }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const postId = parseInt(params.id, 10);
    if (isNaN(postId)) {
      return NextResponse.json({ 
        error: "Invalid post ID format" 
      }, { status: 400 });
    }

    // First, get the existing post to verify ownership and status
    const existingPostResult = await db
      .select({
        id: redditPosts.id,
        projectId: redditPosts.projectId,
        userId: redditPosts.userId,
        status: redditPosts.status,
      })
      .from(redditPosts)
      .where(eq(redditPosts.id, postId))
      .limit(1) as Pick<ExistingPostQuery, 'id' | 'projectId' | 'userId' | 'status'>[];

    const existingPost = existingPostResult[0];

    if (!existingPost) {
      return NextResponse.json({ 
        error: "Post not found" 
      }, { status: 404 });
    }

    // Verify user owns the post through project ownership
    const projectResult = await db
      .select({ id: projects.id })
      .from(projects)
      .where(
        and(
          eq(projects.id, existingPost.projectId),
          eq(projects.userId, userId)
        )
      )
      .limit(1) as ProjectQuery[];

    const project = projectResult[0];

    if (!project) {
      return NextResponse.json({ 
        error: "Access denied" 
      }, { status: 403 });
    }

    // Only allow deletion of posts with 'scheduled' status
    if (existingPost.status !== "scheduled") {
      return NextResponse.json({ 
        error: "Only scheduled posts can be deleted" 
      }, { status: 400 });
    }

    // Delete the post
    await db
      .delete(redditPosts)
      .where(eq(redditPosts.id, postId));

    return NextResponse.json({
      success: true,
      message: "Scheduled post cancelled successfully",
    } satisfies DeletePostResponse);

  } catch (error) {
    console.error("Error deleting scheduled Reddit post:", error);
    return NextResponse.json({ 
      success: false,
      error: "Internal server error" 
    }, { status: 500 });
  }
}