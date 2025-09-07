import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/server/db";
import { articles, users, projects, articleGeneration } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

export const maxDuration = 800;

// Types colocated with this API route
export interface ScheduleGenerationRequest {
  articleId: string;
  scheduledAt: string; // ISO datetime string
}

export interface ScheduleGenerationResponse {
  success: boolean;
  data?: {
    id: string;
    title: string;
    status: string;
    generationScheduledAt: string;
  };
  error?: string;
  message?: string;
}

const scheduleGenerationSchema = z.object({
  articleId: z.string().min(1),
  scheduledAt: z.string().datetime(),
});

// POST /api/articles/schedule-generation - Schedule article generation
export async function POST(req: NextRequest) {
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

    const body: unknown = await req.json();
    const validatedData = scheduleGenerationSchema.parse(body);
    const articleId = parseInt(validatedData.articleId, 10);

    if (isNaN(articleId)) {
      return NextResponse.json({ error: "Invalid article ID" }, { status: 400 });
    }

    // Get article and verify project ownership
    const [articleRecord] = await db
      .select({
        id: articles.id,
        title: articles.title,
        status: articles.status,
        projectId: articles.projectId,
      })
      .from(articles)
      .innerJoin(projects, eq(articles.projectId, projects.id))
      .where(
        and(
          eq(articles.id, articleId),
          eq(projects.userId, userRecord.id),
        ),
      )
      .limit(1);

    if (!articleRecord) {
      return NextResponse.json(
        { error: "Article not found or access denied" },
        { status: 404 },
      );
    }

    // Validate article can be scheduled
    if (articleRecord.status !== "idea" && articleRecord.status !== "scheduled") {
      return NextResponse.json(
        { error: "Article cannot be scheduled in its current status" },
        { status: 400 },
      );
    }

    // Validate scheduled time is in the future
    const scheduledDate = new Date(validatedData.scheduledAt);
    const now = new Date();
    
    if (scheduledDate <= now) {
      return NextResponse.json(
        { error: "Scheduled time must be in the future" },
        { status: 400 },
      );
    }

    // Update article with scheduled generation time and status
    const [updatedArticle] = await db
      .update(articles)
      .set({
        status: "scheduled",
        updatedAt: new Date(),
      })
      .where(eq(articles.id, articleId))
      .returning({
        id: articles.id,
        title: articles.title,
        status: articles.status,
      });

    if (!updatedArticle) {
      return NextResponse.json(
        { error: "Failed to update article" },
        { status: 500 },
      );
    }

    // Create or update article generation record with scheduling info
    const [existingGeneration] = await db
      .select({ id: articleGeneration.id })
      .from(articleGeneration)
      .where(eq(articleGeneration.articleId, articleId))
      .limit(1);

    if (existingGeneration) {
      // Update existing generation record
      await db
        .update(articleGeneration)
        .set({
          scheduledAt: scheduledDate,
          status: "pending",
          updatedAt: new Date(),
        })
        .where(eq(articleGeneration.id, existingGeneration.id));
    } else {
      // Create new generation record
      await db
        .insert(articleGeneration)
        .values({
          articleId,
          userId: userRecord.id,
          projectId: articleRecord.projectId,
          scheduledAt: scheduledDate,
          status: "pending",
        });
    }

    const response: ScheduleGenerationResponse = {
      success: true,
      data: {
        id: updatedArticle.id.toString(),
        title: updatedArticle.title,
        status: updatedArticle.status,
        generationScheduledAt: scheduledDate.toISOString(),
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Schedule generation error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input data", details: error.errors },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: "Failed to schedule generation" },
      { status: 500 },
    );
  }
}