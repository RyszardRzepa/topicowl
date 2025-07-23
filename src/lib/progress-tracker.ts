// Shared progress tracking for article generation
// In production, this should be replaced with Redis or database storage

import type { GenerationStatus } from '@/app/api/articles/[id]/generation-status/route';

// In-memory progress tracking - in production, you'd use Redis or similar
const progressMap = new Map<string, GenerationStatus>();

// Helper function to update progress
export const updateProgress = (
  articleId: string, 
  status: GenerationStatus['status'], 
  progress: number, 
  currentStep?: string
) => {
  progressMap.set(articleId, {
    articleId,
    status,
    progress,
    currentStep,
    startedAt: progressMap.get(articleId)?.startedAt ?? new Date().toISOString(),
    completedAt: status === 'completed' || status === 'failed' ? new Date().toISOString() : undefined,
  });
};

// Helper function to get progress
export const getProgress = (articleId: string): GenerationStatus | undefined => {
  return progressMap.get(articleId);
};

// Helper function to clear progress
export const clearProgress = (articleId: string): void => {
  progressMap.delete(articleId);
};
