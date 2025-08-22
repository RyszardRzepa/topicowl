import { auth, clerkClient } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { users, projects } from "@/server/db/schema";
import { and, eq } from "drizzle-orm";
import type { ClerkPrivateMetadata } from "@/types";

interface AccountsResponse {
  success: boolean;
  data?: {
    reddit?: { connected: boolean; username?: string; userId?: string };
    x?: { connected: boolean; username?: string; userId?: string };
  };
  error?: string;
}

export async function GET(request: NextRequest) {
  try {
    // 1. Authenticate user with Clerk
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // 2. Verify user exists in database
    const [userRecord] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, userId));
    if (!userRecord) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const projectIdParam = searchParams.get("projectId");
    if (!projectIdParam) {
      return NextResponse.json({ error: "Project ID is required" }, { status: 400 });
    }
    const projectId = parseInt(projectIdParam, 10);
    if (isNaN(projectId)) {
      return NextResponse.json({ error: "Invalid project ID format" }, { status: 400 });
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

    const clerk = await clerkClient();
    const user = await clerk.users.getUser(userId);
    const metadata = (user.privateMetadata ?? {}) as ClerkPrivateMetadata;

    const redditConn = metadata.redditTokens?.[projectId.toString()];
    const xConn = metadata.xTokens?.[projectId.toString()];

    return NextResponse.json({
      success: true,
      data: {
        reddit: redditConn
          ? { connected: true, username: redditConn.redditUsername, userId: redditConn.redditUserId }
          : { connected: false },
        x: xConn
          ? { connected: true, username: xConn.xUsername, userId: xConn.xUserId }
          : { connected: false },
      },
    } satisfies AccountsResponse);
  } catch (error) {
    console.error("Social accounts API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
