"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ReactNode } from "react";

/**
 * Reusable tabs component with consistent orange branding and content-width styling.
 *
 * @example
 * ```tsx
 * <ReusableTabs
 *   activeTab={activeTab}
 *   onTabChange={setActiveTab}
 *   tabs={[
 *     { value: "tab1", label: "Tab 1", icon: <Icon />, count: 5 },
 *     { value: "tab2", label: "Tab 2" },
 *   ]}
 * />
 * ```
 */

export interface TabItem {
  value: string;
  label: string;
  icon?: ReactNode;
  count?: number;
  className?: string;
}

interface ReusableTabsProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  tabs: TabItem[];
  className?: string;
}

export function ReusableTabs({
  activeTab,
  onTabChange,
  tabs,
  className = "",
}: ReusableTabsProps) {
  return (
    <div className={`mb-6 ${className}`}>
      <Tabs value={activeTab} onValueChange={onTabChange}>
        <TabsList className="bg-muted/20 h-auto w-fit gap-1 rounded-lg border-0 p-1">
          {tabs.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className={`data-[state=inactive]:text-muted-foreground flex items-center gap-1.5 rounded-md px-2 text-sm font-medium transition-all data-[state=active]:border-orange-200 data-[state=active]:bg-orange-100 data-[state=active]:text-orange-500 ${tab.className ?? ""}`}
            >
              {tab.icon}
              {tab.label}
              {tab.count !== undefined && (
                <span className="ml-1 inline-flex items-center rounded-md bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-800">
                  {tab.count}
                </span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  );
}
