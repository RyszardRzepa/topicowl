import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/server/db";
import { articles, users, projects, articleGeneration } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

export const maxDuration = 800;

// Types colocated with this API route
export interface RescheduleArticleRequest {
  scheduledAt: string; // ISO datetime string
  scheduleType: 'generation' | 'publishing';
}

export interface RescheduleArticleResponse {
  success: boolean;
  data?: {
    id: string;
    title: string;
    status: string;
    generationScheduledAt?: string | null;
    publishScheduledAt?: string | null;
  };
  error?: string;
  message?: string;
}

const rescheduleArticleSchema = z.object({
  scheduledAt: z.string().datetime(),
  scheduleType: z.enum(['generation', 'publishing']),
});

// PUT /api/articles/[id]/reschedule - Reschedule article generation or publishing
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
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

    const articleId = parseInt(params.id, 10);
    if (isNaN(articleId)) {
      return NextResponse.json({ error: "Invalid article ID" }, { status: 400 });
    }

    const body: unknown = await req.json();
    const validatedData = rescheduleArticleSchema.parse(body);

    // Get article and verify project ownership
    const [articleRecord] = await db
      .select({
        id: articles.id,
        title: articles.title,
        status: articles.status,
        projectId: articles.projectId,
        publishScheduledAt: articles.publishScheduledAt,
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

    // Validate scheduled time is in the future
    const scheduledDate = new Date(validatedData.scheduledAt);
    const now = new Date();
    
    if (scheduledDate <= now) {
      return NextResponse.json(
        { error: "Scheduled time must be in the future" },
        { status: 400 },
      );
    }

    let updatedArticle: { id: number; title: string; status: string; publishScheduledAt: Date | null } | undefined;
    let generationScheduledAt: string | null = null;
    let publishScheduledAt: string | null = null;

    if (validatedData.scheduleType === 'generation') {
      // Validate article can be scheduled for generation
      if (!['idea', 'scheduled', 'failed'].includes(articleRecord.status)) {
        return NextResponse.json(
          { error: "Article cannot be rescheduled for generation in its current status" },
          { status: 400 },
        );
      }

      // Update article status and generation scheduling
      [updatedArticle] = await db
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
          publishScheduledAt: articles.publishScheduledAt,
        });

      if (!updatedArticle) {
        return NextResponse.json(
          { error: "Failed to update article" },
          { status: 500 },
        );
      }

      // Update or create article generation record
      const [existingGeneration] = await db
        .select({ id: articleGeneration.id })
        .from(articleGeneration)
        .where(eq(articleGeneration.articleId, articleId))
        .limit(1);

      if (existingGeneration) {
        await db
          .update(articleGeneration)
          .set({
            scheduledAt: scheduledDate,
            status: "pending",
            updatedAt: new Date(),
          })
          .where(eq(articleGeneration.id, existingGeneration.id));
      } else {
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

      generationScheduledAt = scheduledDate.toISOString();
      publishScheduledAt = updatedArticle.publishScheduledAt?.toISOString() ?? null;

    } else if (validatedData.scheduleType === 'publishing') {
      // Validate article can be scheduled for publishing
      if (!['wait_for_publish', 'published', 'scheduled'].includes(articleRecord.status)) {
        return NextResponse.json(
          { error: "Article cannot be rescheduled for publishing in its current status" },
          { status: 400 },
        );
      }

      // Update article with publishing schedule
      [updatedArticle] = await db
        .update(articles)
        .set({
          publishScheduledAt: scheduledDate,
          updatedAt: new Date(),
        })
        .where(eq(articles.id, articleId))
        .returning({
          id: articles.id,
          title: articles.title,
          status: articles.status,
          publishScheduledAt: articles.publishScheduledAt,
        });

      if (!updatedArticle) {
        return NextResponse.json(
          { error: "Failed to update article" },
          { status: 500 },
        );
      }

      // Get generation scheduling info
      const [generationRecord] = await db
        .select({ scheduledAt: articleGeneration.scheduledAt })
        .from(articleGeneration)
        .where(eq(articleGeneration.articleId, articleId))
        .limit(1);

      generationScheduledAt = generationRecord?.scheduledAt?.toISOString() ?? null;
      publishScheduledAt = scheduledDate.toISOString();
    }

    if (!updatedArticle) {
      return NextResponse.json(
        { error: "Failed to process request" },
        { status: 500 },
      );
    }

    const response: RescheduleArticleResponse = {
      success: true,
      data: {
        id: updatedArticle.id.toString(),
        title: updatedArticle.title,
        status: updatedArticle.status,
        generationScheduledAt,
        publishScheduledAt,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Reschedule article error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input data", details: error.errors },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: "Failed to reschedule article" },
      { status: 500 },
    );
  }
}