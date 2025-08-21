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
  variant = "default",
}: ProjectContextIndicatorProps) {
  const { currentProject, isLoading } = useProject();

  if (isLoading) {
    return (
      <div className={cn("animate-pulse", className)}>
        <div className="h-4 w-24 rounded bg-gray-200"></div>
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
      <Badge
        variant="secondary"
        className={cn("inline-flex items-center gap-1", className)}
      >
        {content}
      </Badge>
    );
  }

  if (variant === "inline") {
    return (
      <span
        className={cn(
          "text-muted-foreground inline-flex items-center gap-1 text-xs",
          className,
        )}
      >
        {content}
      </span>
    );
  }

  return (
    <div
      className={cn(
        "text-muted-foreground flex items-center gap-1 text-sm",
        className,
      )}
    >
      {content}
    </div>
  );
}

interface ProjectConfirmationProps {
  action: string;
  className?: string;
}

export function ProjectConfirmation({
  action,
  className,
}: ProjectConfirmationProps) {
  const { currentProject } = useProject();

  if (!currentProject) return null;

  return (
    <div
      className={cn(
        "rounded-md border border-blue-200 bg-blue-50 p-3",
        className,
      )}
    >
      <div className="flex items-start gap-2">
        <Globe className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600" />
        <div className="text-sm">
          <p className="font-medium text-blue-800">
            {action} for {currentProject.name}
          </p>
          <p className="text-blue-600">
            This will be created for your{" "}
            <strong>
              {currentProject.domain ?? currentProject.websiteUrl}
            </strong>{" "}
            website
          </p>
        </div>
      </div>
    </div>
  );
}
