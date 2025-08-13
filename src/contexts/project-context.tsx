"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
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
  retryLoad: () => Promise<void>;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

const PROJECT_STORAGE_KEY = "contentbot-current-project-id";
const PROJECTS_CACHE_KEY = "contentbot-projects-cache";

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
  const [isInitialized, setIsInitialized] = useState(false);

  // Enhanced error message formatting
  const formatUserFriendlyError = (error: unknown, context: string): string => {
    if (error instanceof Error) {
      // Network errors
      if (error.message.includes('fetch')) {
        return "Unable to connect to the server. Please check your internet connection and try again.";
      }
      
      // API errors
      if (error.message.includes('401') || error.message.includes('unauthorized')) {
        return "Your session has expired. Please sign in again.";
      }
      
      if (error.message.includes('403') || error.message.includes('forbidden')) {
        return "You don't have permission to access this resource.";
      }
      
      if (error.message.includes('404')) {
        return "The requested resource was not found.";
      }
      
      if (error.message.includes('500')) {
        return "Server error occurred. Please try again in a few moments.";
      }
      
      // Return original message if it's already user-friendly
      if (!error.message.includes('Failed to') && error.message.length < 100) {
        return error.message;
      }
    }
    
    // Fallback messages based on context
    switch (context) {
      case 'load':
        return "Unable to load your projects. Please try refreshing the page.";
      case 'switch':
        return "Unable to switch projects. Please try again.";
      case 'refresh':
        return "Unable to refresh project data. Please try again.";
      default:
        return "Something went wrong. Please try again.";
    }
  };

  // Load projects from API with enhanced error handling
  const loadProjects = async (): Promise<Project[]> => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const response = await fetch("/api/projects", {
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = (await response.json()) as ApiResponse<Project[]>;

      if (!data.success || !data.data) {
        throw new Error(data.error ?? "Invalid response from server");
      }

      // Clear any existing errors on successful load
      if (error) {
        setError(null);
      }

      return data.data;
    } catch (err) {
      const userFriendlyError = formatUserFriendlyError(err, 'load');
      setError(userFriendlyError);
      throw new Error(userFriendlyError);
    }
  };

  // Initialize on user load
  useEffect(() => {
    // Initialize projects and current project
    const initializeProjects = async () => {
      if (!user || isInitialized) return;

      setIsLoading(true);
      setError(null);

      try {
        let projectsToUse: Project[] = [];

        // If we have initial data from SSR, use it
        if (initialProjects && initialProjects.length > 0) {
          projectsToUse = initialProjects;
          setProjects(initialProjects);
        } else {
          // Load from API
          const loadedProjects = await loadProjects();
          projectsToUse = loadedProjects;
          setProjects(loadedProjects);

          // Cache projects in localStorage
          if (loadedProjects.length > 0) {
            localStorage.setItem(
              PROJECTS_CACHE_KEY,
              JSON.stringify(loadedProjects),
            );
          }
        }

        // Set current project with proper fallback logic
        if (projectsToUse.length > 0) {
          let targetProject: Project | null = null;

          // Priority 1: Use initialProject if provided
          if (
            initialProject &&
            projectsToUse.find((p) => p.id === initialProject.id)
          ) {
            targetProject = initialProject;
          } else {
            // Priority 2: Use stored preference if valid
            const storedProjectId = getStoredProjectId();
            const storedProject = projectsToUse.find(
              (p) => p.id === storedProjectId,
            );
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
        
        // Enhanced fallback mechanism with cache
        const cachedProjects = getCachedProjects();
        if (cachedProjects.length > 0) {
          console.log("Using cached projects as fallback", { count: cachedProjects.length });
          setProjects(cachedProjects);
          
          const storedProjectId = getStoredProjectId();
          const cachedProject =
            cachedProjects.find((p) => p.id === storedProjectId) ??
            cachedProjects[0]!;
          setCurrentProject(cachedProject);
          saveProjectPreference(cachedProject.id);
          
          // Set a more informative error message for cached data
          setError("Working offline with cached data. Some information may be outdated. Try refreshing when you're back online.");
          
          // Attempt to refresh in the background after a delay
          setTimeout(() => {
            void refreshProjects().catch(() => {
              // Silently fail background refresh, user already knows about offline mode
            });
          }, 5000);
        } else {
          // No cache available, show user-friendly error
          const userFriendlyError = formatUserFriendlyError(err, 'load');
          setError(userFriendlyError);
        }
      } finally {
        setIsLoading(false);
        setIsInitialized(true);
      }
    };

    if (userLoaded && user) {
      void initializeProjects();
    } else if (userLoaded && !user) {
      // User not authenticated, clear state
      setProjects([]);
      setCurrentProject(null);
      setIsLoading(false);
      setError(null);
      setIsInitialized(true);
    }
  }, [userLoaded, user, initialProject, initialProjects, isInitialized, loadProjects]);

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

  // Get cached projects from localStorage
  const getCachedProjects = (): Project[] => {
    if (typeof window === "undefined") return [];
    try {
      const cached = localStorage.getItem(PROJECTS_CACHE_KEY);
      return cached ? (JSON.parse(cached) as Project[]) : [];
    } catch {
      return [];
    }
  };

  // Switch to a different project with enhanced error handling
  const switchProject = async (projectId: number): Promise<void> => {
    try {
      const targetProject = projects.find((p) => p.id === projectId);
      if (!targetProject) {
        const errorMsg = "The selected project is no longer available. Please refresh your project list.";
        setError(errorMsg);
        toast.error(errorMsg);
        return;
      }

      // Clear any existing errors before switching
      if (error) {
        setError(null);
      }

      setCurrentProject(targetProject);
      saveProjectPreference(projectId);
      toast.success(`Switched to ${targetProject.name}`);
      
      // Verify the switch was successful
      setTimeout(() => {
        if (currentProject?.id !== projectId) {
          console.warn("Project switch may have failed, current project doesn't match target");
        }
      }, 100);
      
    } catch (err) {
      const userFriendlyError = formatUserFriendlyError(err, 'switch');
      setError(userFriendlyError);
      toast.error(userFriendlyError);
    }
  };

  // Refresh projects from API
  const refreshProjects = async (): Promise<void> => {
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

      // Update cache
      localStorage.setItem(PROJECTS_CACHE_KEY, JSON.stringify(loadedProjects));
    } catch (err) {
      console.error("Failed to refresh projects:", err);
      
      // Enhanced error handling for refresh failures
      const userFriendlyError = formatUserFriendlyError(err, 'refresh');
      setError(userFriendlyError);
      
      // If refresh fails but we have cached data, inform user
      const cachedProjects = getCachedProjects();
      if (cachedProjects.length > 0 && projects.length === 0) {
        console.log("Refresh failed, falling back to cached projects");
        setProjects(cachedProjects);
        
        // Try to restore current project from cache
        const storedProjectId = getStoredProjectId();
        const cachedProject = cachedProjects.find((p) => p.id === storedProjectId) ?? cachedProjects[0]!;
        setCurrentProject(cachedProject);
        
        setError("Unable to sync with server. Using cached data until connection is restored.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Enhanced error clearing with state cleanup
  const clearError = () => {
    setError(null);
    
    // If we cleared an error and have projects but no current project, try to set one
    if (projects.length > 0 && !currentProject) {
      const storedProjectId = getStoredProjectId();
      const targetProject = projects.find((p) => p.id === storedProjectId) ?? projects[0]!;
      setCurrentProject(targetProject);
      saveProjectPreference(targetProject.id);
    }
  };

  // Enhanced retry loading with better error cleanup
  const retryLoad = async (): Promise<void> => {
    try {
      // Clear error state before retry
      setError(null);
      setIsInitialized(false);
      
      await refreshProjects();
      
      // If retry was successful and we have projects, ensure we have a current project
      if (projects.length > 0 && !currentProject) {
        const defaultProject = projects[0]!;
        setCurrentProject(defaultProject);
        saveProjectPreference(defaultProject.id);
      }
      
    } catch (err) {
      console.error("Retry load failed:", err);
      const userFriendlyError = formatUserFriendlyError(err, 'load');
      setError(userFriendlyError);
    }
  };

  // Add new project to state with error handling
  const addProject = (project: Project) => {
    try {
      const updatedProjects = [...projects, project];
      setProjects(updatedProjects);

      // If this is the first project or no current project, make it current
      if (projects.length === 0 || !currentProject) {
        setCurrentProject(project);
        saveProjectPreference(project.id);
      }

      // Clear any existing errors when successfully adding a project
      if (error) {
        setError(null);
      }

      // Update cache
      localStorage.setItem(PROJECTS_CACHE_KEY, JSON.stringify(updatedProjects));
      
    } catch (err) {
      console.error("Failed to add project:", err);
      const userFriendlyError = "Failed to add the new project. Please try again.";
      setError(userFriendlyError);
      toast.error(userFriendlyError);
    }
  };

  // Remove project from state with enhanced handling
  const removeProject = (projectId: number) => {
    try {
      const projectToRemove = projects.find((p) => p.id === projectId);
      const updatedProjects = projects.filter((p) => p.id !== projectId);
      setProjects(updatedProjects);

      // If removed project was current, switch to first remaining project
      if (currentProject?.id === projectId) {
        const defaultProject = updatedProjects[0] ?? null;
        setCurrentProject(defaultProject);
        if (defaultProject) {
          saveProjectPreference(defaultProject.id);
          toast.success(`Switched to ${defaultProject.name} after removing ${projectToRemove?.name ?? 'project'}`);
        } else {
          // No projects left, clear stored preference
          if (typeof window !== "undefined") {
            localStorage.removeItem(PROJECT_STORAGE_KEY);
            document.cookie = "currentProjectId=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
          }
        }
      }

      // Clear any existing errors when successfully removing a project
      if (error) {
        setError(null);
      }

      // Update cache
      localStorage.setItem(PROJECTS_CACHE_KEY, JSON.stringify(updatedProjects));
      
    } catch (err) {
      console.error("Failed to remove project:", err);
      const userFriendlyError = "Failed to remove the project. Please try again.";
      setError(userFriendlyError);
      toast.error(userFriendlyError);
    }
  };

  // Update existing project in state with error handling
  const updateProject = (updatedProject: Project) => {
    try {
      const existingProject = projects.find((p) => p.id === updatedProject.id);
      if (!existingProject) {
        throw new Error("Project not found in current list");
      }

      const updatedProjects = projects.map((p) =>
        p.id === updatedProject.id ? updatedProject : p,
      );
      setProjects(updatedProjects);

      // Update current project if it's the one being updated
      if (currentProject?.id === updatedProject.id) {
        setCurrentProject(updatedProject);
      }

      // Clear any existing errors when successfully updating a project
      if (error) {
        setError(null);
      }

      // Update cache
      localStorage.setItem(PROJECTS_CACHE_KEY, JSON.stringify(updatedProjects));
      
    } catch (err) {
      console.error("Failed to update project:", err);
      const userFriendlyError = "Failed to update the project. Please try refreshing your project list.";
      setError(userFriendlyError);
      toast.error(userFriendlyError);
    }
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
    retryLoad,
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
