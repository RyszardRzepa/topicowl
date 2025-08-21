import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { db } from "@/server/db";
import { projects } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import type { ClerkPrivateMetadata } from "@/types";
import { env } from "@/env";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get project ID from request body
    const body = (await request.json()) as { projectId?: number };
    const { projectId } = body;

    if (!projectId) {
      return NextResponse.json(
        { error: "Project ID is required" },
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
        { error: "Project not found or access denied" },
        { status: 404 },
      );
    }

    // Get current user metadata
    const clerk = await clerkClient();
    const user = await clerk.users.getUser(userId);
    const metadata = (user.privateMetadata ?? {}) as ClerkPrivateMetadata;

    const projectConnection = metadata.redditTokens?.[projectId.toString()];

    if (!projectConnection) {
      return NextResponse.json(
        { error: "Reddit connection not found for this project" },
        { status: 404 },
      );
    }

    // Attempt to revoke the refresh token with Reddit API
    try {
      const revokeResponse = await fetch(
        "https://www.reddit.com/api/v1/revoke_token",
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${Buffer.from(`${env.REDDIT_CLIENT_ID}:${env.REDDIT_CLIENT_SECRET}`).toString("base64")}`,
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "Contentbot/1.0",
          },
          body: new URLSearchParams({
            token: projectConnection.refreshToken,
            token_type_hint: "refresh_token",
          }),
        },
      );

      if (!revokeResponse.ok) {
        console.warn(
          `Failed to revoke Reddit token for project ${projectId}:`,
          await revokeResponse.text(),
        );
        // Continue with local cleanup even if revocation fails
      }
    } catch (revokeError) {
      console.warn(
        `Error revoking Reddit token for project ${projectId}:`,
        revokeError,
      );
      // Continue with local cleanup even if revocation fails
    }

    // Remove project-specific Reddit connection from metadata
    const updatedMetadata = { ...metadata };
    if (updatedMetadata.redditTokens) {
      delete updatedMetadata.redditTokens[projectId.toString()];

      // If no more Reddit connections exist, remove the redditTokens object entirely
      if (Object.keys(updatedMetadata.redditTokens).length === 0) {
        delete updatedMetadata.redditTokens;
      }
    }

    await clerk.users.updateUserMetadata(userId, {
      privateMetadata: updatedMetadata,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to disconnect Reddit account:", error);
    return NextResponse.json(
      { error: "Failed to disconnect Reddit account" },
      { status: 500 },
    );
  }
}
