"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";

interface Project {
  id: number;
  name: string;
  websiteUrl: string;
  domain?: string;
}

interface ProjectContextType {
  currentProject: Project | null;
  projects: Project[];
  setCurrentProject: (project: Project | null) => void;
  loading: boolean;
  refetchProjects: () => Promise<void>;
  switchToProject: (projectId: number) => Promise<void>;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const { user } = useUser();
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProjects = async () => {
    if (!user?.id) return;
    
    try {
      const response = await fetch("/api/projects");
      if (response.ok) {
        const data = await response.json() as { success: boolean; data: Project[] };
        setProjects(data.data ?? []);
        
        // Set current project to first project if none selected
        if (!currentProject && data.data && data.data.length > 0) {
          setCurrentProject(data.data[0] ?? null);
        }
        
        // Check if current project still exists
        if (currentProject && data.data) {
          const stillExists = data.data.find(p => p.id === currentProject.id);
          if (!stillExists) {
            setCurrentProject(data.data[0] ?? null);
          }
        }
      }
    } catch (error) {
      console.error("Failed to load projects:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchProjects();
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const refetchProjects = async () => {
    setLoading(true);
    await fetchProjects();
  };

  const switchToProject = async (projectId: number) => {
    setLoading(true);
    await fetchProjects();
    
    // Find and switch to the specific project
    const projects = await (async () => {
      const response = await fetch("/api/projects");
      if (response.ok) {
        const data = await response.json() as { success: boolean; data: Project[] };
        return data.data ?? [];
      }
      return [];
    })();
    
    const targetProject = projects.find(p => p.id === projectId);
    if (targetProject) {
      setCurrentProject(targetProject);
    }
    setLoading(false);
  };

  return (
    <ProjectContext.Provider
      value={{
        currentProject,
        projects,
        setCurrentProject,
        loading,
        refetchProjects,
        switchToProject,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error("useProject must be used within a ProjectProvider");
  }
  return context;
}
