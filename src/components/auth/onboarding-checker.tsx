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
  const [onboardingStatus, setOnboardingStatus] = useState<boolean | null>(
    null,
  );
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkOnboardingStatus = async () => {
      console.log("OnboardingChecker: Starting check", { isLoaded, pathname, user: !!user });
      
      // Don't check if user data isn't loaded yet
      if (!isLoaded) {
        console.log("OnboardingChecker: User not loaded yet");
        return;
      }

      // Don't check for public routes
      if (publicRoutes.some((route) => pathname.startsWith(route))) {
        console.log("OnboardingChecker: Public route, skipping check");
        setIsChecking(false);
        return;
      }

      // Don't check if user is not signed in
      if (!user) {
        console.log("OnboardingChecker: No user, skipping check");
        setIsChecking(false);
        return;
      }

      try {
        setIsChecking(true);
        const response = await fetch("/api/onboarding/status");

        if (response.ok) {
          const data = (await response.json()) as OnboardingStatusResponse;

          if (data.success) {
            setOnboardingStatus(data.onboarding_completed);

            // Redirect logic based on onboarding status and current route
            console.log("OnboardingChecker: Onboarding completed:", data.onboarding_completed, "Current path:", pathname);
            
            if (!data.onboarding_completed) {
              // User hasn't completed onboarding
              if (
                !allowedDuringOnboarding.some((route) =>
                  pathname.startsWith(route),
                )
              ) {
                // Redirect to onboarding if trying to access protected routes
                console.log("OnboardingChecker: Redirecting to onboarding");
                router.push("/onboarding");
                return;
              }
            } else {
              // User has completed onboarding
              if (pathname === "/onboarding") {
                // Redirect away from onboarding if already completed
                console.log("OnboardingChecker: Redirecting away from onboarding to dashboard");
                router.push("/dashboard");
                return;
              }
              // Don't redirect if user is already on dashboard routes
            }
          } else {
            // Handle API errors gracefully
            console.error("Error checking onboarding status:", data.error);

            // If error indicates user record creation is pending, assume not onboarded
            if (data.error?.includes("pending")) {
              setOnboardingStatus(false);

              // Redirect to onboarding if not already there
              if (
                !allowedDuringOnboarding.some((route) =>
                  pathname.startsWith(route),
                )
              ) {
                router.push("/onboarding");
                return;
              }
            } else {
              // For other errors, assume onboarding is not completed but allow access
              setOnboardingStatus(false);
            }
          }
        } else if (response.status === 404) {
          // User not found in database - assume not onboarded and redirect to onboarding
          console.warn("User not found in database, redirecting to onboarding");
          setOnboardingStatus(false);

          if (
            !allowedDuringOnboarding.some((route) => pathname.startsWith(route))
          ) {
            router.push("/onboarding");
            return;
          }
        } else {
          console.error("Failed to check onboarding status:", response.status);
          // For server errors, be permissive and allow access
          setOnboardingStatus(false);
        }
      } catch (err) {
        console.error("Error checking onboarding status:", err);
        // For network errors, be permissive and allow access
        setOnboardingStatus(false);
      } finally {
        setIsChecking(false);
      }
    };

    void checkOnboardingStatus();
  }, [isLoaded, user, router, pathname]);

  // Show loading state while checking authentication or onboarding status
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
  if (onboardingStatus === null && isChecking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  return <>{children}</>;
}
