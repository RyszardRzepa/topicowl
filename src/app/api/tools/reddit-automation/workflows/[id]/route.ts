import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { redditAutomations, projects } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const automationId = parseInt(id, 10);
    if (isNaN(automationId)) {
      return NextResponse.json(
        { error: "Invalid automation ID format" },
        { status: 400 },
      );
    }

    // Verify user exists in database
    const [userRecord] = await db
      .select({ id: projects.userId })
      .from(projects)
      .where(eq(projects.userId, userId))
      .limit(1);

    if (!userRecord) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get automation with project ownership verification
    const [automation] = await db
      .select()
      .from(redditAutomations)
      .innerJoin(projects, eq(redditAutomations.projectId, projects.id))
      .where(
        and(eq(redditAutomations.id, automationId), eq(projects.userId, userId)),
      );

    if (!automation) {
      return NextResponse.json(
        { error: "Automation not found or access denied" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      automation: automation.reddit_automations,
    });
  } catch (error) {
    console.error("Get automation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const automationId = parseInt(id, 10);
    if (isNaN(automationId)) {
      return NextResponse.json(
        { error: "Invalid automation ID format" },
        { status: 400 },
      );
    }

    const body = await request.json() as {
      name: string;
      description: string;
      workflow: unknown;
      projectId: number;
    };
    const { name, description, workflow, projectId } = body;

    if (!name || !workflow || !projectId) {
      return NextResponse.json(
        { error: "Missing required fields: name, workflow, projectId" },
        { status: 400 },
      );
    }

    // Verify user exists in database
    const [userRecord] = await db
      .select({ id: projects.userId })
      .from(projects)
      .where(eq(projects.userId, userId))
      .limit(1);

    if (!userRecord) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Verify project ownership
    const [projectRecord] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, userId)));

    if (!projectRecord) {
      return NextResponse.json(
        { error: "Project not found or access denied" },
        { status: 404 },
      );
    }

    // Verify automation exists and belongs to user's project
    const [existingAutomation] = await db
      .select({ id: redditAutomations.id })
      .from(redditAutomations)
      .innerJoin(projects, eq(redditAutomations.projectId, projects.id))
      .where(
        and(eq(redditAutomations.id, automationId), eq(projects.userId, userId)),
      );

    if (!existingAutomation) {
      return NextResponse.json(
        { error: "Automation not found or access denied" },
        { status: 404 },
      );
    }

    // Update automation
    const [updatedAutomation] = await db
      .update(redditAutomations)
      .set({
        name,
        description,
        workflow,
        updatedAt: new Date(),
      })
      .where(eq(redditAutomations.id, automationId))
      .returning();

    return NextResponse.json({
      success: true,
      automation: updatedAutomation,
    });
  } catch (error) {
    console.error("Update automation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const automationId = parseInt(id, 10);
    if (isNaN(automationId)) {
      return NextResponse.json(
        { error: "Invalid automation ID format" },
        { status: 400 },
      );
    }

    // Verify user exists in database
    const [userRecord] = await db
      .select({ id: projects.userId })
      .from(projects)
      .where(eq(projects.userId, userId))
      .limit(1);

    if (!userRecord) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Verify automation exists and user has access via project ownership
    const [existingAutomation] = await db
      .select({
        id: redditAutomations.id,
        projectId: redditAutomations.projectId,
      })
      .from(redditAutomations)
      .innerJoin(projects, eq(redditAutomations.projectId, projects.id))
      .where(
        and(eq(redditAutomations.id, automationId), eq(projects.userId, userId)),
      );

    if (!existingAutomation) {
      return NextResponse.json(
        { error: "Automation not found or access denied" },
        { status: 404 },
      );
    }

    // Delete automation
    await db
      .delete(redditAutomations)
      .where(eq(redditAutomations.id, automationId));

    return NextResponse.json({
      success: true,
      message: "Automation deleted successfully",
    });
  } catch (error) {
    console.error("Delete automation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}