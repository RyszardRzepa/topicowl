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
  
  // Defensive programming - ensure we have a valid array
  const activities = Array.isArray(recentActivity) ? recentActivity : [];

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
    <Card className="h-full hover:shadow-md transition-shadow duration-200 flex flex-col">
      <CardHeader className="pb-2 flex-shrink-0">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Activity className="h-4 w-4 text-indigo-600 flex-shrink-0" />
          <span className="truncate">Recent Activity</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 pb-3 flex-1 min-h-0">
        {activities.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-muted-foreground text-center">No recent activity</p>
          </div>
        ) : (
          <div className="h-full overflow-y-auto space-y-2 pr-1">
            {activities.slice(0, 10).map((activity) => (
              <div key={`${activity.id}-${activity.action}`} className="flex items-start justify-between gap-2 p-2 rounded-lg bg-gray-50/50 hover:bg-gray-100/50 transition-colors">
                <div className="flex items-start gap-2 min-w-0 flex-1">
                  <div className="flex-shrink-0 mt-0.5">
                    {getActionIcon(activity.action)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium leading-relaxed line-clamp-2">{activity.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatTimestamp(activity.timestamp)}
                    </p>
                  </div>
                </div>
                <div className="flex-shrink-0">
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