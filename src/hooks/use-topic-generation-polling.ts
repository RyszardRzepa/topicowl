import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useProject } from "@/contexts/project-context";
import type { GenerationTaskStatus } from "@/lib/services/topic-discovery/types";

// Type for task status response
type TaskStatusResponse = {
  status: GenerationTaskStatus;
  topicsGenerated?: number;
  error?: string;
};

export function useTopicGenerationPolling() {
  const { currentProject } = useProject();
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);

  // Check session storage for ongoing generation on mount
  useEffect(() => {
    if (currentProject?.id) {
      const storedTaskId = sessionStorage.getItem(`topic-generation-${currentProject.id}`);
      if (storedTaskId) {
        setActiveTaskId(storedTaskId);
      }
    }
  }, [currentProject?.id]);

  // Query function with proper typing for TanStack Query v5
  const fetchTaskStatus = async ({ signal }: { signal: AbortSignal }): Promise<TaskStatusResponse> => {
    if (!activeTaskId) throw new Error('No active task');
    
    const response = await fetch(`/api/topics/status/${activeTaskId}`, { signal });
    if (!response.ok) {
      throw new Error('Failed to fetch task status');
    }
    const data: unknown = await response.json();
    return data as TaskStatusResponse;
  };

  // Use TanStack Query v5 with proper type inference
  const { data: taskStatus, isError, error } = useQuery({
    queryKey: ['topic-generation-status', activeTaskId],
    queryFn: fetchTaskStatus,
    enabled: !!activeTaskId,
    refetchInterval: (query) => {
      // Stop polling if the task is completed or failed
      if (query.state.data?.status === 'completed' || query.state.data?.status === 'failed') {
        return false;
      }
      // Poll every 5 seconds while processing
      return 5000;
    },
    refetchIntervalInBackground: true, // Keep polling even if tab is not focused
    refetchOnWindowFocus: false, // Don't refetch on window focus to avoid extra requests
  });

  // Handle task completion/failure
  useEffect(() => {
    if (!taskStatus) return;
    
    if (taskStatus.status === 'completed') {
      setActiveTaskId(null);
      if (currentProject?.id) {
        sessionStorage.removeItem(`topic-generation-${currentProject.id}`);
      }
      const topicsCount = taskStatus.topicsGenerated ?? 10;
      toast.success(`Successfully generated ${topicsCount} article ideas!`);
      // Refresh the page to show new articles
      window.location.reload();
    } else if (taskStatus.status === 'failed') {
      setActiveTaskId(null);
      if (currentProject?.id) {
        sessionStorage.removeItem(`topic-generation-${currentProject.id}`);
      }
      const errorMessage = taskStatus.error ?? 'Failed to generate ideas. Please try again.';
      toast.error(errorMessage);
    }
  }, [taskStatus, currentProject?.id]);

  const startTopicGeneration = async () => {
    if (!currentProject) {
      toast.error("No project selected");
      return;
    }

    try {
      const response = await fetch("/api/topics/discover", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          projectId: currentProject.id,
        }),
      });

      const data = await response.json() as { 
        success: boolean; 
        data?: { taskId: string };
        error?: string;
        details?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? data.details ?? "Failed to generate topics");
      }

      if (data.data?.taskId) {
        // Store task ID and start polling
        const taskId = data.data.taskId;
        sessionStorage.setItem(`topic-generation-${currentProject.id}`, taskId);
        setActiveTaskId(taskId);
        toast.success("Topic generation started! You'll receive 10 article ideas shortly.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to generate topics");
    }
  };

  const isGenerating = !!activeTaskId;

  return {
    isGenerating,
    taskStatus,
    activeTaskId,
    startTopicGeneration,
    isError,
    error,
  };
}