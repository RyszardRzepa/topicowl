"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useProject } from "@/contexts/project-context";
import { Button } from "@/components/ui/button";

interface ProjectRequiredCheckerProps {
  children: React.ReactNode;
}

// Enhanced logging for debugging redirect issues
const logProjectChecker = (message: string, data?: Record<string, unknown>) => {
  const timestamp = new Date().toISOString();
  console.log(`[ProjectRequiredChecker ${timestamp}] ${message}`, data ?? '');
};

export function ProjectRequiredChecker({ children }: ProjectRequiredCheckerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { projects, isLoading, currentProject, error, clearError, retryLoad } = useProject();
  const [hasAttemptedRedirect, setHasAttemptedRedirect] = useState(false);
  const [recoveryAttempts, setRecoveryAttempts] = useState(0);
  const [isRecovering, setIsRecovering] = useState(false);
  const recoveryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mountTimeRef = useRef<number>(Date.now());

  // Allow access to project creation page without project requirement
  const isProjectCreationPage = pathname === "/dashboard/projects/new";

  // Cleanup recovery timeout on unmount
  useEffect(() => {
    return () => {
      if (recoveryTimeoutRef.current) {
        clearTimeout(recoveryTimeoutRef.current);
      }
    };
  }, []);

  // Enhanced recovery mechanism with exponential backoff
  const attemptRecovery = () => {
    if (isRecovering || recoveryAttempts >= 3) {
      logProjectChecker("Recovery skipped", { 
        isRecovering, 
        recoveryAttempts, 
        reason: isRecovering ? "already recovering" : "max attempts reached" 
      });
      return;
    }

    setIsRecovering(true);
    const attempt = recoveryAttempts + 1;
    setRecoveryAttempts(attempt);
    
    // Exponential backoff: 1s, 2s, 4s
    const recoveryDelay = Math.min(1000 * Math.pow(2, attempt - 1), 4000);
    
    logProjectChecker("Starting recovery attempt", { 
      attempt, 
      delay: recoveryDelay,
      projectsCount: projects.length,
      hasCurrentProject: !!currentProject
    });

    recoveryTimeoutRef.current = setTimeout(() => {
      logProjectChecker("Recovery timeout triggered", {
        attempt,
        projectsCount: projects.length,
        currentProject: currentProject?.id,
        timeSinceMount: Date.now() - mountTimeRef.current
      });

      // Check if recovery was successful
      if (currentProject) {
        logProjectChecker("Recovery successful", { 
          projectId: currentProject.id,
          projectName: currentProject.name 
        });
        setIsRecovering(false);
        return;
      }

      // If we still have projects but no current project after recovery attempts
      if (projects.length > 0 && !currentProject && attempt >= 3) {
        logProjectChecker("Recovery failed after max attempts, redirecting", {
          projectsCount: projects.length,
          attempts: attempt
        });
        setHasAttemptedRedirect(true);
        router.push("/dashboard/projects/new");
      }
      
      setIsRecovering(false);
    }, recoveryDelay);
  };

  useEffect(() => {
    const timeSinceMount = Date.now() - mountTimeRef.current;
    
    logProjectChecker("Effect triggered", {
      isLoading,
      projectsCount: projects.length,
      currentProject: currentProject?.id,
      hasError: !!error,
      isProjectCreationPage,
      hasAttemptedRedirect,
      isRecovering,
      recoveryAttempts,
      timeSinceMount
    });

    // Don't redirect if we're already on the project creation page
    if (isProjectCreationPage) {
      logProjectChecker("On project creation page, allowing access");
      return;
    }
    
    // Wait for projects to load - don't redirect immediately
    if (isLoading) {
      logProjectChecker("Still loading projects, waiting...");
      return;
    }

    // If there's an error, don't redirect - let user handle it
    if (error) {
      logProjectChecker("Error loading projects, not redirecting", { error });
      return;
    }

    // Only redirect if we have definitively no projects and haven't already attempted redirect
    if (projects.length === 0 && !hasAttemptedRedirect) {
      logProjectChecker("No projects found, redirecting to create project");
      setHasAttemptedRedirect(true);
      router.push("/dashboard/projects/new");
      return;
    }

    // If projects exist but no current project is selected, try to recover
    if (projects.length > 0 && !currentProject && !hasAttemptedRedirect && !isRecovering) {
      logProjectChecker("Projects exist but no current project selected, attempting recovery");
      attemptRecovery();
      return;
    }

    // Reset recovery state when we have a current project
    if (currentProject && (isRecovering || recoveryAttempts > 0)) {
      logProjectChecker("Current project restored, resetting recovery state", {
        projectId: currentProject.id,
        projectName: currentProject.name
      });
      setIsRecovering(false);
      setRecoveryAttempts(0);
      if (recoveryTimeoutRef.current) {
        clearTimeout(recoveryTimeoutRef.current);
        recoveryTimeoutRef.current = null;
      }
    }

    if (currentProject) {
      logProjectChecker("All good, current project set", { 
        projectId: currentProject.id,
        projectName: currentProject.name 
      });
    }
  }, [projects, isLoading, currentProject, error, router, isProjectCreationPage, hasAttemptedRedirect, isRecovering, recoveryAttempts]);

  // Always allow access to project creation page
  if (isProjectCreationPage) {
    return <>{children}</>;
  }

  // Show loading state while checking projects
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">Loading projects...</div>
      </div>
    );
  }

  // Show error state with retry option
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <div className="text-red-600 text-center max-w-md">
          <h2 className="text-lg font-semibold mb-2">Failed to load projects</h2>
          <p className="text-sm">{error}</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => void retryLoad()} variant="outline">
            Retry
          </Button>
          <Button onClick={clearError} variant="ghost">
            Dismiss
          </Button>
        </div>
      </div>
    );
  }

  // Show loading state while redirecting (only if we have no projects)
  if (projects.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">Setting up your workspace...</div>
      </div>
    );
  }

  // Show enhanced loading state if projects exist but no current project (recovery in progress)
  if (!currentProject) {
    const timeSinceMount = Date.now() - mountTimeRef.current;
    const showRecoveryInfo = timeSinceMount > 2000; // Show recovery info after 2 seconds
    
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <div className="text-gray-600">
          {isRecovering ? "Recovering project context..." : "Preparing your project..."}
        </div>
        {showRecoveryInfo && (
          <div className="text-sm text-gray-500 text-center max-w-md">
            <p>This is taking longer than expected.</p>
            {recoveryAttempts > 0 && (
              <p>Recovery attempt {recoveryAttempts} of 3</p>
            )}
          </div>
        )}
        {showRecoveryInfo && (
          <Button 
            onClick={() => {
              logProjectChecker("Manual retry triggered by user");
              void retryLoad();
            }} 
            variant="outline" 
            size="sm"
          >
            Retry Loading
          </Button>
        )}
      </div>
    );
  }

  // Projects exist and one is selected, render children
  return <>{children}</>;
}
