import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { env } from "@/env";
import crypto from "crypto";
import { API_BASE_URL } from "@/constants";
import { db } from "@/server/db";
import { projects } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    // Check if user is authenticated
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get project ID from query parameters
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");

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

    // Generate secure state parameter for CSRF protection with project context
    const stateData = {
      random: crypto.randomBytes(20).toString("hex"),
      projectId: projectIdNum,
      userId: userId,
    };
    const state = Buffer.from(JSON.stringify(stateData)).toString("base64url");

    // Store state in session/cookie for validation in callback
    const response = NextResponse.redirect(
      `https://www.reddit.com/api/v1/authorize?` +
        new URLSearchParams({
          client_id: env.REDDIT_CLIENT_ID,
          response_type: "code",
          state: state,
          redirect_uri: `${API_BASE_URL}/api/reddit/callback`,
          duration: "permanent",
          scope: "identity mysubreddits read submit",
        }).toString(),
    );

    // Set state cookie for validation in callback
    response.cookies.set("reddit_oauth_state", state, {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600, // 10 minutes
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
