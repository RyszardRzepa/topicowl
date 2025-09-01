"use client";

import { useState } from "react";
import { Calendar, LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ArticleCalendarView } from "@/components/articles/calendar/ArticleCalendarView";
import { WorkflowDashboard } from "@/components/workflow/workflow-dashboard";

type ViewMode = 'calendar' | 'workflow';

export default function ArticlesPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('calendar');

  return (
    <div className="h-[calc(100vh-120px)]">
      {/* View Toggle */}
      <div className="flex justify-between items-center p-4 border-b bg-background">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold">Articles</h1>
        </div>
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
          <Button
            variant={viewMode === 'calendar' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('calendar')}
            className="flex items-center gap-2"
          >
            <Calendar className="h-4 w-4" />
            Calendar
          </Button>
          <Button
            variant={viewMode === 'workflow' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('workflow')}
            className="flex items-center gap-2"
          >
            <LayoutGrid className="h-4 w-4" />
            Workflow
          </Button>
        </div>
      </div>

      {/* Content Area */}
      <div className="h-[calc(100%-60px)]">
        {viewMode === 'calendar' ? (
          <ArticleCalendarView className="h-full" />
        ) : (
          <WorkflowDashboard className="h-full p-4" />
        )}
      </div>
    </div>
  );
}
