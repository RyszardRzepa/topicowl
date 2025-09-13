import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/server/db";
import { projects, users } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const projectSettingsUpdateSchema = z.object({
  toneOfVoice: z.string().optional(),
  articleStructure: z.string().optional(),
  maxWords: z.number().min(100).max(5000).optional(),
  excludedDomains: z.array(z.string()).optional(),
  sitemapUrl: z.string().url().optional(),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // Get current user from Clerk
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify user exists in database
    const [userRecord] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!userRecord) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { id } = await params;
    const projectId = parseInt(id);

    if (!projectId || isNaN(projectId)) {
      return NextResponse.json(
        { error: "Invalid project ID" },
        { status: 400 },
      );
    }

    // Verify that the project belongs to the current user
    const [projectRecord] = await db
      .select({
        id: projects.id,
        userId: projects.userId,
      })
      .from(projects)
      .where(
        and(
          eq(projects.id, projectId),
          eq(projects.userId, userRecord.id),
        ),
      )
      .limit(1);

    if (!projectRecord) {
      return NextResponse.json(
        { error: "Project not found or access denied" },
        { status: 404 },
      );
    }

    const body = (await req.json()) as unknown;
    const validatedData = projectSettingsUpdateSchema.parse(body);

    const [updatedProject] = await db
      .update(projects)
      .set({
        ...validatedData,
        updatedAt: new Date(),
      })
      .where(eq(projects.id, projectId))
      .returning();

    if (!updatedProject) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(updatedProject);
  } catch (error) {
    console.error("Update project settings error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input data", details: error.errors },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: "Failed to update project settings" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // Get current user from Clerk
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify user exists in database
    const [userRecord] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!userRecord) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { id } = await params;
    const projectId = parseInt(id);

    if (!projectId || isNaN(projectId)) {
      return NextResponse.json(
        { error: "Invalid project ID" },
        { status: 400 },
      );
    }

    // Verify that the project belongs to the current user
    const [projectRecord] = await db
      .select({
        id: projects.id,
        userId: projects.userId,
      })
      .from(projects)
      .where(
        and(
          eq(projects.id, projectId),
          eq(projects.userId, userRecord.id),
        ),
      )
      .limit(1);

    if (!projectRecord) {
      return NextResponse.json(
        { error: "Project not found or access denied" },
        { status: 404 },
      );
    }

    // Reset to default values instead of deleting
    const [resetProject] = await db
      .update(projects)
      .set({
        toneOfVoice:
          "Professional and informative tone that speaks directly to business professionals. Use clear, authoritative language while remaining approachable and practical.",
        articleStructure: "introduction-body-conclusion",
        maxWords: 800,
        excludedDomains: [],
        sitemapUrl: null,
        updatedAt: new Date(),
      })
      .where(eq(projects.id, projectId))
      .returning();

    if (!resetProject) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      message: "Project settings reset to defaults",
      project: resetProject,
    });
  } catch (error) {
    console.error("Reset project settings error:", error);
    return NextResponse.json(
      { error: "Failed to reset project settings" },
      { status: 500 },
    );
  }
}
