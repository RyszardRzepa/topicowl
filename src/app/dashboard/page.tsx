"use client";

import { useDashboardStats } from "@/hooks/use-dashboard-stats";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Clock,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Zap,
  MessageSquare,
  TrendingUp,
  Users,
  Link2,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";

function DashboardContent() {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const { data, loading, error, refreshStats, isRedditConnected } =
    useDashboardStats();

  // Helper to safely get metric values with fallbacks
  const getMetric = (path: string, defaultValue = 0): number => {
    const paths = path.split(".");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
    let current: any = data;
    for (const p of paths) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      current = current?.[p];
      if (current === undefined || current === null) return defaultValue;
    }
    // Handle both string and number values
    if (typeof current === "string") {
      const parsed = parseInt(current, 10);
      return isNaN(parsed) ? defaultValue : parsed;
    }
    return typeof current === "number" ? current : defaultValue;
  };

  // Loading skeleton - more compact
  if (loading && !data) {
    return (
      <div className="min-h-screen bg-gray-50/50 p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-6 flex items-center justify-between">
            <div className="h-9 w-24 animate-pulse rounded bg-gray-200" />
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 8 }, (_, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="space-y-2">
                    <div className="h-4 w-20 animate-pulse rounded bg-gray-200" />
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

  // Main dashboard view
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

        {/* Article Metrics Section */}
        <div className="mb-6">
          <h2 className="mb-3 text-lg font-semibold text-gray-700">
            Article Performance
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-muted-foreground text-sm">
                      Total This Month
                    </p>
                    <p className="text-2xl font-bold">
                      {getMetric("articles.totalThisMonth", 0)}
                    </p>
                  </div>
                  <FileText className="h-8 w-8 text-blue-500 opacity-20" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-muted-foreground text-sm">Planning</p>
                    <p className="text-2xl font-bold">
                      {getMetric("articles.workflowCounts.planning", 0)}
                    </p>
                  </div>
                  <Clock className="h-8 w-8 text-orange-500 opacity-20" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-muted-foreground text-sm">Generating</p>
                    <p className="text-2xl font-bold">
                      {getMetric("articles.workflowCounts.generating", 0)}
                    </p>
                  </div>
                  <CheckCircle className="h-8 w-8 text-green-500 opacity-20" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-muted-foreground text-sm">
                      Published Last Week
                    </p>
                    <p className="text-2xl font-bold">
                      {getMetric("articles.publishedLastWeek", 0)}
                    </p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-purple-500 opacity-20" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Reddit Metrics Section */}
        <div className="mb-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-700">
              Reddit Engagement
            </h2>
            {!isRedditConnected && (
              <Link href="/settings/integrations">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-blue-600 hover:text-blue-700"
                >
                  Connect Reddit
                  <ArrowRight className="ml-1 h-3 w-3" />
                </Button>
              </Link>
            )}
          </div>

          {isRedditConnected ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-muted-foreground text-sm">
                        Total Tasks
                      </p>
                      <p className="text-2xl font-bold">
                        {getMetric("reddit.data.weeklyStats.totalTasks", 0)}
                      </p>
                    </div>
                    <MessageSquare className="h-8 w-8 text-orange-500 opacity-20" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-muted-foreground text-sm">Completed</p>
                      <p className="text-2xl font-bold">
                        {getMetric("reddit.data.weeklyStats.completedTasks", 0)}
                      </p>
                    </div>
                    <Zap className="h-8 w-8 text-yellow-500 opacity-20" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-muted-foreground text-sm">
                        Completion Rate
                      </p>
                      <p className="text-2xl font-bold">
                        {getMetric("reddit.data.weeklyStats.completionRate", 0)}
                        %
                      </p>
                    </div>
                    <Users className="h-8 w-8 text-blue-500 opacity-20" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-muted-foreground text-sm">
                        Karma Earned
                      </p>
                      <p className="text-2xl font-bold">
                        {getMetric("reddit.data.weeklyStats.karmaEarned", 0)}
                      </p>
                    </div>
                    <CheckCircle className="h-8 w-8 text-green-500 opacity-20" />
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card className="border-dashed">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-orange-100 p-2">
                      <Link2 className="h-5 w-5 text-orange-600" />
                    </div>
                    <div>
                      <p className="font-medium">Reddit Not Connected</p>
                      <p className="text-muted-foreground text-sm">
                        Connect Reddit to track engagement metrics
                      </p>
                    </div>
                  </div>
                  <Link href="/settings/integrations">
                    <Button size="sm">
                      Connect
                      <ArrowRight className="ml-1 h-3 w-3" />
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
