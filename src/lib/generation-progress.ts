// Shared progress tracking for article generation
// In production, this should be replaced with Redis or database storage

export interface GenerationStatus {
  articleId: string;
  status: 'pending' | 'researching' | 'writing' | 'validating' | 'updating' | 'optimizing' | 'completed' | 'failed';
  progress: number; // 0-100
  phase?: 'research' | 'writing' | 'validation' | 'optimization';
  phaseProgress?: number; // Progress within current phase (0-100)
  estimatedCompletion?: string; // "3 min remaining"
  currentStep?: string;
  error?: string;
  startedAt?: string;
  completedAt?: string;
}

// In-memory progress tracking - shared across endpoints
const progressMap = new Map<string, GenerationStatus>();

// Helper function to update progress
export const updateProgress = (
  articleId: string, 
  status: GenerationStatus['status'], 
  progress: number, 
  phase?: GenerationStatus['phase'],
  currentStep?: string,
  error?: string
) => {
  const existing = progressMap.get(articleId);
  progressMap.set(articleId, {
    articleId,
    status,
    progress,
    phase,
    currentStep,
    error,
    startedAt: existing?.startedAt ?? new Date().toISOString(),
    completedAt: status === 'completed' || status === 'failed' ? new Date().toISOString() : existing?.completedAt,
  });
};

// Helper function to get progress
export const getProgress = (articleId: string): GenerationStatus | undefined => {
  return progressMap.get(articleId);
};

// Helper function to clear progress (when generation is complete)
export const clearProgress = (articleId: string): void => {
  progressMap.delete(articleId);
};
