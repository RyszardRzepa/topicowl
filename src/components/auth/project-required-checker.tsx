"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useProject } from "@/contexts/project-context";

interface ProjectRequiredCheckerProps {
  children: React.ReactNode;
}

export function ProjectRequiredChecker({ children }: ProjectRequiredCheckerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { projects, isLoading, currentProject } = useProject();



  // Allow access to project creation page without project requirement
  const isProjectCreationPage = pathname === "/dashboard/projects/new";

  useEffect(() => {
    // Don't redirect if we're already on the project creation page
    if (isProjectCreationPage) return;
    
    // Wait for projects to load
    if (isLoading) {
      console.log("ProjectRequiredChecker: Still loading projects...");
      return;
    }

    console.log("ProjectRequiredChecker: Projects loaded", { 
      projectsCount: projects.length, 
      currentProject: currentProject?.id,
      currentProjectName: currentProject?.name 
    });

    // If no projects exist, redirect to project creation
    if (projects.length === 0) {
      console.log("ProjectRequiredChecker: No projects found, redirecting to create project");
      router.push("/dashboard/projects/new");
      return;
    }

    // If projects exist but no current project is selected, redirect to project creation
    // This handles edge cases where project data might be inconsistent
    if (!currentProject) {
      console.log("ProjectRequiredChecker: Projects exist but no current project selected, redirecting to create project");
      router.push("/dashboard/projects/new");
      return;
    }

    console.log("ProjectRequiredChecker: All good, current project:", currentProject.name);
  }, [projects, isLoading, currentProject, router, isProjectCreationPage]);

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

  // Show loading state while redirecting
  if (projects.length === 0 || !currentProject) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">Setting up your workspace...</div>
      </div>
    );
  }

  // Projects exist and one is selected, render children
  return <>{children}</>;
}
