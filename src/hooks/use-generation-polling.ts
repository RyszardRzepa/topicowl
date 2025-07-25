'use client';

import { useEffect, useRef } from 'react';

interface GenerationStatusData {
  progress?: number;
  phase?: 'research' | 'writing' | 'validation' | 'optimization';
  error?: string;
  status: 'generating' | 'completed' | 'failed';
  estimatedCompletion?: string;
}

interface GenerationStatusResponse {
  success: boolean;
  progress?: number;
  phase?: 'research' | 'writing' | 'validation' | 'optimization';
  error?: string;
  status?: 'generating' | 'completed' | 'failed';
  estimatedCompletion?: string;
}

interface UseGenerationPollingOptions {
  articleId: string;
  enabled: boolean;
  intervalMs?: number;
  onStatusUpdate: (data: GenerationStatusData) => void;
  onComplete: () => void;
  onError: (error: string) => void;
}

export function useGenerationPolling({
  articleId,
  enabled,
  intervalMs = 5000, // 5 seconds
  onStatusUpdate,
  onComplete,
  onError
}: UseGenerationPollingOptions) {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const checkGenerationStatus = async () => {
    try {
      // Abort previous request if still pending
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();
      
      const response = await fetch(`/api/articles/${articleId}/generation-status`, {
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json() as GenerationStatusResponse;
      
      if (!data.success) {
        throw new Error(data.error ?? 'Failed to fetch generation status');
      }

      const statusData: GenerationStatusData = {
        progress: data.progress,
        phase: data.phase,
        error: data.error,
        status: data.status ?? 'generating',
        estimatedCompletion: data.estimatedCompletion,
      };

      onStatusUpdate(statusData);

      // Stop polling if generation is complete or failed
      if (data.status === 'completed') {
        onComplete();
        stopPolling();
      } else if (data.status === 'failed') {
        onError(data.error ?? 'Generation failed');
        stopPolling();
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        // Request was aborted, ignore
        return;
      }
      
      console.error('Error checking generation status:', error);
      onError(error instanceof Error ? error.message : 'Unknown error occurred');
      stopPolling();
    }
  };

  const startPolling = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    
    // Check immediately, then set up interval
    void checkGenerationStatus();
    
    intervalRef.current = setInterval(() => {
      void checkGenerationStatus();
    }, intervalMs);
  };

  const stopPolling = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  };

  useEffect(() => {
    if (enabled) {
      startPolling();
    } else {
      stopPolling();
    }

    return () => {
      stopPolling();
    };
  }, [enabled, articleId, intervalMs]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, []);

  return {
    startPolling,
    stopPolling,
  };
}
