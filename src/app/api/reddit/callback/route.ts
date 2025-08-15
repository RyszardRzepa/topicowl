import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { env } from "@/env";
import { API_BASE_URL } from "@/constants";
import { db } from "@/server/db";
import { projects } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import type { ClerkPrivateMetadata, ProjectRedditConnection } from "@/types";

interface RedditTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  refresh_token: string;
}

interface RedditUserResponse {
  id: string;
  name: string;
}

interface StateData {
  random: string;
  projectId: number;
  userId: string;
}

export async function GET(request: NextRequest) {
  try {
    // Check if user is authenticated
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.redirect(
        `${API_BASE_URL}/dashboard/settings/reddit?error=unauthorized`,
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    // Handle OAuth errors
    if (error) {
      console.error("Reddit OAuth error:", error);
      return NextResponse.redirect(
        `${API_BASE_URL}/dashboard/settings/reddit?error=oauth_error`,
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        `${API_BASE_URL}/dashboard/settings/reddit?error=missing_params`,
      );
    }

    // Validate state parameter for CSRF protection
    const storedState = request.cookies.get("reddit_oauth_state")?.value;
    if (!storedState || storedState !== state) {
      return NextResponse.redirect(
        `${API_BASE_URL}/dashboard/settings/reddit?error=invalid_state`,
      );
    }

    // Parse state to extract project context
    let stateData: StateData;
    try {
      stateData = JSON.parse(
        Buffer.from(state, "base64url").toString(),
      ) as StateData;
    } catch (parseError) {
      console.error("Failed to parse state data:", parseError);
      return NextResponse.redirect(
        `${API_BASE_URL}/dashboard/settings/reddit?error=invalid_state_format`,
      );
    }

    // Validate user ID matches
    if (stateData.userId !== userId) {
      return NextResponse.redirect(
        `${API_BASE_URL}/dashboard/settings/reddit?error=user_mismatch`,
      );
    }

    // Verify project exists and user owns it
    const [project] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(
        and(eq(projects.id, stateData.projectId), eq(projects.userId, userId)),
      )
      .limit(1);

    if (!project) {
      return NextResponse.redirect(
        `${API_BASE_URL}/dashboard/settings/reddit?error=project_not_found`,
      );
    }

    // Exchange authorization code for tokens
    const tokenResponse = await fetch(
      "https://www.reddit.com/api/v1/access_token",
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${env.REDDIT_CLIENT_ID}:${env.REDDIT_CLIENT_SECRET}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "Contentbot/1.0",
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code: code,
          redirect_uri: `${API_BASE_URL}/api/reddit/callback`,
        }),
      },
    );

    if (!tokenResponse.ok) {
      console.error(
        "Reddit token exchange failed:",
        await tokenResponse.text(),
      );
      return NextResponse.redirect(
        `${API_BASE_URL}/dashboard/settings/reddit?error=token_exchange_failed`,
      );
    }

    const tokensData: unknown = await tokenResponse.json();
    const tokens = tokensData as RedditTokenResponse;

    // Fetch Reddit user info using the access token
    const userResponse = await fetch("https://oauth.reddit.com/api/v1/me", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
        "User-Agent": "Contentbot/1.0",
      },
    });

    if (!userResponse.ok) {
      console.error(
        "Failed to fetch Reddit user info:",
        await userResponse.text(),
      );
      return NextResponse.redirect(
        `${API_BASE_URL}/dashboard/settings/reddit?error=user_info_failed`,
      );
    }

    const redditUserData: unknown = await userResponse.json();
    const redditUser = redditUserData as RedditUserResponse;

    // Store project-specific refresh token in Clerk private metadata
    const clerk = await clerkClient();
    const user = await clerk.users.getUser(userId);
    const currentMetadata = (user.privateMetadata ??
      {}) as ClerkPrivateMetadata;

    // Initialize redditTokens if it doesn't exist
    currentMetadata.redditTokens ??= {};

    // Store connection data for this project
    const connectionData: ProjectRedditConnection = {
      refreshToken: tokens.refresh_token,
      redditUsername: redditUser.name,
      redditUserId: redditUser.id,
      connectedAt: new Date().toISOString(),
      lastUsedAt: new Date().toISOString(),
      scopes: tokens.scope.split(" "),
    };

    currentMetadata.redditTokens[stateData.projectId.toString()] =
      connectionData;

    await clerk.users.updateUserMetadata(userId, {
      privateMetadata: currentMetadata,
    });

    // Clear state cookie
    const response = NextResponse.redirect(
      `${API_BASE_URL}/dashboard/settings/reddit?success=connected&projectId=${stateData.projectId}`,
    );
    response.cookies.delete("reddit_oauth_state");

    return response;
  } catch (error) {
    console.error("Reddit OAuth callback error:", error);
    return NextResponse.redirect(
      `${API_BASE_URL}/dashboard/settings/reddit?error=callback_failed`,
    );
  }
}
