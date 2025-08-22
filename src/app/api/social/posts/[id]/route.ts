import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { projects, socialPosts } from "@/server/db/schema";
import { and, eq } from "drizzle-orm";

interface UpdateRequestBody {
  publishScheduledAt?: string;
  payload?: unknown; // keep flexible; validated per provider on client side
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const idNum = parseInt(params.id, 10);
    if (isNaN(idNum)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    const body = (await request.json()) as UpdateRequestBody;
    const updates: { publishScheduledAt?: Date; payload?: unknown; updatedAt: Date } = { updatedAt: new Date() };

    if (body.publishScheduledAt) {
      const date = new Date(body.publishScheduledAt);
      if (isNaN(date.getTime()) || date <= new Date()) {
        return NextResponse.json({ error: "Invalid publishScheduledAt" }, { status: 400 });
      }
      updates.publishScheduledAt = date;
    }
    if (body.payload !== undefined) updates.payload = body.payload;

    // Load post and check ownership via project
    const [post] = await db
      .select({ id: socialPosts.id, status: socialPosts.status, projectId: socialPosts.projectId })
      .from(socialPosts)
      .where(eq(socialPosts.id, idNum));
    if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Verify project ownership
    const [project] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, post.projectId), eq(projects.userId, userId)));
    if (!project) return NextResponse.json({ error: "Access denied" }, { status: 403 });

    if (post.status !== "scheduled") {
      return NextResponse.json({ error: "Only scheduled posts can be edited" }, { status: 400 });
    }

    const [updated] = await db
      .update(socialPosts)
      .set(updates)
      .where(eq(socialPosts.id, idNum))
      .returning({
        id: socialPosts.id,
        provider: socialPosts.provider,
        status: socialPosts.status,
        publishScheduledAt: socialPosts.publishScheduledAt,
        updatedAt: socialPosts.updatedAt,
      });

    if (!updated) {
      return NextResponse.json({ error: "Failed to update post" }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: {
      id: updated.id,
      provider: updated.provider,
      status: updated.status,
      publishScheduledAt: updated.publishScheduledAt?.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    }});
  } catch (error) {
    console.error("Update social post error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const idNum = parseInt(params.id, 10);
    if (isNaN(idNum)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    const [post] = await db
      .select({ id: socialPosts.id, status: socialPosts.status, projectId: socialPosts.projectId })
      .from(socialPosts)
      .where(eq(socialPosts.id, idNum));
    if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const [project] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, post.projectId), eq(projects.userId, userId)));
    if (!project) return NextResponse.json({ error: "Access denied" }, { status: 403 });

    if (post.status !== "scheduled") {
      return NextResponse.json({ error: "Only scheduled posts can be deleted" }, { status: 400 });
    }

    await db.delete(socialPosts).where(eq(socialPosts.id, idNum));
    return NextResponse.json({ success: true, message: "Scheduled post cancelled" });
  } catch (error) {
    console.error("Delete social post error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
