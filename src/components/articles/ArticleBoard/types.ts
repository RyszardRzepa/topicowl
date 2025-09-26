import type { Article } from "@/types";
import type { BoardEventConfig } from "@/lib/article-status";

export type QueueItem = {
  id: number;
  articleId: number;
  title: string;
  addedToQueueAt: string;
  scheduledForDate: string;
  queuePosition: number;
  schedulingType: "manual" | "automatic";
  status: "queued" | "processing" | "completed" | "failed";
  attempts: number;
  errorMessage?: string;
};

export interface ArticleIdea {
  title: string;
  description: string;
  keywords: string[];
  targetAudience?: string;
  contentAngle: string;
  estimatedDifficulty: "beginner" | "intermediate" | "advanced";
}

export interface GenerationStatusResponse {
  progress?: number;
  status?: string;
}

export type OperationType = "generate" | "edit" | "delete" | "publish";

export type ArticleEvent = {
  id: string;
  dateIso: string;
  title: string;
  article: Article;
  eventConfig?: BoardEventConfig;
};

export interface CreateFormState {
  title: string;
  keywords: string;
  notes: string;
}

export interface EditFormState {
  title: string;
  keywords: string;
  notes: string;
  scheduledAt: Date | null;
}

export interface ScheduleSelection {
  date: Date;
  hour: number;
  minute: number;
}
