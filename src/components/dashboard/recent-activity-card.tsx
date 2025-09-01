"use client";

import { Activity, FileText, Zap, Send } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ArticleMetrics } from "@/types";

interface RecentActivityCardProps {
  metrics: ArticleMetrics;
}

export function RecentActivityCard({ metrics }: RecentActivityCardProps) {
  const { recentActivity } = metrics;

  const getActionIcon = (action: 'created' | 'generated' | 'published') => {
    switch (action) {
      case 'created':
        return <FileText className="h-4 w-4 text-blue-600" />;
      case 'generated':
        return <Zap className="h-4 w-4 text-purple-600" />;
      case 'published':
        return <Send className="h-4 w-4 text-green-600" />;
    }
  };

  const getActionBadge = (action: 'created' | 'generated' | 'published') => {
    switch (action) {
      case 'created':
        return <Badge variant="blue">Created</Badge>;
      case 'generated':
        return <Badge variant="purple">Generated</Badge>;
      case 'published':
        return <Badge variant="green">Published</Badge>;
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) {
      return "Just now";
    } else if (diffInHours < 24) {
      return `${diffInHours}h ago`;
    } else {
      const diffInDays = Math.floor(diffInHours / 24);
      return `${diffInDays}d ago`;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-indigo-600" />
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        {recentActivity.length === 0 ? (
          <p className="text-sm text-muted-foreground">No recent activity</p>
        ) : (
          <div className="space-y-3">
            {recentActivity.slice(0, 5).map((activity) => (
              <div key={`${activity.id}-${activity.action}`} className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {getActionIcon(activity.action)}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{activity.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatTimestamp(activity.timestamp)}
                    </p>
                  </div>
                </div>
                <div className="ml-2 flex-shrink-0">
                  {getActionBadge(activity.action)}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}