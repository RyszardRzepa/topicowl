import { auth, clerkClient } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "@/server/db";
import {
  articles,
  users,
  projects,
  redditTasks,
  userCredits,
} from "@/server/db/schema";
import { eq, and, gte, lte, ne, sql, desc, inArray } from "drizzle-orm";
import type { ClerkPrivateMetadata } from "@/types";

// Dashboard stats response types
interface ArticleMetrics {
  totalThisMonth: number; // existing metric retained for backward compatibility
  totalPublishedAllTime: number; // NEW: all-time published count
  plannedThisWeek: number; // NEW: articles scheduled to publish this week (planning statuses with publishScheduledAt in week range)
  publishedThisWeek: number; // NEW: articles published within current week window
  publishedLastWeek: number; // UPDATED: strictly previous week (not rolling 7 days)
  workflowCounts: {
    planning: number;
    generating: number;
    publishing: number;
  };
  recentActivity: Array<{
    id: string;
    title: string;
    action: "created" | "generated" | "published";
    timestamp: string;
  }>;
  credits: {
    balance: number;
    usedThisMonth: number;
  };
}

interface RedditMetrics {
  weeklyStats: {
    totalTasks: number;
    completedTasks: number;
    completionRate: number;
    karmaEarned: number;
  };
  todaysPendingTasks: number;
  upcomingTasks: Array<{
    id: number;
    title: string;
    subreddit: string;
    scheduledDate: string;
  }>;
}

interface DashboardStatsResponse {
  articles: ArticleMetrics;
  reddit: {
    connected: boolean;
    data: RedditMetrics | null;
  };
}

export async function GET(request: NextRequest) {
  try {
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

    // Get project ID from query parameters
    const { searchParams } = new URL(request.url);
    const projectIdParam = searchParams.get("projectId");

    if (!projectIdParam) {
      return NextResponse.json(
        { error: "Project ID is required" },
        { status: 400 },
      );
    }

    const projectId = parseInt(projectIdParam, 10);
    if (isNaN(projectId)) {
      return NextResponse.json(
        { error: "Invalid project ID format" },
        { status: 400 },
      );
    }

    // Verify project exists and user owns it
    const [project] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
      .limit(1);

    if (!project) {
      return NextResponse.json(
        { error: "Project not found or access denied" },
        { status: 404 },
      );
    }

    // Calculate date ranges
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  // Week boundaries (Monday -> Sunday per getCurrentWeekStart)
  const currentWeekStart = getCurrentWeekStart();
  const currentWeekEnd = new Date(currentWeekStart);
  currentWeekEnd.setDate(currentWeekStart.getDate() + 6);
  currentWeekEnd.setHours(23, 59, 59, 999);

  const lastWeekStart = new Date(currentWeekStart);
  lastWeekStart.setDate(currentWeekStart.getDate() - 7);
  const lastWeekEnd = new Date(lastWeekStart);
  lastWeekEnd.setDate(lastWeekStart.getDate() + 6);
  lastWeekEnd.setHours(23, 59, 59, 999);
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);
  const startOfWeek = currentWeekStart; // alias for existing Reddit logic
  const endOfWeek = currentWeekEnd;
    const nextThreeDays = new Date(now);
    nextThreeDays.setDate(now.getDate() + 3);
    nextThreeDays.setHours(23, 59, 59, 999);

    // Fetch article metrics with error handling for each query
    let articleMetrics: ArticleMetrics;

    try {
      const [
        totalThisMonthResult,
        totalPublishedAllTimeResult,
        plannedThisWeekResult,
        publishedThisWeekResult,
        publishedLastWeekResult,
        workflowCountsResult,
        recentActivityResult,
        userCreditsResult,
      ] = await Promise.all([
        // Total articles created this month
        db
          .select({ count: sql<number>`count(*)` })
          .from(articles)
          .where(
            and(
              eq(articles.projectId, projectId),
              gte(articles.createdAt, startOfMonth),
              ne(articles.status, "deleted"),
            ),
          ),
        // Total published all time
        db
          .select({ count: sql<number>`count(*)` })
          .from(articles)
          .where(
            and(
              eq(articles.projectId, projectId),
              eq(articles.status, "published"),
            ),
          ),
        // Planned (scheduled) to publish this week across planning statuses
        db
          .select({ count: sql<number>`count(*)` })
          .from(articles)
          .where(
            and(
              eq(articles.projectId, projectId),
              inArray(articles.status, [
                "idea",
                "scheduled",
                "generating",
                "wait_for_publish",
              ]),
              gte(articles.publishScheduledAt, currentWeekStart),
              lte(articles.publishScheduledAt, currentWeekEnd),
            ),
          ),
        // Published this week
        db
          .select({ count: sql<number>`count(*)` })
          .from(articles)
          .where(
            and(
              eq(articles.projectId, projectId),
              eq(articles.status, "published"),
              gte(articles.publishedAt, currentWeekStart),
              lte(articles.publishedAt, currentWeekEnd),
            ),
          ),
        // Published last week (previous full week window)
        db
          .select({ count: sql<number>`count(*)` })
          .from(articles)
          .where(
            and(
              eq(articles.projectId, projectId),
              eq(articles.status, "published"),
              gte(articles.publishedAt, lastWeekStart),
              lte(articles.publishedAt, lastWeekEnd),
            ),
          ),

        // Workflow phase counts
        db
          .select({
            status: articles.status,
            count: sql<number>`count(*)`,
          })
          .from(articles)
          .where(
            and(
              eq(articles.projectId, projectId),
              ne(articles.status, "deleted"),
            ),
          )
          .groupBy(articles.status),

        // Recent activity (last 10 articles with activity)
        db
          .select({
            id: articles.id,
            title: articles.title,
            status: articles.status,
            createdAt: articles.createdAt,
            publishedAt: articles.publishedAt,
            updatedAt: articles.updatedAt,
          })
          .from(articles)
          .where(
            and(
              eq(articles.projectId, projectId),
              ne(articles.status, "deleted"),
            ),
          )
          .orderBy(desc(articles.updatedAt))
          .limit(10),

        // User credits
        db
          .select({ amount: userCredits.amount })
          .from(userCredits)
          .where(eq(userCredits.userId, userId))
          .limit(1),
      ]);

      // Process article metrics
      const totalThisMonth = Number(totalThisMonthResult[0]?.count ?? 0);
      const totalPublishedAllTime = Number(
        totalPublishedAllTimeResult[0]?.count ?? 0,
      );
      const plannedThisWeek = Number(plannedThisWeekResult[0]?.count ?? 0);
      const publishedThisWeek = Number(
        publishedThisWeekResult[0]?.count ?? 0,
      );
      const publishedLastWeek = Number(
        publishedLastWeekResult[0]?.count ?? 0,
      );

      // Map workflow statuses to phases
      const workflowCounts = {
        planning: 0,
        generating: 0,
        publishing: 0,
      };

      workflowCountsResult.forEach((row) => {
        const count = Number(row.count);
        switch (row.status) {
          case "idea":
          case "scheduled":
            workflowCounts.planning += count;
            break;
          case "generating":
            workflowCounts.generating += count;
            break;
          case "wait_for_publish":
            workflowCounts.publishing += count;
            break;
          // "published" and "failed" don't count toward active workflow
        }
      });

      // Process recent activity
      const recentActivity = recentActivityResult.map((article) => {
        let action: "created" | "generated" | "published";
        let timestamp: string;

        if (article.status === "published" && article.publishedAt) {
          action = "published";
          timestamp = article.publishedAt.toISOString();
        } else if (
          article.status === "wait_for_publish" ||
          article.status === "published"
        ) {
          action = "generated";
          timestamp = article.updatedAt.toISOString();
        } else {
          action = "created";
          timestamp = article.createdAt.toISOString();
        }

        return {
          id: article.id.toString(),
          title: article.title,
          action,
          timestamp,
        };
      });

      const credits = {
        balance: Number(userCreditsResult[0]?.amount ?? 0),
        usedThisMonth: 0, // TODO: Calculate from generation history if needed
      };

      articleMetrics = {
        totalThisMonth,
        totalPublishedAllTime,
        plannedThisWeek,
        publishedThisWeek,
        publishedLastWeek,
        workflowCounts,
        recentActivity,
        credits,
      };
    } catch (articleError) {
      console.error("Error fetching article data:", articleError);
      // Provide fallback article metrics to ensure API doesn't fail completely
      articleMetrics = {
        totalThisMonth: 0,
        totalPublishedAllTime: 0,
        plannedThisWeek: 0,
        publishedThisWeek: 0,
        publishedLastWeek: 0,
        workflowCounts: {
          planning: 0,
          generating: 0,
          publishing: 0,
        },
        recentActivity: [],
        credits: {
          balance: 0,
          usedThisMonth: 0,
        },
      };
    }

    // Check Reddit connection status
    let redditData: { connected: boolean; data: RedditMetrics | null } = {
      connected: false,
      data: null,
    };

    try {
      const clerk = await clerkClient();
      const user = await clerk.users.getUser(userId);
      const metadata = (user.privateMetadata ?? {}) as ClerkPrivateMetadata;
      const projectConnection = metadata.redditTokens?.[projectIdParam];

      if (projectConnection?.refreshToken) {
        // Fetch Reddit metrics
        const [weeklyTasksResult, todaysPendingResult, upcomingTasksResult] =
          await Promise.all([
            // Weekly Reddit task stats
            db
              .select({
                status: redditTasks.status,
                count: sql<number>`count(*)`,
                totalKarma: sql<number>`sum(${redditTasks.karmaEarned})`,
              })
              .from(redditTasks)
              .where(
                and(
                  eq(redditTasks.projectId, projectId),
                  gte(redditTasks.scheduledDate, startOfWeek),
                  lte(redditTasks.scheduledDate, endOfWeek),
                ),
              )
              .groupBy(redditTasks.status),

            // Today's pending tasks
            db
              .select({ count: sql<number>`count(*)` })
              .from(redditTasks)
              .where(
                and(
                  eq(redditTasks.projectId, projectId),
                  eq(redditTasks.status, "pending"),
                  gte(redditTasks.scheduledDate, startOfToday),
                  lte(redditTasks.scheduledDate, endOfToday),
                ),
              ),

            // Upcoming tasks (next 3 days)
            db
              .select({
                id: redditTasks.id,
                prompt: redditTasks.prompt,
                subreddit: redditTasks.subreddit,
                scheduledDate: redditTasks.scheduledDate,
              })
              .from(redditTasks)
              .where(
                and(
                  eq(redditTasks.projectId, projectId),
                  eq(redditTasks.status, "pending"),
                  gte(redditTasks.scheduledDate, now),
                  lte(redditTasks.scheduledDate, nextThreeDays),
                ),
              )
              .orderBy(redditTasks.scheduledDate, redditTasks.taskOrder)
              .limit(10),
          ]);

        // Process Reddit metrics
        let totalTasks = 0;
        let completedTasks = 0;
        let karmaEarned = 0;

        weeklyTasksResult.forEach((row) => {
          const count = Number(row.count);
          totalTasks += count;
          if (row.status === "completed") {
            completedTasks += count;
            karmaEarned += Number(row.totalKarma ?? 0);
          }
        });

        const completionRate =
          totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
        const todaysPendingTasks = Number(todaysPendingResult[0]?.count ?? 0);

        const upcomingTasks = upcomingTasksResult.map((task) => ({
          id: task.id,
          title:
            task.prompt.length > 50
              ? `${task.prompt.substring(0, 50)}...`
              : task.prompt,
          subreddit: task.subreddit,
          scheduledDate: task.scheduledDate.toISOString(),
        }));

        redditData = {
          connected: true,
          data: {
            weeklyStats: {
              totalTasks,
              completedTasks,
              completionRate,
              karmaEarned,
            },
            todaysPendingTasks,
            upcomingTasks,
          },
        };
      }
    } catch (redditError) {
      console.error("Error fetching Reddit data:", redditError);
      // Continue with Reddit disconnected state - this ensures graceful degradation
      // If Reddit data fails to load, we still return article data
      redditData = {
        connected: false,
        data: null,
      };
    }

    const response: DashboardStatsResponse = {
      articles: articleMetrics,
      reddit: redditData,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Dashboard stats error:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard statistics" },
      { status: 500 },
    );
  }
}

function getCurrentWeekStart(): Date {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Convert to days from Monday
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - daysFromMonday);
  weekStart.setHours(0, 0, 0, 0);
  return weekStart;
}
