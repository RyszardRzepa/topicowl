"use client";

import { useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";

export function OnboardingChecker({ children }: { children: React.ReactNode }) {
  const { user, isLoaded } = useUser();
  const router = useRouter();

  useEffect(() => {
    const checkOnboardingStatus = async () => {
      if (!isLoaded || !user) return;
      
      try {
        const response = await fetch("/api/onboarding/status");
        if (response.ok) {
          const data = await response.json() as { onboarding_completed: boolean };
          if (!data.onboarding_completed) {
            router.push("/onboarding");
            return;
          }
        }
      } catch (err) {
        console.error("Error checking onboarding status:", err);
      }
    };

    void checkOnboardingStatus();
  }, [isLoaded, user, router]);

  // Don't render children until we've checked onboarding status
  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <>{children}</>;
  }

  return <>{children}</>;
}
