"use client";

import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";
import { useEffect } from "react";

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Do not initialize PostHog in development
    if (process.env.NODE_ENV !== "production") return;

    if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;

    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
      api_host: "https://eu.posthog.com",
      ui_host: "https://eu.posthog.com",
      defaults: "2025-05-24",
      capture_exceptions: true,
      debug: false,
    });
  }, []);

  return <PHProvider client={posthog}>{children}</PHProvider>;
}
