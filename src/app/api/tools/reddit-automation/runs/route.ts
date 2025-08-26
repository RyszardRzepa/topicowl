import { auth } from "@clerk/nextjs/server";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { redditAutomationRuns, redditAutomations, projects } from "@/server/db/schema";
import { eq, and, desc } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");
    const automationId = searchParams.get("automationId");

    if (!projectId) {
      return NextResponse.json(
        { error: "Project ID is required" },
        { status: 400 },
      );
    }

    // Verify project ownership
    const [projectRecord] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, parseInt(projectId)), eq(projects.userId, userId)));

    if (!projectRecord) {
      return NextResponse.json(
        { error: "Project not found or access denied" },
        { status: 404 },
      );
    }

    // Build query to get runs with automation details
    let whereConditions = eq(redditAutomations.projectId, parseInt(projectId));
    
    // Filter by specific automation if provided
    if (automationId) {
      whereConditions = and(
        eq(redditAutomations.projectId, parseInt(projectId)),
        eq(redditAutomationRuns.automationId, parseInt(automationId)),
      )!;
    }

    const runs = await db
      .select({
        id: redditAutomationRuns.id,
        status: redditAutomationRuns.status,
        results: redditAutomationRuns.results,
        errorMessage: redditAutomationRuns.errorMessage,
        startedAt: redditAutomationRuns.startedAt,
        completedAt: redditAutomationRuns.completedAt,
        automationId: redditAutomationRuns.automationId,
        automationName: redditAutomations.name,
      })
      .from(redditAutomationRuns)
      .innerJoin(redditAutomations, eq(redditAutomationRuns.automationId, redditAutomations.id))
      .where(whereConditions)
      .orderBy(desc(redditAutomationRuns.startedAt))
      .limit(100); // Limit to last 100 runs

    return NextResponse.json({
      success: true,
      runs,
    });
  } catch (error) {
    console.error("Get automation runs error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
