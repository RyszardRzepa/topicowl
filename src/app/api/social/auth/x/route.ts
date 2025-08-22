import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { env } from "@/env";
import { API_BASE_URL } from "@/constants";
import crypto from "crypto";
import { db } from "@/server/db";
import { users, projects } from "@/server/db/schema";
import { and, eq } from "drizzle-orm";

// Minimal PKCE utilities
function base64UrlEncode(buffer: Buffer): string {
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function generateCodeVerifier(): string {
  return base64UrlEncode(crypto.randomBytes(32));
}

function generateCodeChallenge(verifier: string): string {
  const hash = crypto.createHash("sha256").update(verifier).digest();
  return base64UrlEncode(hash);
}

// GET /api/social/auth/x?projectId=
export async function GET(request: NextRequest) {
  try {
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

    // Verify user existence
    const [userRecord] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, userId));
    if (!userRecord) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Verify project ownership
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

    // PKCE params
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);
    const stateData = {
      random: crypto.randomBytes(20).toString("hex"),
      projectId,
      userId,
    };
    const state = Buffer.from(JSON.stringify(stateData)).toString("base64url");

    // X OAuth2 authorize URL (Authorization Code with PKCE)
    const authUrl =
      `https://twitter.com/i/oauth2/authorize?` +
      new URLSearchParams({
        response_type: "code",
        client_id: env.X_CLIENT_ID,
        redirect_uri: `${API_BASE_URL}/api/social/auth/x/callback`,
        scope: [
          "tweet.read",
          "tweet.write",
          "users.read",
          "offline.access", // to receive refresh_token
        ].join(" "),
        state,
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
      }).toString();

    const response = NextResponse.redirect(authUrl);
    response.cookies.set("x_oauth_state", state, {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600,
    });
    response.cookies.set("x_code_verifier", codeVerifier, {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600,
    });
    return response;
  } catch (error) {
    console.error("X OAuth initiation error:", error);
    return NextResponse.json(
      { error: "Failed to initiate X OAuth" },
      { status: 500 },
    );
  }
}
