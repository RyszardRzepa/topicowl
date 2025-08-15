"use client";

import { useRouter } from "next/navigation";
import { ChevronDown, Plus, Building2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useProject } from "@/contexts/project-context";

interface ProjectSwitcherProps {
  className?: string;
}

export function ProjectSwitcher({ className }: ProjectSwitcherProps) {
  const router = useRouter();
  const { currentProject, projects, switchProject, isLoading } = useProject();

  const handleProjectChange = (projectId: string) => {
    const project = projects.find((p) => p.id.toString() === projectId);
    if (project) {
      void switchProject(project.id);
    }
  };

  const handleCreateProject = () => {
    router.push("/dashboard/projects/new");
  };

  if (isLoading) {
    return (
      <div className={cn("w-full", className)}>
        <div className="flex items-center w-full h-auto py-2.5">
          <Building2 className="mr-3 h-5 w-5 flex-shrink-0 text-muted-foreground" />
          <div className="bg-muted h-4 w-32 animate-pulse rounded" />
        </div>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className={cn("w-full", className)}>
        <Button
          variant="ghost"
          onClick={handleCreateProject}
          className="w-full justify-start h-auto py-2.5 text-muted-foreground hover:text-foreground"
        >
          <Plus className="mr-3 h-5 w-5 flex-shrink-0" />
          <span className="text-sm font-medium">Create Project</span>
        </Button>
      </div>
    );
  }

  return (
    <div className={cn("w-full", className)}>
      <Select
        value={currentProject?.id.toString()}
        onValueChange={handleProjectChange}
      >
        <SelectTrigger className="w-full justify-start h-auto py-2.5 border-none bg-transparent hover:bg-accent/50 focus:ring-0 focus:ring-offset-0">
          <div className="flex items-center w-full">
            <Building2 className="mr-3 h-5 w-5 flex-shrink-0" />
            <SelectValue>
              <div className="flex flex-col items-start text-left">
                <span className="text-foreground text-sm font-medium">
                  {currentProject?.name ?? "Select Project"}
                </span>
                {currentProject?.domain && (
                  <span className="text-muted-foreground text-xs">
                    {currentProject.domain}
                  </span>
                )}
              </div>
            </SelectValue>
          </div>
        </SelectTrigger>
        <SelectContent className="min-w-[250px]">
          {projects.map((project) => (
            <SelectItem key={project.id} value={project.id.toString()}>
              <div className="flex flex-col">
                <span className="font-medium">{project.name}</span>
                <span className="text-muted-foreground text-xs">
                  {project.domain ?? project.websiteUrl}
                </span>
              </div>
            </SelectItem>
          ))}
          <div className="border-border my-1 border-t" />
          <button
            onClick={handleCreateProject}
            className="text-muted-foreground hover:text-foreground hover:bg-accent flex w-full items-center rounded-sm px-2 py-2 text-sm transition-colors"
          >
            <Plus className="mr-2 h-4 w-4" />
            Create New Project
          </button>
        </SelectContent>
      </Select>
    </div>
  );
}
