'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { GenerationStatus } from '@/app/api/articles/[id]/generation-status/route';
import type { ApiResponse } from '@/types';

interface UseGenerationStatusOptions {
  articleId: string;
  enabled?: boolean;
  interval?: number; // polling interval in milliseconds
  onStatusChange?: (status: GenerationStatus) => void;
  onComplete?: (status: GenerationStatus) => void;
  onError?: (error: string) => void;
}

interface UseGenerationStatusReturn {
  status: GenerationStatus | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useGenerationStatus({
  articleId,
  enabled = true,
  interval = 2000, // Poll every 2 seconds
  onStatusChange,
  onComplete,
  onError,
}: UseGenerationStatusOptions): UseGenerationStatusReturn {
  const [status, setStatus] = useState<GenerationStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  const fetchStatus = useCallback(async () => {
    if (!enabled || !mountedRef.current) return;

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`/api/articles/${articleId}/generation-status`);
      const result = await response.json() as ApiResponse<GenerationStatus>;

      if (!mountedRef.current) return;

      if (result.success && result.data) {
        const newStatus = result.data;
        setStatus(newStatus);
        onStatusChange?.(newStatus);

        // Check if generation is complete
        if (newStatus.status === 'completed' || newStatus.status === 'failed') {
          onComplete?.(newStatus);
          // Stop polling when complete
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
        }
      } else {
        // No generation in progress or error
        setStatus(null);
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }
    } catch (err) {
      if (!mountedRef.current) return;
      
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch generation status';
      setError(errorMessage);
      onError?.(errorMessage);
      
      // Stop polling on error
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [articleId, enabled, onStatusChange, onComplete, onError]);

  // Start/stop polling based on enabled state
  useEffect(() => {
    if (!enabled) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Initial fetch
    void fetchStatus();

    // Start polling
    intervalRef.current = setInterval(() => {
      void fetchStatus();
    }, interval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, interval, fetchStatus]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  return {
    status,
    isLoading,
    error,
    refetch: fetchStatus,
  };
}