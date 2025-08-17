"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { useUser } from "@clerk/nextjs";
import type { Project, ApiResponse } from "@/types";
import { toast } from "sonner";

interface ProjectContextValue {
  projects: Project[];
  currentProject: Project | null;
  isLoading: boolean;
  error: string | null;
  switchProject: (projectId: number) => Promise<void>;
  refreshProjects: () => Promise<void>;
  addProject: (project: Project) => void;
  removeProject: (projectId: number) => void;
  updateProject: (project: Project) => void;
  clearError: () => void;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

const PROJECT_STORAGE_KEY = "contentbot-current-project-id";

interface ProjectProviderProps {
  children: ReactNode;
  initialProject?: Project;
  initialProjects?: Project[];
}

export function ProjectProvider({
  children,
  initialProject,
  initialProjects,
}: ProjectProviderProps) {
  const { user, isLoaded: userLoaded } = useUser();
  const [projects, setProjects] = useState<Project[]>(initialProjects ?? []);
  const [currentProject, setCurrentProject] = useState<Project | null>(
    initialProject ?? null,
  );
  const [isLoading, setIsLoading] = useState(!userLoaded);
  const [error, setError] = useState<string | null>(null);

  // Get stored project ID from localStorage
  const getStoredProjectId = (): number | null => {
    if (typeof window === "undefined") return null;
    const stored = localStorage.getItem(PROJECT_STORAGE_KEY);
    return stored ? parseInt(stored, 10) : null;
  };

  // Save project preference to localStorage and cookie
  const saveProjectPreference = (projectId: number) => {
    if (typeof window === "undefined") return;

    // Save to localStorage for client-side persistence
    localStorage.setItem(PROJECT_STORAGE_KEY, projectId.toString());

    // Save to cookie for SSR hydration
    document.cookie = `currentProjectId=${projectId}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`;
  };

  // Load projects from API
  const loadProjects = useCallback(async (): Promise<Project[]> => {
    try {
      const response = await fetch("/api/projects");
      
      if (!response.ok) {
        throw new Error(`Failed to fetch projects: ${response.status}`);
      }
      
      const data = (await response.json()) as ApiResponse<Project[]>;

      if (!data.success || !data.data) {
        throw new Error(data.error ?? "Invalid response from server");
      }

      return data.data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to load projects";
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, []);

  // Initialize projects when user loads
  useEffect(() => {
    const initializeProjects = async () => {
      if (!userLoaded || !user) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        let projectsToUse: Project[] = [];

        // Use initial data from SSR if available
        if (initialProjects && initialProjects.length > 0) {
          projectsToUse = initialProjects;
          setProjects(initialProjects);
        } else {
          // Load from API
          const loadedProjects = await loadProjects();
          projectsToUse = loadedProjects;
          setProjects(loadedProjects);
        }

        // Set current project
        if (projectsToUse.length > 0) {
          let targetProject: Project | null = null;

          // Priority 1: Use initialProject if provided
          if (initialProject && projectsToUse.find((p) => p.id === initialProject.id)) {
            targetProject = initialProject;
          } else {
            // Priority 2: Use stored preference if valid
            const storedProjectId = getStoredProjectId();
            const storedProject = projectsToUse.find((p) => p.id === storedProjectId);
            if (storedProject) {
              targetProject = storedProject;
            } else {
              // Priority 3: Use first available project
              targetProject = projectsToUse[0]!;
            }
          }

          setCurrentProject(targetProject);
          saveProjectPreference(targetProject.id);
        }
      } catch (err) {
        console.error("Failed to initialize projects:", err);
        setError("Failed to load projects. Please try refreshing the page.");
      } finally {
        setIsLoading(false);
      }
    };

    void initializeProjects();
  }, [userLoaded, user, initialProjects, initialProject, loadProjects]);

  // Refresh projects from API
  const refreshProjects = useCallback(async (): Promise<void> => {
    if (!user) return;

    setIsLoading(true);
    setError(null);

    try {
      const loadedProjects = await loadProjects();
      setProjects(loadedProjects);

      // Update current project if it still exists
      if (currentProject) {
        const updatedCurrentProject = loadedProjects.find(
          (p) => p.id === currentProject.id,
        );
        if (updatedCurrentProject) {
          setCurrentProject(updatedCurrentProject);
        } else if (loadedProjects.length > 0) {
          // Current project was deleted, fallback to first project
          const defaultProject = loadedProjects[0]!;
          setCurrentProject(defaultProject);
          saveProjectPreference(defaultProject.id);
        } else {
          // No projects left
          setCurrentProject(null);
        }
      } else if (loadedProjects.length > 0 && !currentProject) {
        // No current project but projects exist, select first one
        const defaultProject = loadedProjects[0]!;
        setCurrentProject(defaultProject);
        saveProjectPreference(defaultProject.id);
      }
    } catch (err) {
      console.error("Failed to refresh projects:", err);
      setError("Failed to refresh projects. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [user, loadProjects, currentProject]);

  // Switch to a different project
  const switchProject = async (projectId: number): Promise<void> => {
    try {
      const targetProject = projects.find((p) => p.id === projectId);
      if (!targetProject) {
        setError("Selected project not found. Please refresh your project list.");
        return;
      }

      setCurrentProject(targetProject);
      saveProjectPreference(projectId);
      setError(null);
      toast.success(`Switched to ${targetProject.name}`);
    } catch (err) {
      const errorMessage = "Failed to switch projects. Please try again.";
      setError(errorMessage);
      toast.error(errorMessage);
    }
  };

  // Add new project to state
  const addProject = (project: Project) => {
    const updatedProjects = [...projects, project];
    setProjects(updatedProjects);

    // If this is the first project or no current project, make it current
    if (projects.length === 0 || !currentProject) {
      setCurrentProject(project);
      saveProjectPreference(project.id);
    }

    setError(null);
  };

  // Remove project from state
  const removeProject = (projectId: number) => {
    const updatedProjects = projects.filter((p) => p.id !== projectId);
    setProjects(updatedProjects);

    // If removed project was current, switch to first remaining project
    if (currentProject?.id === projectId) {
      const defaultProject = updatedProjects[0] ?? null;
      setCurrentProject(defaultProject);
      if (defaultProject) {
        saveProjectPreference(defaultProject.id);
      } else {
        // No projects left, clear stored preference
        if (typeof window !== "undefined") {
          localStorage.removeItem(PROJECT_STORAGE_KEY);
          document.cookie = "currentProjectId=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
        }
      }
    }

    setError(null);
  };

  // Update existing project in state
  const updateProject = (updatedProject: Project) => {
    const updatedProjects = projects.map((p) =>
      p.id === updatedProject.id ? updatedProject : p,
    );
    setProjects(updatedProjects);

    // Update current project if it's the one being updated
    if (currentProject?.id === updatedProject.id) {
      setCurrentProject(updatedProject);
    }

    setError(null);
  };

  // Clear error state
  const clearError = () => {
    setError(null);
  };

  const value: ProjectContextValue = {
    projects,
    currentProject,
    isLoading,
    error,
    switchProject,
    refreshProjects,
    addProject,
    removeProject,
    updateProject,
    clearError,
  };

  return (
    <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>
  );
}

// Hook to use project context
export function useProject() {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error("useProject must be used within a ProjectProvider");
  }
  return context;
}

// Helper hook to get current project ID (useful for API calls)
export function useCurrentProjectId(): number | null {
  const { currentProject } = useProject();
  return currentProject?.id ?? null;
}