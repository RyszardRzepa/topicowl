"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useProject } from "@/contexts/project-context";
import { Button } from "@/components/ui/button";

interface ProjectRequiredCheckerProps {
  children: React.ReactNode;
}

export function ProjectRequiredChecker({ children }: ProjectRequiredCheckerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { projects, isLoading, error, refreshProjects } = useProject();

  // Allow access to project creation page without project requirement
  const isProjectCreationPage = pathname === "/dashboard/projects/new";

  useEffect(() => {
    // Don't redirect if on project creation page or still loading
    if (isProjectCreationPage || isLoading) {
      return;
    }

    // Only redirect if definitively no projects exist
    if (!isLoading && projects.length === 0 && !error) {
      router.push("/dashboard/projects/new");
    }
  }, [projects.length, isLoading, error, router, isProjectCreationPage]);

  // Always allow access to project creation page
  if (isProjectCreationPage) {
    return <>{children}</>;
  }

  // Show loading state only on initial load
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
        <Button onClick={() => void refreshProjects()} variant="outline">
          Retry
        </Button>
      </div>
    );
  }

  // Redirect is happening, show loading
  if (projects.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">Setting up your workspace...</div>
      </div>
    );
  }

  // Projects exist, render children
  return <>{children}</>;
}
