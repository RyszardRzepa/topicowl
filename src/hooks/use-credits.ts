"use client";

import { useEffect, useState, useCallback } from "react";
import { isSessionInitialized, getSessionData, setSessionData } from "@/constants";
import type { CreditSession } from "@/types";
import { SESSION_KEYS } from "@/types";

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
          throw new Error("Server error occurred while fetching credits. Please try again.");
        } else if (response.status === 401) {
          throw new Error("Authentication required. Please sign in again.");
        } else {
          throw new Error("Failed to fetch credits");
        }
      }
      
      const data = await response.json() as { credits: number };
      
      if (typeof data.credits !== 'number') {
        throw new Error("Invalid response from server");
      }
      
      setCredits(data.credits);
      
      // Store credits in session storage
      const creditSession: CreditSession = {
        credits: data.credits,
        lastFetch: Date.now(),
        sessionId: '' // This will be set by setSessionData
      };
      setSessionData(SESSION_KEYS.CREDITS_INITIALIZED, creditSession);
    } catch (err) {
      console.error("Error fetching credits:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to load credits";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Check if credits have already been fetched in this session
    const sessionInitialized = isSessionInitialized(SESSION_KEYS.CREDITS_INITIALIZED);
    if (sessionInitialized) {
      const cachedCredits = getSessionData<CreditSession>(SESSION_KEYS.CREDITS_INITIALIZED);
      if (cachedCredits && typeof cachedCredits === 'object' && 'credits' in cachedCredits && cachedCredits.credits !== null) {
        setCredits(cachedCredits.credits);
        setLoading(false);
        return;
      }
    }
    
    // Only fetch if not already fetched in this session
    void fetchCredits();
  }, [fetchCredits]);

  return {
    credits,
    loading,
    error,
    refreshCredits: fetchCredits,
  };
}