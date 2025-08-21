"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useProject } from "@/contexts/project-context";
import type { ApiResponse } from "@/types";

interface UseProjectDataOptions {
  endpoint: (projectId: number) => string;
  enabled?: boolean;
  refetchOnProjectChange?: boolean;
}

interface UseProjectDataResult<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useProjectData<T>(
  options: UseProjectDataOptions,
): UseProjectDataResult<T> {
  const { currentProject, onProjectChange } = useProject();
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const currentProjectIdRef = useRef<number | null>(null);
  const hasDataRef = useRef(false);

  const { endpoint, enabled = true, refetchOnProjectChange = true } = options;

  const fetchData = useCallback(
    async (projectId: number) => {
      if (!enabled) return;

      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(endpoint(projectId));

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = (await response.json()) as ApiResponse<T>;

        if (!result.success) {
          throw new Error(result.error ?? "API request failed");
        }

        setData(result.data ?? null);
        hasDataRef.current = true;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to fetch data";
        console.error("Error fetching project data:", err);
        setError(errorMessage);
        setData(null);
      } finally {
        setIsLoading(false);
      }
    },
    [endpoint, enabled],
  );

  const refetch = useCallback(async () => {
    if (currentProject?.id) {
      await fetchData(currentProject.id);
    }
  }, [currentProject?.id, fetchData]);

  // Initial load when project is available
  useEffect(() => {
    if (currentProject?.id && enabled) {
      void fetchData(currentProject.id);
      currentProjectIdRef.current = currentProject.id;
    }
  }, [currentProject?.id, enabled, fetchData]);

  // Listen for project changes
  useEffect(() => {
    if (!refetchOnProjectChange) return;

    const unsubscribe = onProjectChange((project) => {
      const newProjectId = project?.id ?? null;

      // Only refetch if project actually changed and we have data
      if (
        newProjectId !== currentProjectIdRef.current &&
        newProjectId &&
        enabled
      ) {
        void fetchData(newProjectId);
        currentProjectIdRef.current = newProjectId;
      } else if (!newProjectId) {
        // Clear data when no project selected
        setData(null);
        setError(null);
        currentProjectIdRef.current = null;
        hasDataRef.current = false;
      }
    });

    return unsubscribe;
  }, [onProjectChange, refetchOnProjectChange, enabled, fetchData]);

  return {
    data,
    isLoading,
    error,
    refetch,
  };
}
