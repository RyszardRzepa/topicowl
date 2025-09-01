"use client";

import type { ArticleMetrics } from "@/types";
import { ArticleMetricsSection } from "./article-metrics-section";

// Test component to verify article metrics components work
export function ArticleMetricsTest() {
  // Mock data for testing
  const mockMetrics: ArticleMetrics = {
    totalThisMonth: 12,
    publishedLastWeek: 3,
    workflowCounts: {
      planning: 5,
      generating: 2,
      publishing: 1,
    },
    recentActivity: [
      {
        id: "1",
        title: "How to Build a React Dashboard",
        action: "published",
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
      },
      {
        id: "2", 
        title: "Understanding TypeScript Generics",
        action: "generated",
        timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(), // 5 hours ago
      },
      {
        id: "3",
        title: "Next.js App Router Guide",
        action: "created",
        timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
      },
    ],
    credits: {
      balance: 25,
      usedThisMonth: 15,
    },
  };

  // Mock empty state data
  const emptyMetrics: ArticleMetrics = {
    totalThisMonth: 0,
    publishedLastWeek: 0,
    workflowCounts: {
      planning: 0,
      generating: 0,
      publishing: 0,
    },
    recentActivity: [],
    credits: {
      balance: 50,
      usedThisMonth: 0,
    },
  };

  return (
    <div className="space-y-12 p-6">
      <div>
        <h1 className="text-2xl font-bold mb-6">Article Metrics Components Test</h1>
        
        <div className="space-y-8">
          <div>
            <h2 className="text-lg font-semibold mb-4">With Data</h2>
            <ArticleMetricsSection metrics={mockMetrics} />
          </div>
          
          <div>
            <h2 className="text-lg font-semibold mb-4">Empty State</h2>
            <ArticleMetricsSection metrics={emptyMetrics} />
          </div>
        </div>
      </div>
    </div>
  );
}