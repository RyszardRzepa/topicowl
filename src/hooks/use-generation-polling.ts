"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import type { GenerationStatus } from "@/app/api/articles/[id]/generation-status/route";
import type { ApiResponse } from "@/types";

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
  intervalMs = 5000,
  onStatusUpdate,
  onComplete,
  onError,
}: UseGenerationPollingOptions): UseGenerationPollingReturn {
  // state
  const [status, setStatus] = useState<GenerationStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // refs
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const live = useRef(true);

  // keep latest callbacks without re-subscribing
  const useLatest = <T>(value: T) => {
    const ref = useRef(value);
    useEffect(() => {
      ref.current = value;
    }, [value]);
    return ref;
  };
  const statusCb = useLatest(onStatusUpdate);
  const completeCb = useLatest(onComplete);
  const errorCb = useLatest(onError);

  const clearAll = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  }, []);

  const fetchStatus = useCallback(async () => {
    if (!live.current || !articleId) return;
    try {
      setIsLoading(true);
      setError(null);
      if (abortRef.current) abortRef.current.abort();
      abortRef.current = new AbortController();
      const res = await fetch(`/api/articles/${articleId}/generation-status`, {
        signal: abortRef.current.signal,
        headers: { "Cache-Control": "no-cache" },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result = (await res.json()) as ApiResponse & GenerationStatus;
      if (!live.current) return;
      if (!result.success) {
        setStatus(null);
        if (result.error) errorCb.current?.(result.error);
        clearAll();
        return;
      }
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
        currentPhase: (result).currentPhase,
        seoScore: (result).seoScore,
        seoIssues: (result).seoIssues,
      };
      setStatus(newStatus);
      statusCb.current?.(newStatus);
      if (newStatus.status === "completed") {
        completeCb.current?.();
        clearAll();
      } else if (newStatus.status === "failed") {
        errorCb.current?.(newStatus.error ?? "Generation failed");
        clearAll();
      }
    } catch (e) {
      if (!live.current) return;
      if (e instanceof Error && e.name === "AbortError") return; // ignore aborts
      const msg = e instanceof Error ? e.message : "Unknown error";
      setError(msg);
      errorCb.current?.(msg);
      clearAll();
    } finally {
      if (live.current) setIsLoading(false);
    }
  }, [articleId, clearAll, statusCb, completeCb, errorCb]);

  // manage polling
  useEffect(() => {
    clearAll();
    if (!enabled || !articleId) return; // nothing to do
    void fetchStatus(); // immediate first check
    timerRef.current = setInterval(() => {
      void fetchStatus();
    }, intervalMs);
    return clearAll;
  }, [enabled, articleId, intervalMs, fetchStatus, clearAll]);

  // unmount safeguard
  useEffect(
    () => () => {
      live.current = false;
      clearAll();
    },
    [clearAll],
  );

  return { status, isLoading, error };
}
