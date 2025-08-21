"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter, usePathname } from "next/navigation";

interface OnboardingCheckerProps {
  children: React.ReactNode;
}

interface OnboardingStatusResponse {
  success: boolean;
  onboarding_completed: boolean;
  user?: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
  };
  error?: string;
}

// Routes that should be accessible during onboarding
const allowedDuringOnboarding = ["/onboarding", "/sign-in", "/sign-up", "/api"];

// Routes that don't require onboarding check (public routes)
const publicRoutes = ["/sign-in", "/sign-up"];

export function OnboardingChecker({ children }: OnboardingCheckerProps) {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const [onboardingCompleted, setOnboardingCompleted] = useState<
    boolean | null
  >(null);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkOnboardingStatus = async () => {
      // Don't check if user data isn't loaded yet
      if (!isLoaded) {
        return;
      }

      // Don't check for public routes
      if (publicRoutes.some((route) => pathname.startsWith(route))) {
        setIsChecking(false);
        return;
      }

      // Don't check if user is not signed in
      if (!user) {
        setIsChecking(false);
        return;
      }

      try {
        setIsChecking(true);

        const response = await fetch("/api/onboarding/status");

        if (response.ok) {
          const data = (await response.json()) as OnboardingStatusResponse;

          if (data.success) {
            const completed = data.onboarding_completed;
            setOnboardingCompleted(completed);

            // Handle redirects
            if (!completed) {
              // User hasn't completed onboarding
              if (
                !allowedDuringOnboarding.some((route) =>
                  pathname.startsWith(route),
                )
              ) {
                router.push("/onboarding");
              }
            } else {
              // User has completed onboarding
              if (pathname === "/onboarding") {
                router.push("/dashboard");
              }
            }
          } else {
            // API error - assume not onboarded for safety
            setOnboardingCompleted(false);
            if (
              !allowedDuringOnboarding.some((route) =>
                pathname.startsWith(route),
              )
            ) {
              router.push("/onboarding");
            }
          }
        } else {
          // HTTP error - assume not onboarded for safety
          setOnboardingCompleted(false);
          if (
            !allowedDuringOnboarding.some((route) => pathname.startsWith(route))
          ) {
            router.push("/onboarding");
          }
        }
      } catch (error) {
        console.error("Error checking onboarding status:", error);
        // Network error - assume not onboarded for safety
        setOnboardingCompleted(false);
        if (
          !allowedDuringOnboarding.some((route) => pathname.startsWith(route))
        ) {
          router.push("/onboarding");
        }
      } finally {
        setIsChecking(false);
      }
    };

    void checkOnboardingStatus();
  }, [isLoaded, user, router, pathname]);

  // Show loading state while checking
  if (!isLoaded || (user && isChecking)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  // For public routes or when user is not signed in, render children normally
  if (!user || publicRoutes.some((route) => pathname.startsWith(route))) {
    return <>{children}</>;
  }

  // For signed-in users, only render children after onboarding status is determined
  if (onboardingCompleted === null && isChecking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  return <>{children}</>;
}
