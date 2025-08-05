"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { WorkflowPhase } from "@/types";

interface WorkflowTabsProps {
  activeTab: WorkflowPhase;
  onTabChange: (tab: WorkflowPhase) => void;
  planningCount: number;
  generationsCount: number;
  publishingCount: number;
}

export function WorkflowTabs({
  activeTab,
  onTabChange,
  planningCount,
  generationsCount,
  publishingCount,
}: WorkflowTabsProps) {
  return (
    <div className="mb-6">
      <Tabs
        value={activeTab}
        onValueChange={onTabChange as (value: string) => void}
      >
        <TabsList className="bg-muted/20 h-auto w-fit gap-1 rounded-lg border-0 p-1">
          <TabsTrigger
            value="planning"
            className="data-[state=inactive]:text-muted-foreground flex items-center gap-1.5 rounded-md px-2 text-sm font-medium transition-all data-[state=active]:border-orange-200 data-[state=active]:bg-orange-100 data-[state=active]:text-orange-500"
          >
            Planning
            <span className="ml-1 inline-flex items-center rounded-md bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-800">
              {planningCount}
            </span>
          </TabsTrigger>

          <TabsTrigger
            value="generations"
            className="data-[state=inactive]:text-muted-foreground flex items-center gap-1.5 rounded-md px-2 text-sm font-medium transition-all data-[state=active]:border-orange-200 data-[state=active]:bg-orange-100 data-[state=active]:text-orange-500"
          >
            Generations
            <span className="ml-1 inline-flex items-center rounded-md bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-800">
              {generationsCount}
            </span>
          </TabsTrigger>

          <TabsTrigger
            value="publishing"
            className="data-[state=inactive]:text-muted-foreground flex items-center gap-1.5 rounded-md px-2 text-sm font-medium transition-all data-[state=active]:border-orange-200 data-[state=active]:bg-orange-100 data-[state=active]:text-orange-500"
          >
            Publishing
            <span className="ml-1 inline-flex items-center rounded-md bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-800">
              {publishingCount}
            </span>
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  );
}
