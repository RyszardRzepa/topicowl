import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/server/db";
import { users, projects, topicGenerationTasks } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { createTopicDiscoveryTask } from "@/lib/services/topic-discovery";

// Request schema for topic discovery
const topicDiscoveryRequestSchema = z.object({
  projectId: z.number().int().positive(),
});

export async function POST(req: Request) {
  try {
    // 1. Authenticate user with Clerk
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 3. Parse and validate request body
    const body = (await req.json()) as typeof topicDiscoveryRequestSchema;
    const parseResult = topicDiscoveryRequestSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Invalid request data",
          details: parseResult.error.errors,
        },
        { status: 400 },
      );
    }

    // 2. Verify user exists in database
    const [userRecord] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, userId));
    if (!userRecord) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { projectId } = parseResult.data;

    // 4. Verify project ownership and fetch project data
    const [projectRecord] = await db
      .select()
      .from(projects)
      .where(
        and(eq(projects.id, projectId), eq(projects.userId, userRecord.id)),
      );

    if (!projectRecord) {
      return NextResponse.json(
        {
          error: "Project not found or access denied",
        },
        { status: 404 },
      );
    }

    // 5. Validate project has required data for topic discovery
    if (
      !projectRecord.productDescription ||
      projectRecord.productDescription.trim().length === 0
    ) {
      return NextResponse.json(
        {
          error: "Project must have a product description to generate topics",
          details: "Please add a product description to your project settings",
        },
        { status: 400 },
      );
    }

    // 6. Create topic discovery task with Parallel AI
    const taskResponse = await createTopicDiscoveryTask(projectRecord);

    // 7. Track the task in our database
    await db.insert(topicGenerationTasks).values({
      projectId,
      userId: userRecord.id,
      taskId: taskResponse.run_id,
      status: "running",
    });

    // 8. Return task information
    return NextResponse.json(
      {
        success: true,
        data: {
          taskId: taskResponse.run_id,
          status: taskResponse.status,
          isActive: taskResponse.is_active,
          createdAt: taskResponse.created_at,
          message:
            "Topic discovery task created successfully. You will receive 10 article topics once processing is complete.",
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[TOPIC_DISCOVERY_API] Error:", error);

    if (error instanceof Error) {
      // Handle specific error types
      if (error.message.includes("Parallel API")) {
        return NextResponse.json(
          {
            error: "Failed to create topic discovery task",
            details:
              "External service temporarily unavailable. Please try again later.",
          },
          { status: 502 },
        );
      }

      if (error.message.includes("API key")) {
        return NextResponse.json(
          {
            error: "Service configuration error",
            details: "Please contact support if this issue persists.",
          },
          { status: 500 },
        );
      }
    }

    return NextResponse.json(
      {
        error: "Internal server error",
        details: "An unexpected error occurred while processing your request.",
      },
      { status: 500 },
    );
  }
}
