"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
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
  initialProjects 
}: ProjectProviderProps) {
  const { user, isLoaded: userLoaded } = useUser();
  const [projects, setProjects] = useState<Project[]>(initialProjects ?? []);
  const [currentProject, setCurrentProject] = useState<Project | null>(initialProject ?? null);
  const [isLoading, setIsLoading] = useState(!userLoaded);
  const [error, setError] = useState<string | null>(null);

  // Load projects from API
  const loadProjects = async (): Promise<Project[]> => {
    try {
      const response = await fetch("/api/projects");
      const data = (await response.json()) as ApiResponse<Project[]>;
      
      if (!data.success || !data.data) {
        throw new Error(data.error ?? "Failed to load projects");
      }
      
      return data.data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to load projects";
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

    // Initialize on user load
  useEffect(() => {
    // Initialize projects and current project
    const initializeProjects = async () => {
      if (!user) return;
      
      setIsLoading(true);
      setError(null);
      
      try {
        // If we have initial data from SSR, use it
        if (initialProjects && initialProjects.length > 0) {
          setProjects(initialProjects);
          
          // Set current project from initial data or stored preference
          if (initialProject) {
            setCurrentProject(initialProject);
            saveProjectPreference(initialProject.id);
          } else {
            const storedProjectId = getStoredProjectId();
            const storedProject = initialProjects.find(p => p.id === storedProjectId);
            const defaultProject = storedProject ?? initialProjects[0]!;
            setCurrentProject(defaultProject);
            saveProjectPreference(defaultProject.id);
          }
        } else {
          // Load from API
          const loadedProjects = await loadProjects();
          setProjects(loadedProjects);
          
          if (loadedProjects.length > 0) {
            const storedProjectId = getStoredProjectId();
            const storedProject = loadedProjects.find(p => p.id === storedProjectId);
            const defaultProject = storedProject ?? loadedProjects[0]!;
            setCurrentProject(defaultProject);
            saveProjectPreference(defaultProject.id);
          }
          
          // Cache projects in localStorage
          if (loadedProjects.length > 0) {
            localStorage.setItem(PROJECTS_CACHE_KEY, JSON.stringify(loadedProjects));
          }
        }
      } catch (err) {
        console.error("Failed to initialize projects:", err);
        // Try to load from cache as fallback
        const cachedProjects = getCachedProjects();
        if (cachedProjects.length > 0) {
          setProjects(cachedProjects);
          setCurrentProject(cachedProjects[0]!);
          setError("Using cached projects. Some data may be outdated.");
        }
      } finally {
        setIsLoading(false);
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
    }
  }, [userLoaded, user, initialProject, initialProjects]);

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

  // Switch to a different project
  const switchProject = async (projectId: number): Promise<void> => {
    const targetProject = projects.find(p => p.id === projectId);
    if (!targetProject) {
      toast.error("Project not found");
      return;
    }

    setCurrentProject(targetProject);
    saveProjectPreference(projectId);
    toast.success(`Switched to ${targetProject.name}`);
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
        const updatedCurrentProject = loadedProjects.find(p => p.id === currentProject.id);
        if (updatedCurrentProject) {
          setCurrentProject(updatedCurrentProject);
        } else {
          // Current project was deleted, fallback to first project
          const defaultProject = loadedProjects[0] ?? null;
          setCurrentProject(defaultProject);
          if (defaultProject) {
            saveProjectPreference(defaultProject.id);
          }
        }
      }
      
      // Update cache
      localStorage.setItem(PROJECTS_CACHE_KEY, JSON.stringify(loadedProjects));
    } catch (err) {
      console.error("Failed to refresh projects:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Add new project to state
  const addProject = (project: Project) => {
    setProjects(prev => [...prev, project]);
    
    // If this is the first project, make it current
    if (projects.length === 0) {
      setCurrentProject(project);
      saveProjectPreference(project.id);
    }
    
    // Update cache
    const updatedProjects = [...projects, project];
    localStorage.setItem(PROJECTS_CACHE_KEY, JSON.stringify(updatedProjects));
  };

  // Remove project from state
  const removeProject = (projectId: number) => {
    setProjects(prev => prev.filter(p => p.id !== projectId));
    
    // If removed project was current, switch to first remaining project
    if (currentProject?.id === projectId) {
      const remainingProjects = projects.filter(p => p.id !== projectId);
      const defaultProject = remainingProjects[0] ?? null;
      setCurrentProject(defaultProject);
      if (defaultProject) {
        saveProjectPreference(defaultProject.id);
      }
    }
    
    // Update cache
    const updatedProjects = projects.filter(p => p.id !== projectId);
    localStorage.setItem(PROJECTS_CACHE_KEY, JSON.stringify(updatedProjects));
  };

  // Update existing project in state
  const updateProject = (updatedProject: Project) => {
    setProjects(prev => prev.map(p => p.id === updatedProject.id ? updatedProject : p));
    
    // Update current project if it's the one being updated
    if (currentProject?.id === updatedProject.id) {
      setCurrentProject(updatedProject);
    }
    
    // Update cache
    const updatedProjects = projects.map(p => p.id === updatedProject.id ? updatedProject : p);
    localStorage.setItem(PROJECTS_CACHE_KEY, JSON.stringify(updatedProjects));
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
  };

  return (
    <ProjectContext.Provider value={value}>
      {children}
    </ProjectContext.Provider>
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
