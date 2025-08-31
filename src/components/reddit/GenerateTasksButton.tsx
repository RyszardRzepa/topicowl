"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CalendarPlus, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface GenerateTasksButtonProps {
  projectId: number | null;
  onTasksGenerated: () => void;
  disabled?: boolean;
}

export function GenerateTasksButton({ 
  projectId, 
  onTasksGenerated, 
  disabled = false 
}: GenerateTasksButtonProps) {
  const [generating, setGenerating] = useState(false);

  const handleGenerateTasks = async () => {
    if (!projectId) {
      toast.error("Project not selected");
      return;
    }

    setGenerating(true);
    try {
      const response = await fetch("/api/reddit/tasks/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          projectId,
        }),
      });

      if (response.ok) {
        const result = await response.json() as { 
          tasksGenerated: number;
          taskDistribution?: {
            comments: number;
            posts: number;
            commentRatio: number;
            expectedRatio: number;
          };
        };
        
        if (result.taskDistribution) {
          toast.success(
            `Generated ${result.tasksGenerated} tasks: ${result.taskDistribution.comments} comments (${result.taskDistribution.commentRatio}%) + ${result.taskDistribution.posts} posts`
          );
        } else {
          toast.success(
            `Generated ${result.tasksGenerated} tasks for this week!`
          );
        }
        onTasksGenerated();
      } else {
        const error = await response.json() as { error: string };
        toast.error(error.error ?? "Failed to generate tasks");
      }
    } catch (error) {
      console.error("Error generating tasks:", error);
      toast.error("Failed to generate tasks");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Button 
      onClick={handleGenerateTasks}
      disabled={disabled || generating || !projectId}
      size="lg"
    >
      {generating ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Generating...
        </>
      ) : (
        <>
          <CalendarPlus className="mr-2 h-4 w-4" />
          Generate This Week&apos;s Tasks
        </>
      )}
    </Button>
  );
}
