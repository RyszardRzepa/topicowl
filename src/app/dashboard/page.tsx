"use client";

import { useDashboardStats } from "@/hooks/use-dashboard-stats";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  CalendarRange,
  CheckCircle2,
  AlertCircle,
  Target,
  TrendingUp,
  PieChart,
  Link2,
  ArrowRight,
  ListChecks,
} from "lucide-react";
import Link from "next/link";

function DashboardContent() {
  const { data, loading, error, isRedditConnected } = useDashboardStats();

  // Helper to safely get metric values with fallbacks
  const getMetric = (path: string, defaultValue = 0): number => {
    const paths = path.split(".");
    let current: unknown = data as Record<string, unknown> | null;
    for (const p of paths) {
      if (
        current &&
        typeof current === "object" &&
        p in (current as Record<string, unknown>)
      ) {
        current = (current as Record<string, unknown>)[p];
      } else {
        return defaultValue;
      }
      if (current === undefined || current === null) return defaultValue;
    }
    if (typeof current === "string") {
      const parsed = parseInt(current, 10);
      return isNaN(parsed) ? defaultValue : parsed;
    }
    return typeof current === "number" ? current : defaultValue;
  };

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-gray-50/50 p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-6 flex items-center justify-between">
            <div className="h-9 w-24 animate-pulse rounded bg-gray-200" />
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 8 }, (_, i) => (
              <Card key={i}>
                <CardContent className="p-5">
                  <div className="space-y-3">
                    <div className="h-3 w-20 animate-pulse rounded bg-gray-200" />
                    <div className="h-8 w-16 animate-pulse rounded bg-gray-200" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="">
      <div className="mx-auto">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            {error && (
              <Badge
                variant="outline"
                className="border-yellow-300 bg-yellow-50 text-yellow-700"
              >
                <AlertCircle className="mr-1 h-3 w-3" />
                Some data may be outdated
              </Badge>
            )}
          </div>
        </div>

        {/* Unified Main Stats */}
        <div className="mb-10">
          <h2 className="mb-4 text-lg font-semibold text-gray-800">Articles</h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {/* Total Published All Time */}
            <Card className="relative overflow-hidden border-0 shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">
                      Total Articles
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-gray-900">
                      {getMetric("articles.totalPublishedAllTime", 0)}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      Published all-time
                    </p>
                  </div>
                  <div className="rounded-lg bg-gray-100 p-2">
                    <FileText className="h-5 w-5 text-gray-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Planned This Week */}
            <Card className="relative overflow-hidden border-0 shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">
                      Planned This Week
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-gray-900">
                      {getMetric("articles.plannedThisWeek", 0)}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">Scheduled</p>
                  </div>
                  <div className="rounded-lg bg-gray-100 p-2">
                    <CalendarRange className="h-5 w-5 text-gray-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Published This Week */}
            <Card className="relative overflow-hidden border-0 shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">
                      Published This Week
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-gray-900">
                      {getMetric("articles.publishedThisWeek", 0)}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      Current week (Mon-Sun)
                    </p>
                  </div>
                  <div className="rounded-lg bg-gray-100 p-2">
                    <CheckCircle2 className="h-5 w-5 text-gray-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Published Last Week */}
            <Card className="relative overflow-hidden border-0 shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">
                      Published Last Week
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-gray-900">
                      {getMetric("articles.publishedLastWeek", 0)}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">Previous week</p>
                  </div>
                  <div className="rounded-lg bg-gray-100 p-2">
                    <TrendingUp className="h-5 w-5 text-gray-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Reddit Key Stats */}
        <div className="mb-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800">Reddit</h2>
            {!isRedditConnected && (
              <Link href="/settings/integrations">
                <Button variant="outline" size="sm" className="gap-1">
                  <Link2 className="h-4 w-4" /> Connect
                </Button>
              </Link>
            )}
          </div>
          {isRedditConnected ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <Card className="border-0 shadow-sm">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">
                        Tasks This Week
                      </p>
                      <p className="mt-2 text-2xl font-semibold text-gray-900">
                        {getMetric("reddit.data.weeklyStats.totalTasks", 0)}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">Scheduled</p>
                    </div>
                    <div className="rounded-lg bg-gray-100 p-2">
                      <Target className="h-5 w-5 text-gray-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">
                        Completed
                      </p>
                      <p className="mt-2 text-2xl font-semibold text-gray-900">
                        {getMetric("reddit.data.weeklyStats.completedTasks", 0)}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">This week</p>
                    </div>
                    <div className="rounded-lg bg-gray-100 p-2">
                      <ListChecks className="h-5 w-5 text-gray-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">
                        Completion Rate
                      </p>
                      <p className="mt-2 text-2xl font-semibold text-gray-900">
                        {getMetric("reddit.data.weeklyStats.completionRate", 0)}
                        %
                      </p>
                      <p className="mt-1 text-xs text-gray-500">Of tasks</p>
                    </div>
                    <div className="rounded-lg bg-gray-100 p-2">
                      <PieChart className="h-5 w-5 text-gray-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card className="border-dashed border-gray-300 bg-gray-50/50">
              <CardContent className="p-8">
                <div className="flex flex-col items-center justify-center gap-3 text-center sm:flex-row sm:items-start sm:justify-between sm:text-left">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-gray-100 p-2">
                      <Link2 className="h-5 w-5 text-gray-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">
                        Reddit Not Connected
                      </p>
                      <p className="text-sm text-gray-600">
                        Connect Reddit to track engagement & completion rate
                      </p>
                    </div>
                  </div>
                  <Link href="/settings/integrations" className="shrink-0">
                    <Button size="sm" className="gap-1">
                      Connect <ArrowRight className="h-3 w-3" />
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return <DashboardContent />;
}
