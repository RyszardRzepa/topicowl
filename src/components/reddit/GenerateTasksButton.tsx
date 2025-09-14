"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format, startOfWeek } from "date-fns";
import type { RedditTask } from "@/types";

// Helper function to format date for API without timezone issues
const formatDateForAPI = (date: Date): string => {
  // Create a new date at noon local time to avoid timezone issues
  const safeDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0);
  return safeDate.toISOString();
};

interface GenerateTasksResponse {
  tasksGenerated: number;
  taskDistribution: {
    comments: number;
    posts: number;
  };
  tasks: RedditTask[];
}

interface GenerateTasksError {
  error: string;
}

interface GenerateTasksButtonProps {
  projectId: number;
  weekStartDate?: Date;
  onTasksGenerated: (tasks: RedditTask[]) => void;
  disabled?: boolean;
}

export function GenerateTasksButton({
  projectId,
  weekStartDate,
  onTasksGenerated,
  disabled = false,
}: GenerateTasksButtonProps) {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerateTasks = async () => {
    if (!projectId) {
      toast.error("No project selected");
      return;
    }

    try {
      setIsGenerating(true);

      // Calculate the week start date (Monday) if not provided
      const targetWeekStart = weekStartDate ?? startOfWeek(new Date(), { weekStartsOn: 1 });
      
      const response = await fetch("/api/reddit/tasks/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          projectId,
          weekStartDate: formatDateForAPI(targetWeekStart),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json() as GenerateTasksError;
        throw new Error(errorData.error ?? "Failed to generate tasks");
      }

      const data = await response.json() as GenerateTasksResponse;

      // Show success message with details
      const weekRange = format(targetWeekStart, "MMM d") + " - " + format(new Date(targetWeekStart.getTime() + 6 * 24 * 60 * 60 * 1000), "MMM d");
      toast.success(
        `Generated ${data.tasksGenerated} tasks for week of ${weekRange}`,
        {
          description: `${data.taskDistribution.comments} comments, ${data.taskDistribution.posts} posts`,
        }
      );

      // Pass the generated tasks to the parent component for immediate UI update
      onTasksGenerated(data.tasks ?? []);
    } catch (error) {
      console.error("Error generating tasks:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to generate tasks";
      toast.error(errorMessage);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Button
      variant="default"
      onClick={handleGenerateTasks}
      disabled={disabled || isGenerating}
    >
      {isGenerating ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Generating...
        </>
      ) : (
        <>
          <Plus className="mr-2 h-4 w-4" />
          Generate Tasks
        </>
      )}
    </Button>
  );
}