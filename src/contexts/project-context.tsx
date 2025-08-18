"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
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
  // New: Project change event system
  onProjectChange: (callback: (project: Project | null) => void) => () => void;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

const PROJECT_STORAGE_KEY = "contentbot-current-project-id";

export function ProjectProvider({ children }: { children: ReactNode }) {
  const { user, isLoaded: userLoaded } = useUser();
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedRef = useRef(false);
  const projectChangeCallbacksRef = useRef<Set<(project: Project | null) => void>>(new Set());

  // Get stored project ID from localStorage
  const getStoredProjectId = (): number | null => {
    if (typeof window === "undefined") return null;
    const stored = localStorage.getItem(PROJECT_STORAGE_KEY);
    return stored ? parseInt(stored, 10) : null;
  };

  // Save project preference
  const saveProjectPreference = (projectId: number) => {
    if (typeof window === "undefined") return;
    localStorage.setItem(PROJECT_STORAGE_KEY, projectId.toString());
    document.cookie = `currentProjectId=${projectId}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`;
  };

  // Notify all listeners when project changes
  const notifyProjectChange = (project: Project | null) => {
    projectChangeCallbacksRef.current.forEach((callback) => {
      try {
        callback(project);
      } catch (error) {
        console.error('Error in project change callback:', error);
      }
    });
  };

  // Register/unregister project change listeners
  const onProjectChange = useCallback((callback: (project: Project | null) => void) => {
    projectChangeCallbacksRef.current.add(callback);
    
    // Return cleanup function
    return () => {
      projectChangeCallbacksRef.current.delete(callback);
    };
  }, []);

  // Load projects from API
  const loadProjects = useCallback(async (): Promise<Project[]> => {
    try {
      const response = await fetch("/api/projects");
      
      if (!response.ok) {
        if (response.status >= 500) {
          throw new Error("Server error occurred. Please try again in a few moments.");
        } else if (response.status === 401) {
          throw new Error("Authentication required. Please sign in again.");
        } else {
          throw new Error(`Failed to fetch projects: ${response.status}`);
        }
      }
      
      const data = (await response.json()) as ApiResponse<Project[]>;

      if (!data.success || !data.data) {
        throw new Error(data.error ?? "Invalid response from server");
      }

      return data.data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to load projects";
      console.error("Error loading projects:", error);
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, []);

  // Initialize projects only once when user loads
  useEffect(() => {
    const initializeProjects = async () => {
      // Skip if already loaded or user not ready
      if (hasLoadedRef.current || !userLoaded || !user) {
        if (!user && userLoaded) {
          setIsLoading(false);
        }
        return;
      }

      hasLoadedRef.current = true;
      setIsLoading(true);
      setError(null);

      try {
        const loadedProjects = await loadProjects();
        setProjects(loadedProjects);

        if (loadedProjects.length > 0) {
          // Try to restore previous selection or use first project
          const storedProjectId = getStoredProjectId();
          const targetProject = 
            loadedProjects.find((p) => p.id === storedProjectId) ?? 
            loadedProjects[0];
          
          if (targetProject) {
            setCurrentProject(targetProject);
            saveProjectPreference(targetProject.id);
            // Notify listeners of initial project selection
            notifyProjectChange(targetProject);
          }
        }
      } catch (error) {
        console.error("Failed to initialize projects:", error);
        setError("Failed to load projects. Please try refreshing the page.");
      } finally {
        setIsLoading(false);
      }
    };

    void initializeProjects();
  }, [userLoaded, user, loadProjects]);

  // Other methods with proper notifications
  const refreshProjects = useCallback(async (): Promise<void> => {
    if (!user) return;

    try {
      const loadedProjects = await loadProjects();
      setProjects(loadedProjects);

      if (currentProject) {
        const updatedCurrentProject = loadedProjects.find(
          (p) => p.id === currentProject.id,
        );
        if (updatedCurrentProject) {
          setCurrentProject(updatedCurrentProject);
          notifyProjectChange(updatedCurrentProject);
        } else if (loadedProjects.length > 0) {
          const defaultProject = loadedProjects[0]!;
          setCurrentProject(defaultProject);
          saveProjectPreference(defaultProject.id);
          notifyProjectChange(defaultProject);
        } else {
          setCurrentProject(null);
          notifyProjectChange(null);
        }
      } else if (loadedProjects.length > 0) {
        const defaultProject = loadedProjects[0]!;
        setCurrentProject(defaultProject);
        saveProjectPreference(defaultProject.id);
        notifyProjectChange(defaultProject);
      }
      setError(null);
    } catch (error) {
      console.error("Failed to refresh projects:", error);
      setError("Failed to refresh projects. Please try again.");
    }
  }, [user, loadProjects, currentProject]);

  // Switch to a different project with proper notifications
  const switchProject = async (projectId: number): Promise<void> => {
    const targetProject = projects.find((p) => p.id === projectId);
    if (!targetProject) {
      toast.error("Selected project not found");
      return;
    }

    // Optimistically update UI first
    setCurrentProject(targetProject);
    saveProjectPreference(projectId);
    
    // Notify all listeners immediately for instant UI updates
    notifyProjectChange(targetProject);
    
    toast.success(`Switched to ${targetProject.name}`);
  };

  const addProject = (project: Project) => {
    setProjects(prev => [...prev, project]);
    if (projects.length === 0 || !currentProject) {
      setCurrentProject(project);
      saveProjectPreference(project.id);
      notifyProjectChange(project);
    }
  };

  const removeProject = (projectId: number) => {
    setProjects(prev => prev.filter((p) => p.id !== projectId));
    
    if (currentProject?.id === projectId) {
      const remainingProjects = projects.filter((p) => p.id !== projectId);
      const defaultProject = remainingProjects[0] ?? null;
      setCurrentProject(defaultProject);
      
      if (defaultProject) {
        saveProjectPreference(defaultProject.id);
      } else if (typeof window !== "undefined") {
        localStorage.removeItem(PROJECT_STORAGE_KEY);
      }
      notifyProjectChange(defaultProject);
    }
  };

  const updateProject = (updatedProject: Project) => {
    setProjects(prev => prev.map((p) =>
      p.id === updatedProject.id ? updatedProject : p
    ));

    if (currentProject?.id === updatedProject.id) {
      setCurrentProject(updatedProject);
      notifyProjectChange(updatedProject);
    }
  };

  const clearError = () => setError(null);

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
    onProjectChange,
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