'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import type { WorkflowPhase } from '@/types';

interface WorkflowTabsProps {
  activeTab: WorkflowPhase;
  onTabChange: (tab: WorkflowPhase) => void;
  planningCount: number;
  publishingCount: number;
}

export function WorkflowTabs({ 
  activeTab, 
  onTabChange, 
  planningCount, 
  publishingCount 
}: WorkflowTabsProps) {
  const handleKeyDown = (e: React.KeyboardEvent, tab: WorkflowPhase) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onTabChange(tab);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      const newTab = tab === 'planning' ? 'publishing' : 'planning';
      onTabChange(newTab);
    }
  };

  return (
    <div className="border-b border-gray-200 mb-6">
      <nav className="-mb-px flex space-x-8" role="tablist">
        <button
          role="tab"
          aria-selected={activeTab === 'planning'}
          aria-controls="planning-panel"
          id="planning-tab"
          className={cn(
            "whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
            {
              "border-blue-500 text-blue-600": activeTab === 'planning',
              "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300": activeTab !== 'planning',
            }
          )}
          onClick={() => onTabChange('planning')}
          onKeyDown={(e) => handleKeyDown(e, 'planning')}
        >
          Article Planning
          {planningCount > 0 && (
            <span className="ml-2 bg-blue-100 text-blue-800 text-xs font-medium px-2 py-0.5 rounded-full">
              {planningCount}
            </span>
          )}
        </button>
        
        <button
          role="tab"
          aria-selected={activeTab === 'publishing'}
          aria-controls="publishing-panel"
          id="publishing-tab"
          className={cn(
            "whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
            {
              "border-blue-500 text-blue-600": activeTab === 'publishing',
              "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300": activeTab !== 'publishing',
            }
          )}
          onClick={() => onTabChange('publishing')}
          onKeyDown={(e) => handleKeyDown(e, 'publishing')}
        >
          Publishing Pipeline
          {publishingCount > 0 && (
            <span className="ml-2 bg-green-100 text-green-800 text-xs font-medium px-2 py-0.5 rounded-full">
              {publishingCount}
            </span>
          )}
        </button>
      </nav>
    </div>
  );
}