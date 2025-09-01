"use client";

import type { ArticleMetrics } from "@/types";
import { ArticleStatsCard } from "./article-stats-card";
import { WorkflowStatusCard } from "./workflow-status-card";
import { RecentActivityCard } from "./recent-activity-card";
import { ArticleEmptyState } from "./article-empty-state";

interface ArticleMetricsSectionProps {
  metrics: ArticleMetrics;
}

export function ArticleMetricsSection({ metrics }: ArticleMetricsSectionProps) {
  // Check if user has no articles (empty state)
  const hasNoArticles = metrics.totalThisMonth === 0 && metrics.recentActivity.length === 0;

  if (hasNoArticles) {
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-semibold">Articles</h2>
        <ArticleEmptyState />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Articles</h2>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <ArticleStatsCard metrics={metrics} />
        <WorkflowStatusCard metrics={metrics} />
        <RecentActivityCard metrics={metrics} />
      </div>
    </div>
  );
}