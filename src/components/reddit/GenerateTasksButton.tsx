"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format, startOfWeek } from "date-fns";

interface GenerateTasksButtonProps {
  projectId: number;
  weekStartDate?: Date;
  onTasksGenerated: () => void;
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
          weekStartDate: targetWeekStart.toISOString(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to generate tasks");
      }

      // Show success message with details
      const weekRange = format(targetWeekStart, "MMM d") + " - " + format(new Date(targetWeekStart.getTime() + 6 * 24 * 60 * 60 * 1000), "MMM d");
      toast.success(
        `Generated ${data.tasksGenerated} tasks for week of ${weekRange}`,
        {
          description: `${data.taskDistribution.comments} comments, ${data.taskDistribution.posts} posts`,
        }
      );

      // Refresh the calendar
      onTasksGenerated();
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