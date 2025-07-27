'use client';

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { WorkflowPhase } from '@/types';

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
  publishingCount 
}: WorkflowTabsProps) {
  return (
    <div className="mb-6">
      <Tabs value={activeTab} onValueChange={onTabChange as (value: string) => void}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="planning" className="flex items-center gap-2">
            Article Planning
            {planningCount > 0 && (
              <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-0.5 rounded-full">
                {planningCount}
              </span>
            )}
          </TabsTrigger>
          
          <TabsTrigger value="generations" className="flex items-center gap-2">
            Article Generations
            {generationsCount > 0 && (
              <span className="bg-orange-100 text-orange-800 text-xs font-medium px-2 py-0.5 rounded-full">
                {generationsCount}
              </span>
            )}
          </TabsTrigger>
          
          <TabsTrigger value="publishing" className="flex items-center gap-2">
            Publishing Pipeline
            {publishingCount > 0 && (
              <span className="bg-green-100 text-green-800 text-xs font-medium px-2 py-0.5 rounded-full">
                {publishingCount}
              </span>
            )}
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  );
}