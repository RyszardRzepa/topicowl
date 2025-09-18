import type { ArticleStatus } from "@/types";
import { articleStatusEnum } from "@/server/db/schema";

// Centralized article status management
// Single source of truth for all status-related logic

// Use schema enum as the single source of truth for article statuses
// This exports the exact enum values from the database schema
export const ARTICLE_STATUSES = articleStatusEnum.enumValues;

// For convenience, export individual status constants derived from schema
// This ensures type safety and single source of truth with the database schema
export const STATUSES = {
  IDEA: "idea",
  SCHEDULED: "scheduled",
  GENERATING: "generating",
  WAIT_FOR_PUBLISH: "wait_for_publish",
  PUBLISHED: "published",
  FAILED: "failed",
} as const satisfies Record<string, ArticleStatus>;

// User-facing display statuses - what users see
export const DISPLAY_STATUSES = {
  IDEA: "idea",
  GENERATED: "generated", 
  PUBLISHED: "published",
} as const;

// Status colors for consistent UI theming
export const STATUS_COLORS = {
  [DISPLAY_STATUSES.IDEA]: "bg-chart-4", // Blue
  [DISPLAY_STATUSES.GENERATED]: "bg-chart-3", // Green
  [DISPLAY_STATUSES.PUBLISHED]: "bg-chart-1", // Purple
} as const;

// Status labels for UI display
export const STATUS_LABELS = {
  [DISPLAY_STATUSES.IDEA]: "Idea",
  [DISPLAY_STATUSES.GENERATED]: "Generated",
  [DISPLAY_STATUSES.PUBLISHED]: "Published",
} as const;

type DisplayStatus = (typeof DISPLAY_STATUSES)[keyof typeof DISPLAY_STATUSES];

// Map database status to user-facing display status
export function getDisplayStatus(dbStatus: ArticleStatus): DisplayStatus {
  switch (dbStatus) {
    case STATUSES.IDEA:
    case STATUSES.SCHEDULED:
    case STATUSES.GENERATING:
    case STATUSES.FAILED:
      return DISPLAY_STATUSES.IDEA;
    
    case STATUSES.WAIT_FOR_PUBLISH:
      return DISPLAY_STATUSES.GENERATED;
    
    case STATUSES.PUBLISHED:
      return DISPLAY_STATUSES.PUBLISHED;
    
    case STATUSES.FAILED:
    default:
      return DISPLAY_STATUSES.IDEA; // Safe fallback
  }
}

// Get status color for UI
export function getStatusColor(dbStatus: ArticleStatus): string {
  const displayStatus = getDisplayStatus(dbStatus);
  return STATUS_COLORS[displayStatus];
}

// Get status label for UI
export function getStatusLabel(dbStatus: ArticleStatus): string {
  const displayStatus = getDisplayStatus(dbStatus);
  return STATUS_LABELS[displayStatus];
}

// Status check helpers
export function isGenerating(dbStatus: ArticleStatus): boolean {
  return dbStatus === STATUSES.GENERATING;
}

export function isReadyToPublish(dbStatus: ArticleStatus): boolean {
  return dbStatus === STATUSES.WAIT_FOR_PUBLISH;
}

export function isPublished(dbStatus: ArticleStatus): boolean {
  return dbStatus === STATUSES.PUBLISHED;
}

export function isFailed(dbStatus: ArticleStatus): boolean {
  return dbStatus === STATUSES.FAILED;
}

export function isIdea(dbStatus: ArticleStatus): boolean {
  const ideaStatuses = [
    STATUSES.IDEA,
    STATUSES.SCHEDULED,
  ] as const;
  return (ideaStatuses as readonly string[]).includes(dbStatus);
}

// Check if status should be shown in UI (all statuses are shown now)
export function shouldShowInUI(_dbStatus: ArticleStatus): boolean {
  return true; // We no longer have soft deletes, so show all statuses
}

// Board event configuration for calendar view
export interface BoardEventConfig {
  kind: string;
  label: string;
  bgColor: string;
  priority: number;
}

export function getBoardEventConfig(dbStatus: ArticleStatus, hasSchedule?: boolean): BoardEventConfig {
  switch (dbStatus) {
    case STATUSES.IDEA:
    case STATUSES.SCHEDULED:
      return {
        kind: "queued",
        label: "Idea",
        bgColor: STATUS_COLORS[DISPLAY_STATUSES.IDEA],
        priority: 1,
      };
      
    case STATUSES.FAILED:
      return {
        kind: "failed",
        label: "Failed",
        bgColor: "bg-destructive/80",
        priority: 1, // High priority so failed articles are visible
      };
      
    case STATUSES.GENERATING:
      return {
        kind: "generating", 
        label: "Generating",
        bgColor: "bg-card",
        priority: 2,
      };
      
    case STATUSES.WAIT_FOR_PUBLISH:
      if (hasSchedule) {
        return {
          kind: "publishScheduled",
          label: "Publish scheduled",
          bgColor: "bg-chart-3", // Yellow for scheduled
          priority: 3,
        };
      } else {
        return {
          kind: "readyToPublish",
          label: "Ready to publish",
          bgColor: STATUS_COLORS[DISPLAY_STATUSES.GENERATED],
          priority: 3,
        };
      }
      
    case STATUSES.PUBLISHED:
      return {
        kind: "published",
        label: "Published", 
        bgColor: STATUS_COLORS[DISPLAY_STATUSES.PUBLISHED],
        priority: 4,
      };
      
    default:
      return {
        kind: "unknown",
        label: "Unknown",
        bgColor: "bg-gray-100",
        priority: 10,
      };
  }
}
