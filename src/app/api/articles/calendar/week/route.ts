import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/server/db";
import { articles, users, projects, articleGeneration } from "@/server/db/schema";
import { eq, and, gte, lt, ne } from "drizzle-orm";
import { z } from "zod";
import { startOfWeek, endOfWeek, format } from "date-fns";

export const maxDuration = 800;

// Types colocated with this API route
export interface WeeklyArticlesRequest {
  weekStartDate: string; // ISO date string
  projectId: number;
}

export interface WeeklyArticlesData {
  weekStartDate: string;
  articles: Record<string, ArticleWithScheduling[]>; // key: YYYY-MM-DD, value: articles for that day
}

export interface WeeklyArticlesResponse {
  success: boolean;
  data: WeeklyArticlesData;
}

interface ArticleWithScheduling {
  id: number;
  title: string;
  description: string | null;
  status: string;
  projectId: number;
  keywords: unknown;
  targetAudience: string | null;
  publishScheduledAt: Date | null;
  publishedAt: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  // Generation scheduling from articleGeneration table
  generationScheduledAt?: Date | null;
  generationStatus?: string | null;
  generationProgress?: number | null;
}

const weeklyArticlesSchema = z.object({
  weekStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD format
  projectId: z.number().int().positive().optional(),
});

// GET /api/articles/calendar/week - Get articles for a specific week
export async function GET(req: NextRequest) {
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

    // Parse query parameters
    const { searchParams } = new URL(req.url);
    const weekStartDateParam = searchParams.get("weekStartDate");
    const projectIdParam = searchParams.get("projectId");

    if (!weekStartDateParam) {
      return NextResponse.json(
        { error: "weekStartDate parameter is required" },
        { status: 400 },
      );
    }

    const validationData: { weekStartDate: string; projectId?: number } = {
      weekStartDate: weekStartDateParam,
    };

    if (projectIdParam) {
      const projectId = parseInt(projectIdParam, 10);
      if (isNaN(projectId)) {
        return NextResponse.json(
          { error: "Invalid project ID" },
          { status: 400 },
        );
      }
      validationData.projectId = projectId;
    }

    const validatedParams = weeklyArticlesSchema.parse(validationData);

    // Calculate week date range
    const weekStart = startOfWeek(new Date(validatedParams.weekStartDate), { weekStartsOn: 1 }); // Monday
    const weekEnd = endOfWeek(new Date(validatedParams.weekStartDate), { weekStartsOn: 1 }); // Sunday

    // Build base query conditions
    let whereConditions = and(
      eq(projects.userId, userRecord.id),
      ne(articles.status, "deleted"),
    );

    // Add project filter if specified
    if (validatedParams.projectId) {
      // Verify project ownership
      const [projectRecord] = await db
        .select({ id: projects.id })
        .from(projects)
        .where(
          and(
            eq(projects.id, validatedParams.projectId),
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

      whereConditions = and(
        whereConditions,
        eq(articles.projectId, validatedParams.projectId),
      );
    }

    // Get articles that fall within the week range
    // Articles are included if they have:
    // 1. publishScheduledAt within the week
    // 2. generationScheduledAt within the week
    // 3. createdAt within the week (for unscheduled articles)
    // 4. publishedAt within the week
    const articlesWithGeneration = await db
      .select({
        id: articles.id,
        title: articles.title,
        description: articles.description,
        status: articles.status,
        projectId: articles.projectId,
        keywords: articles.keywords,
        targetAudience: articles.targetAudience,
        publishScheduledAt: articles.publishScheduledAt,
        publishedAt: articles.publishedAt,
        notes: articles.notes,
        createdAt: articles.createdAt,
        updatedAt: articles.updatedAt,
        // Generation info from articleGeneration table
        generationScheduledAt: articleGeneration.scheduledAt,
        generationStatus: articleGeneration.status,
        generationProgress: articleGeneration.progress,
      })
      .from(articles)
      .innerJoin(projects, eq(articles.projectId, projects.id))
      .leftJoin(articleGeneration, eq(articles.id, articleGeneration.articleId))
      .where(
        and(
          whereConditions,
          // Include articles with any date within the week range
          // This OR condition includes articles if any of their dates fall within the week
          // Note: This might include more articles than needed, but we'll filter client-side for exact positioning
        ),
      )
      .orderBy(articles.createdAt);

    // Filter articles that actually belong in this week
    const weekStartTime = weekStart.getTime();
    const weekEndTime = weekEnd.getTime();

    const relevantArticles = articlesWithGeneration.filter((article) => {
      // Check if any relevant date falls within the week
      const dates = [
        article.publishScheduledAt,
        article.generationScheduledAt,
        article.publishedAt,
        article.createdAt, // Include for unscheduled articles
      ].filter(Boolean);

      return dates.some((date) => {
        if (!date) return false;
        const dateTime = new Date(date).getTime();
        return dateTime >= weekStartTime && dateTime <= weekEndTime;
      });
    });

    // Group articles by day (YYYY-MM-DD format)
    const articlesByDay: Record<string, ArticleWithScheduling[]> = {};

    relevantArticles.forEach((article) => {
      // Determine the primary date for calendar positioning
      // Priority: publishScheduledAt > generationScheduledAt > publishedAt > createdAt
      const primaryDate = 
        article.publishScheduledAt ||
        article.generationScheduledAt ||
        article.publishedAt ||
        article.createdAt;

      if (primaryDate) {
        const dayKey = format(new Date(primaryDate), "yyyy-MM-dd");
        if (!articlesByDay[dayKey]) {
          articlesByDay[dayKey] = [];
        }
        articlesByDay[dayKey].push(article);
      }
    });

    const response: WeeklyArticlesResponse = {
      success: true,
      data: {
        weekStartDate: format(weekStart, "yyyy-MM-dd"),
        articles: articlesByDay,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Weekly articles error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid query parameters", details: error.errors },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: "Failed to fetch weekly articles" },
      { status: 500 },
    );
  }
}