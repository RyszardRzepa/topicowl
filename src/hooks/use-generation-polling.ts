'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import type { GenerationStatus } from '@/app/api/articles/[id]/generation-status/route';
import type { ApiResponse } from '@/types';

interface UseGenerationPollingOptions {
  articleId: string;
  enabled: boolean;
  intervalMs?: number;
  onStatusUpdate?: (data: GenerationStatus) => void;
  onComplete?: () => void;
  onError?: (error: string) => void;
}

interface UseGenerationPollingReturn {
  status: GenerationStatus | null;
  isLoading: boolean;
  error: string | null;
}

export function useGenerationPolling({
  articleId,
  enabled,
  intervalMs = 5000, // 5 seconds - consistent with other polling
  onStatusUpdate,
  onComplete,
  onError
}: UseGenerationPollingOptions): UseGenerationPollingReturn {
  const [status, setStatus] = useState<GenerationStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  const cleanupPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  const checkGenerationStatus = useCallback(async () => {
    if (!mountedRef.current) return;

    try {
      setIsLoading(true);
      setError(null);

      // Abort previous request if still pending
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();
      
      const response = await fetch(`/api/articles/${articleId}/generation-status`, {
        signal: abortControllerRef.current.signal,
        headers: {
          'Cache-Control': 'no-cache',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json() as ApiResponse & GenerationStatus;
      
      if (!mountedRef.current) return;

      if (result.success) {
        // The API returns status fields directly in the response, not nested under data
        const newStatus: GenerationStatus = {
          articleId: result.articleId,
          status: result.status,
          progress: result.progress,
          currentStep: result.currentStep,
          phase: result.phase,
          error: result.error,
          estimatedCompletion: result.estimatedCompletion,
          startedAt: result.startedAt,
          completedAt: result.completedAt,
        };
        
        setStatus(newStatus);
        onStatusUpdate?.(newStatus);

        // Stop polling if generation is complete or failed
        if (newStatus.status === 'completed') {
          onComplete?.();
          cleanupPolling();
        } else if (newStatus.status === 'failed') {
          onError?.(newStatus.error ?? 'Generation failed');
          cleanupPolling();
        }
      } else {
        // No generation in progress or error
        setStatus(null);
        if (result.error) {
          onError?.(result.error);
        }
        cleanupPolling();
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        // Request was aborted, ignore
        return;
      }
      
      if (!mountedRef.current) return;
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setError(errorMessage);
      onError?.(errorMessage);
      cleanupPolling();
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [articleId, onStatusUpdate, onComplete, onError, cleanupPolling]);

  const startPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    
    // Check immediately, then set up interval
    void checkGenerationStatus();
    
    intervalRef.current = setInterval(() => {
      void checkGenerationStatus();
    }, intervalMs);
  }, [checkGenerationStatus, intervalMs]);

  const stopPolling = useCallback(() => {
    cleanupPolling();
  }, [cleanupPolling]);

  useEffect(() => {
    if (enabled) {
      startPolling();
    } else {
      stopPolling();
    }

    return () => {
      stopPolling();
    };
  }, [enabled, articleId, intervalMs, startPolling, stopPolling]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      stopPolling();
    };
  }, [stopPolling]);

  return {
    status,
    isLoading,
    error,
  };
}
