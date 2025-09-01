"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useProject } from "@/contexts/project-context";
import type { DashboardStatsResponse, DashboardState } from "@/types";

interface UseDashboardStatsReturn {
  data: DashboardStatsResponse | null;
  loading: boolean;
  error: string | null;
  refreshStats: () => Promise<void>;
  retryCount: number;
  // Convenience getters for common checks
  isRedditConnected: boolean;
  hasArticleData: boolean;
}

export function useDashboardStats(): UseDashboardStatsReturn {
  const { currentProject, onProjectChange } = useProject();
  const [data, setData] = useState<DashboardStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const currentProjectIdRef = useRef<number | null>(null);
  const maxRetries = 3;

  const fetchDashboardStats = useCallback(async (projectId: number, attempt = 0) => {
    try {
      setLoading(true);
      if (attempt === 0) {
        setError(null);
        setRetryCount(0);
      }

      const response = await fetch(
        `/api/dashboard/stats?projectId=${projectId}`,
        {
          // Add timeout to prevent hanging requests
          signal: AbortSignal.timeout(30000), // 30 second timeout
        }
      );

      if (!response.ok) {
        if (response.status >= 500 && attempt < maxRetries) {
          // Retry on server errors with exponential backoff
          const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
          setTimeout(() => {
            setRetryCount(attempt + 1);
            void fetchDashboardStats(projectId, attempt + 1);
          }, delay);
          return;
        } else if (response.status >= 500) {
          throw new Error(
            "Server error occurred while fetching dashboard statistics. Please try again.",
          );
        } else if (response.status === 401) {
          throw new Error("Authentication required. Please sign in again.");
        } else if (response.status === 404) {
          throw new Error("Project not found or access denied.");
        } else if (response.status === 400) {
          throw new Error("Invalid project ID. Please select a valid project.");
        } else {
          throw new Error(`Failed to fetch dashboard statistics (${response.status})`);
        }
      }

      const dashboardData = (await response.json()) as DashboardStatsResponse;

      // Validate response structure - be more lenient to handle partial data
      if (!dashboardData || typeof dashboardData !== 'object') {
        throw new Error("Invalid response format from server");
      }

      // Validate articles data exists
      if (!dashboardData.articles || typeof dashboardData.articles !== 'object') {
        throw new Error("Article data is missing from server response");
      }

      // Validate reddit structure exists (but data can be null)
      if (!dashboardData.reddit || typeof dashboardData.reddit !== 'object') {
        throw new Error("Reddit connection data is missing from server response");
      }

      setData(dashboardData);
      setError(null); // Clear any previous errors on successful fetch
      setRetryCount(0); // Reset retry count on success
    } catch (err) {
      console.error("Error fetching dashboard stats:", err);
      
      let errorMessage = "Failed to load dashboard statistics";
      if (err instanceof Error) {
        if (err.name === 'TimeoutError') {
          errorMessage = "Request timed out. Please check your connection and try again.";
        } else if (err.name === 'AbortError') {
          errorMessage = "Request was cancelled. Please try again.";
        } else {
          errorMessage = err.message;
        }
      }
      
      setError(errorMessage);
      
      // Don't clear existing data on error to allow partial functionality
      // Only clear data on authentication or critical errors
      if (errorMessage.includes("Authentication required") || 
          errorMessage.includes("Project not found")) {
        setData(null);
      }
    } finally {
      setLoading(false);
    }
  }, [maxRetries]);

  const refreshStats = useCallback(async () => {
    if (currentProject?.id) {
      await fetchDashboardStats(currentProject.id);
    }
  }, [currentProject?.id, fetchDashboardStats]);

  // Initial load when project is available
  useEffect(() => {
    if (currentProject?.id) {
      void fetchDashboardStats(currentProject.id);
      currentProjectIdRef.current = currentProject.id;
    }
  }, [currentProject?.id, fetchDashboardStats]);

  // Listen for project changes and refetch data
  useEffect(() => {
    const unsubscribe = onProjectChange((project) => {
      const newProjectId = project?.id ?? null;

      // Only refetch if project actually changed
      if (newProjectId !== currentProjectIdRef.current) {
        if (newProjectId) {
          void fetchDashboardStats(newProjectId);
          currentProjectIdRef.current = newProjectId;
        } else {
          // Clear data when no project selected
          setData(null);
          setError(null);
          setLoading(false);
          currentProjectIdRef.current = null;
        }
      }
    });

    return unsubscribe;
  }, [onProjectChange, fetchDashboardStats]);

  return {
    data,
    loading,
    error,
    refreshStats,
    retryCount,
    // Convenience getters for common checks
    isRedditConnected: data?.reddit.connected ?? false,
    hasArticleData: data?.articles !== undefined,
  };
}