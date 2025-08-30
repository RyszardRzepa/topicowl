import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { env } from "@/env";
import crypto from "crypto";
import { API_BASE_URL } from "@/constants";
import { db } from "@/server/db";
import { and, eq } from "drizzle-orm";
import { users, projects } from "@/server/db/schema";

// GET /api/social/auth/reddit?projectId=
export async function GET(request: NextRequest) {
  try {
    // Step 1: Authenticate user with Clerk
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const projectIdParam = searchParams.get("projectId");
    if (!projectIdParam) {
      return NextResponse.json(
        { error: "Project ID is required" },
        { status: 400 },
      );
    }
    const projectId = Number(projectIdParam);
    if (Number.isNaN(projectId)) {
      return NextResponse.json(
        { error: "Invalid project ID format" },
        { status: 400 },
      );
    }

    // Step 2: Verify user exists in database
    const [userRecord] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, userId));
    if (!userRecord) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Step 3: Verify project ownership
    const [projectRecord] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(
        and(eq(projects.id, projectId), eq(projects.userId, userRecord.id)),
      );
    if (!projectRecord) {
      return NextResponse.json(
        { error: "Project not found or access denied" },
        { status: 404 },
      );
    }

    // Build CSRF-protected state with project context
    const stateData = {
      random: crypto.randomBytes(20).toString("hex"),
      projectId,
      userId,
    } satisfies { random: string; projectId: number; userId: string };
    const state = Buffer.from(JSON.stringify(stateData)).toString("base64url");

    const url =
      `https://www.reddit.com/api/v1/authorize?` +
      new URLSearchParams({
        client_id: env.REDDIT_CLIENT_ID,
        response_type: "code",
        state,
        redirect_uri: `${API_BASE_URL}/api/reddit/callback`,
        duration: "permanent",
        scope: "identity mysubreddits read submit",
      }).toString();

    const response = NextResponse.redirect(url);
    response.cookies.set("reddit_oauth_state", state, {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600,
    });
    return response;
  } catch (error) {
    console.error("Reddit OAuth initiation error:", error);
    return NextResponse.json(
      { error: "Failed to initiate Reddit OAuth" },
      { status: 500 },
    );
  }
}
