import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { projects, socialPosts } from "@/server/db/schema";
import { and, asc, eq } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const projectIdParam = searchParams.get("projectId");
    if (!projectIdParam)
      return NextResponse.json(
        { error: "Project ID is required" },
        { status: 400 },
      );
    const projectId = parseInt(projectIdParam, 10);
    if (isNaN(projectId))
      return NextResponse.json(
        { error: "Invalid project ID format" },
        { status: 400 },
      );

    const [project] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, userId)));
    if (!project)
      return NextResponse.json(
        { error: "Project not found or access denied" },
        { status: 404 },
      );

    const rows = await db
      .select({
        id: socialPosts.id,
        provider: socialPosts.provider,
        status: socialPosts.status,
        publishScheduledAt: socialPosts.publishScheduledAt,
        publishedAt: socialPosts.publishedAt,
        errorMessage: socialPosts.errorMessage,
        createdAt: socialPosts.createdAt,
      })
      .from(socialPosts)
      .where(
        and(
          eq(socialPosts.projectId, projectId),
          eq(socialPosts.userId, userId),
        ),
      )
      .orderBy(asc(socialPosts.publishScheduledAt));

    return NextResponse.json({
      success: true,
      data: rows.map((r) => ({
        id: r.id,
        provider: r.provider,
        status: r.status,
        publishScheduledAt: r.publishScheduledAt?.toISOString() ?? null,
        publishedAt: r.publishedAt?.toISOString() ?? null,
        errorMessage: r.errorMessage ?? null,
        createdAt: r.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("List social posts error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
