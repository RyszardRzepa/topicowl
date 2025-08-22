"use client";

import { useEffect, useState, useCallback } from "react";

interface UseCreditsReturn {
  credits: number | null;
  loading: boolean;
  error: string | null;
  refreshCredits: () => Promise<void>;
}

export function useCredits(): UseCreditsReturn {
  const [credits, setCredits] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCredits = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch("/api/credits");

      if (!response.ok) {
        if (response.status >= 500) {
          throw new Error(
            "Server error occurred while fetching credits. Please try again.",
          );
        } else if (response.status === 401) {
          throw new Error("Authentication required. Please sign in again.");
        } else {
          throw new Error("Failed to fetch credits");
        }
      }

      const data = (await response.json()) as { credits: number };

      if (typeof data.credits !== "number") {
        throw new Error("Invalid response from server");
      }

      setCredits(data.credits);
    } catch (err) {
      console.error("Error fetching credits:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Failed to load credits";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Always fetch credits fresh from the database, no caching
    void fetchCredits();
  }, [fetchCredits]);

  return {
    credits,
    loading,
    error,
    refreshCredits: fetchCredits,
  };
}
