import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { redditAutomations, projects } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

// Workflow node types
const WorkflowNodeSchema = z.object({
  id: z.string(),
  type: z.enum(["trigger", "search", "evaluate", "reply", "action"]),
  config: z.record(z.any()),
  position: z.object({
    x: z.number(),
    y: z.number(),
  }),
});

const CreateAutomationSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  workflow: z.array(WorkflowNodeSchema),
  projectId: z.number(),
});

const UpdateAutomationSchema = CreateAutomationSchema.partial().extend({
  id: z.number(),
});

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json(
        { error: "Project ID is required" },
        { status: 400 },
      );
    }

    const projectIdNum = parseInt(projectId, 10);
    if (isNaN(projectIdNum)) {
      return NextResponse.json(
        { error: "Invalid project ID format" },
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
      .where(and(eq(projects.id, projectIdNum), eq(projects.userId, userId)));

    if (!projectRecord) {
      return NextResponse.json(
        { error: "Project not found or access denied" },
        { status: 404 },
      );
    }

    // Get all automations for the project
    const automations = await db
      .select()
      .from(redditAutomations)
      .where(eq(redditAutomations.projectId, projectIdNum))
      .orderBy(redditAutomations.createdAt);

    return NextResponse.json({
      success: true,
      automations,
    });
  } catch (error) {
    console.error("Get automations error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input data", details: error.errors },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = CreateAutomationSchema.parse(body);

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
      .where(
        and(
          eq(projects.id, validatedData.projectId),
          eq(projects.userId, userId),
        ),
      );

    if (!projectRecord) {
      return NextResponse.json(
        { error: "Project not found or access denied" },
        { status: 404 },
      );
    }

    // Create new automation
    const [newAutomation] = await db
      .insert(redditAutomations)
      .values({
        name: validatedData.name,
        description: validatedData.description,
        workflow: validatedData.workflow,
        projectId: validatedData.projectId,
      })
      .returning();

    return NextResponse.json({
      success: true,
      automation: newAutomation,
    });
  } catch (error) {
    console.error("Create automation error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input data", details: error.errors },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = UpdateAutomationSchema.parse(body);

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
        and(
          eq(redditAutomations.id, validatedData.id),
          eq(projects.userId, userId),
        ),
      );

    if (!existingAutomation) {
      return NextResponse.json(
        { error: "Automation not found or access denied" },
        { status: 404 },
      );
    }

    // Update automation
    const updateData: Partial<typeof validatedData> = { ...validatedData };
    delete updateData.id;

    const [updatedAutomation] = await db
      .update(redditAutomations)
      .set(updateData)
      .where(eq(redditAutomations.id, validatedData.id))
      .returning();

    return NextResponse.json({
      success: true,
      automation: updatedAutomation,
    });
  } catch (error) {
    console.error("Update automation error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input data", details: error.errors },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}