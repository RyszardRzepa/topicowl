"use client";

import { useProject } from "@/contexts/project-context";
import { Badge } from "@/components/ui/badge";
import { Building2, Globe } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProjectContextIndicatorProps {
  className?: string;
  showIcon?: boolean;
  variant?: "default" | "inline" | "badge";
}

export function ProjectContextIndicator({ 
  className, 
  showIcon = true,
  variant = "default" 
}: ProjectContextIndicatorProps) {
  const { currentProject, isLoading } = useProject();

  if (isLoading) {
    return (
      <div className={cn("animate-pulse", className)}>
        <div className="h-4 w-24 bg-gray-200 rounded"></div>
      </div>
    );
  }

  if (!currentProject) {
    return null;
  }

  const content = (
    <>
      {showIcon && <Building2 className="h-3 w-3" />}
      <span className="truncate">
        {currentProject.domain ?? currentProject.name}
      </span>
    </>
  );

  if (variant === "badge") {
    return (
      <Badge variant="secondary" className={cn("inline-flex items-center gap-1", className)}>
        {content}
      </Badge>
    );
  }

  if (variant === "inline") {
    return (
      <span className={cn("inline-flex items-center gap-1 text-xs text-muted-foreground", className)}>
        {content}
      </span>
    );
  }

  return (
    <div className={cn("flex items-center gap-1 text-sm text-muted-foreground", className)}>
      {content}
    </div>
  );
}

interface ProjectConfirmationProps {
  action: string;
  className?: string;
}

export function ProjectConfirmation({ action, className }: ProjectConfirmationProps) {
  const { currentProject } = useProject();

  if (!currentProject) return null;

  return (
    <div className={cn("bg-blue-50 border border-blue-200 rounded-md p-3", className)}>
      <div className="flex items-start gap-2">
        <Globe className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
        <div className="text-sm">
          <p className="text-blue-800 font-medium">
            {action} for {currentProject.name}
          </p>
          <p className="text-blue-600">
            This will be created for your <strong>{currentProject.domain ?? currentProject.websiteUrl}</strong> website
          </p>
        </div>
      </div>
    </div>
  );
}
