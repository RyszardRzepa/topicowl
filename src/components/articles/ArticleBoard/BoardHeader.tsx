import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Settings as SettingsIcon } from "lucide-react";
import { useProject } from "@/contexts/project-context";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import type { GenerationTaskStatus } from "@/lib/services/topic-discovery/types";

interface BoardHeaderProps {
  readonly weekStart: Date;
  readonly isBusy: boolean;
  readonly isGeneratingIdeas: boolean;
  readonly overdueCount: number;
  readonly onToday: () => void;
  readonly onPrevWeek: () => void;
  readonly onNextWeek: () => void;
  readonly onGenerateIdeas: () => Promise<void>;
  readonly onRescheduleOverdue: () => Promise<void>;
}

// Type for task status response
type TaskStatusResponse = {
  status: GenerationTaskStatus
  topicsGenerated?: number;
  error?: string;
};

export function BoardHeader({
  weekStart,
  isBusy,
  isGeneratingIdeas: externalIsGenerating,
  overdueCount,
  onToday,
  onPrevWeek,
  onNextWeek,
  onGenerateIdeas: _onGenerateIdeas, // Keep for backwards compatibility
  onRescheduleOverdue,
}: BoardHeaderProps) {
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

  const handleGenerateTopics = async () => {
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
  
  const isGenerating = !!activeTaskId || externalIsGenerating;
  return (
    <header className="border-border bg-card flex items-center justify-between rounded-t-lg border-b p-4">
      <div className="flex items-center gap-4">
        <h2 className="text-foreground text-xl font-bold">Articles Board</h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onToday}>
            Today
          </Button>
          <Button variant="ghost" size="icon" onClick={onPrevWeek}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onNextWeek}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <div className="ml-2 flex items-center gap-2">
            <span className="text-foreground text-lg font-medium">
              {format(weekStart, "MMMM yyyy")}
            </span>
            {isBusy && (
              <div className="border-primary h-4 w-4 animate-spin rounded-full border-2 border-t-transparent" />
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden items-center gap-3 text-xs md:flex">
          <div className="flex items-center gap-1">
            <span className="bg-chart-4 inline-block size-2.5 rounded-full" />
            <span className="text-muted-foreground">Idea</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="bg-chart-3 inline-block size-2.5 rounded-full" />
            <span className="text-muted-foreground">Generated</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="bg-chart-1 inline-block size-2.5 rounded-full" />
            <span className="text-muted-foreground">Published</span>
          </div>
        </div>

        <Button size="sm" onClick={() => { void handleGenerateTopics(); }} disabled={isGenerating}>
          {isGenerating ? (
            <>
              Generating Topics...
            </>
          ) : (
            <>
              <span className="mr-2">✨</span>
              Generate Ideas
            </>
          )}
        </Button>

        <Button asChild variant="ghost" size="icon" aria-label="Settings">
          <a href="/dashboard/settings">
            <SettingsIcon className="h-4 w-4" />
          </a>
        </Button>

        {overdueCount > 0 ? (
          <div className="flex items-center gap-2">
            <div className="text-destructive text-sm font-medium">
              Overdue: {overdueCount}
            </div>
            <Button size="sm" variant="outline" onClick={() => { void onRescheduleOverdue(); }}>
              Reschedule All Overdue
            </Button>
          </div>
        ) : null}
      </div>
    </header>
  );
}
