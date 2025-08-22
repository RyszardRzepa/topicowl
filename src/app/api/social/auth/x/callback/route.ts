import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { env } from "@/env";
import { API_BASE_URL } from "@/constants";
import { db } from "@/server/db";
import { users, projects } from "@/server/db/schema";
import { and, eq } from "drizzle-orm";
import type { ClerkPrivateMetadata, ProjectXConnection } from "@/types";

interface XTokenResponse {
  token_type: string;
  expires_in: number; // seconds
  access_token: string;
  scope: string;
  refresh_token?: string;
}

interface StateData {
  random: string;
  projectId: number;
  userId: string;
}

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.redirect(
        `${API_BASE_URL}/dashboard/social?error=unauthorized`,
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    if (error) {
      console.error("X OAuth error:", error);
      return NextResponse.redirect(
        `${API_BASE_URL}/dashboard/social?error=oauth_error`,
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        `${API_BASE_URL}/dashboard/social?error=missing_params`,
      );
    }

    const storedState = request.cookies.get("x_oauth_state")?.value;
    const codeVerifier = request.cookies.get("x_code_verifier")?.value;
    if (!storedState || storedState !== state || !codeVerifier) {
      return NextResponse.redirect(
        `${API_BASE_URL}/dashboard/social?error=invalid_state`,
      );
    }

    let stateData: StateData;
    try {
      stateData = JSON.parse(
        Buffer.from(state, "base64url").toString(),
      ) as StateData;
    } catch (parseError) {
      console.error("Failed to parse state data:", parseError);
      return NextResponse.redirect(
        `${API_BASE_URL}/dashboard/social?error=invalid_state_format`,
      );
    }

    if (stateData.userId !== userId) {
      return NextResponse.redirect(
        `${API_BASE_URL}/dashboard/social?error=user_mismatch`,
      );
    }

    // Verify user & project ownership
    const [userRecord] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, userId));
    if (!userRecord) {
      return NextResponse.redirect(
        `${API_BASE_URL}/dashboard/social?error=user_not_found`,
      );
    }

    const [projectRecord] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(
        and(
          eq(projects.id, stateData.projectId),
          eq(projects.userId, userRecord.id),
        ),
      );
    if (!projectRecord) {
      return NextResponse.redirect(
        `${API_BASE_URL}/dashboard/social?error=project_not_found`,
      );
    }

    // Exchange code for tokens (OAuth 2.0 with PKCE)
    const X_CLIENT_ID = `${env.X_CLIENT_ID ?? ""}`;
    const X_CLIENT_SECRET = `${env.X_CLIENT_SECRET ?? ""}`;

    const tokenRes = await fetch("https://api.twitter.com/2/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization:
          "Basic " +
          Buffer.from(`${X_CLIENT_ID}:${X_CLIENT_SECRET}`).toString("base64"),
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: `${API_BASE_URL}/api/social/auth/x/callback`,
        code_verifier: codeVerifier,
        client_id: X_CLIENT_ID,
      }),
    });

    if (!tokenRes.ok) {
      console.error("X token exchange failed:", await tokenRes.text());
      return NextResponse.redirect(
        `${API_BASE_URL}/dashboard/social?error=token_exchange_failed`,
      );
    }

    const tokenData = (await tokenRes.json()) as XTokenResponse;

    // Optionally fetch current user info using token
    // X v2: GET https://api.twitter.com/2/users/me
    let xUserId = "";
    let xUsername = "";
    try {
      const meRes = await fetch("https://api.twitter.com/2/users/me", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      if (meRes.ok) {
        const me = (await meRes.json()) as {
          data?: { id: string; username: string };
        };
        xUserId = me.data?.id ?? "";
        xUsername = me.data?.username ?? "";
      }
    } catch (e) {
      console.warn("X me() failed, continuing without profile:", e);
    }

    // Save refresh token under Clerk private metadata per project
    const clerk = await clerkClient();
    const user = await clerk.users.getUser(userId);
    const currentMetadata = (user.privateMetadata ??
      {}) as ClerkPrivateMetadata;
    currentMetadata.xTokens ??= {};

    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + (tokenData.expires_in ?? 0) * 1000,
    );
    const connection: ProjectXConnection = {
      refreshToken: tokenData.refresh_token ?? "",
      accessToken: undefined, // we do not persist access tokens (short lived)
      expiresAt: Number.isFinite(expiresAt.getTime())
        ? expiresAt.toISOString()
        : undefined,
      xUserId,
      xUsername,
      connectedAt: now.toISOString(),
      lastUsedAt: now.toISOString(),
      scopes: tokenData.scope?.split(" ") ?? [],
    };
    currentMetadata.xTokens[stateData.projectId.toString()] = connection;

    await clerk.users.updateUserMetadata(userId, {
      privateMetadata: currentMetadata,
    });

    const response = NextResponse.redirect(
      `${API_BASE_URL}/dashboard/social?success=x`,
    );
    response.cookies.delete("x_oauth_state");
    response.cookies.delete("x_code_verifier");
    return response;
  } catch (error) {
    console.error("X OAuth callback error:", error);
    return NextResponse.redirect(
      `${API_BASE_URL}/dashboard/social?error=callback_failed`,
    );
  }
}
