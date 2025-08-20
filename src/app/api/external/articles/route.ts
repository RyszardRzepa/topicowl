import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { apiKeys, users, articles, projects } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { createHash } from "crypto";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      ...CORS_HEADERS,
      "Access-Control-Max-Age": "600", // optional, cache preflight
    },
  });
}
export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      console.log(
        "Missing or invalid Authorization header (expected Bearer token)",
      );
      return NextResponse.json(
        {
          error:
            "Missing or invalid Authorization header (expected Bearer token)",
        },
        { status: 401 },
      );
    }
    const providedKey = authHeader.slice(7).trim();
    if (!providedKey) {
      return NextResponse.json({ error: "Empty API key" }, { status: 401 });
    }

    const providedHash = createHash("sha256").update(providedKey).digest("hex");

    // Lookup API key by hash to find project
    const keyRows = await db
      .select({ id: apiKeys.id, projectId: apiKeys.projectId })
      .from(apiKeys)
      .where(eq(apiKeys.keyHash, providedHash))
      .limit(1);

    if (keyRows.length === 0) {
      return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
    }

    const keyRecord = keyRows[0]!;

    // Get project details and verify it exists
    const [projectRecord] = await db
      .select({ id: projects.id, userId: projects.userId })
      .from(projects)
      .where(eq(projects.id, keyRecord.projectId))
      .limit(1);

    if (!projectRecord) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Update lastUsedAt (best-effort, ignore failure)
    db.update(apiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiKeys.id, keyRecord.id))
      .catch((err) => {
        console.error(
          "Failed to update API key lastUsedAt for keyId:",
          keyRecord.id,
          err,
        );
      });

    // Optional project filter - but key is already project-scoped
    const { searchParams } = new URL(request.url);
    const projectIdParam = searchParams.get("projectId");
    let requestedProjectId: number | undefined;
    if (projectIdParam) {
      const parsed = parseInt(projectIdParam, 10);
      if (isNaN(parsed)) {
        return NextResponse.json(
          { error: "Invalid projectId" },
          { status: 400 },
        );
      }
      requestedProjectId = parsed;

      // Verify requested project matches key's project
      if (requestedProjectId !== keyRecord.projectId) {
        return NextResponse.json(
          { error: "API key does not have access to specified project" },
          { status: 403 },
        );
      }
    }

    // Ensure user still exists
    const [userExists] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, projectRecord.userId))
      .limit(1);

    if (!userExists) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // With project-scoped keys, we only return articles from the key's project
    // The optional projectId param is now just for validation
    const rows = await db
      .select({
        id: articles.id,
        title: articles.title,
        description: articles.description,
        keywords: articles.keywords,
        slug: articles.slug,
        content: articles.content,
        metaDescription: articles.metaDescription,
        metaKeywords: articles.metaKeywords,
        publishedAt: articles.publishedAt,
        projectId: articles.projectId,
        createdAt: articles.createdAt,
        updatedAt: articles.updatedAt,
      })
      .from(articles)
      .where(
        and(
          eq(articles.projectId, keyRecord.projectId),
          eq(articles.status, "published"),
        ),
      )
      .orderBy(articles.publishedAt ?? articles.createdAt);

    return new NextResponse(JSON.stringify({ articles: rows }), {
      headers: CORS_HEADERS,
    });
  } catch (error) {
    console.error("External articles fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch articles" },
      { status: 500 },
    );
  }
}
