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
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="planning" className="flex items-center gap-2">
            Article Planning
            {planningCount > 0 && (
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                {planningCount}
              </span>
            )}
          </TabsTrigger>

          <TabsTrigger value="generations" className="flex items-center gap-2">
            Article Generations
            {generationsCount > 0 && (
              <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-800">
                {generationsCount}
              </span>
            )}
          </TabsTrigger>

          <TabsTrigger value="publishing" className="flex items-center gap-2">
            Publishing Pipeline
            {publishingCount > 0 && (
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                {publishingCount}
              </span>
            )}
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  );
}
