import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { env } from "@/env";
import { API_BASE_URL } from "@/constants";

interface RedditTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  refresh_token: string;
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

    // Store refresh token in Clerk private metadata
    const clerk = await clerkClient();
    await clerk.users.updateUserMetadata(userId, {
      privateMetadata: {
        redditRefreshToken: tokens.refresh_token,
        redditConnectedAt: new Date().toISOString(),
      },
    });

    // Clear state cookie
    const response = NextResponse.redirect(
      `${API_BASE_URL}/dashboard/settings/reddit?success=connected`,
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
