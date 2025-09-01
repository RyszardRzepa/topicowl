"use client";

import { FileText, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ArticleMetrics } from "@/types";

interface ArticleStatsCardProps {
  metrics: ArticleMetrics;
}

export function ArticleStatsCard({ metrics }: ArticleStatsCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-blue-600" />
          Article Statistics
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-2xl font-bold">{metrics.totalThisMonth}</p>
            <p className="text-sm text-muted-foreground">Created this month</p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1">
              <p className="text-2xl font-bold">{metrics.publishedLastWeek}</p>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </div>
            <p className="text-sm text-muted-foreground">Published last week</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}