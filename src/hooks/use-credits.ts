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
        throw new Error("Failed to fetch credits");
      }
      
      const data = await response.json();
      setCredits(data.credits);
    } catch (err) {
      console.error("Error fetching credits:", err);
      setError("Failed to load credits");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCredits();
  }, [fetchCredits]);

  return {
    credits,
    loading,
    error,
    refreshCredits: fetchCredits,
  };
}