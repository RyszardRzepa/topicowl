"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Calendar,
  Settings,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { useCurrentProjectId } from "@/contexts/project-context";
import { TaskCalendar } from "@/components/reddit-automation/TaskCalendar";
import { TaskExecutor } from "@/components/reddit-automation/TaskExecutor";
import { GenerateTasksButton } from "@/components/reddit-automation/GenerateTasksButton";
import type { RedditTask, WeeklyTasksResponse } from "@/types";

export default function RedditAutomationPage() {
  const router = useRouter();
  const currentProjectId = useCurrentProjectId();
  const [weekData, setWeekData] = useState<WeeklyTasksResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [redditConnected, setRedditConnected] = useState<boolean | null>(null);
  const [hasRedditSettings, setHasRedditSettings] = useState<boolean | null>(
    null,
  );
  const [selectedTask, setSelectedTask] = useState<RedditTask | null>(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);

  const fetchWeekData = useCallback(async () => {
    if (!currentProjectId) return;

    try {
      setLoading(true);
      const response = await fetch(
        `/api/tools/reddit-automation/tasks/week?projectId=${currentProjectId}`,
      );

      if (response.ok) {
        const data = (await response.json()) as WeeklyTasksResponse;
        setWeekData(data);
      } else if (response.status === 404) {
        // No tasks found, that's okay
        setWeekData({
          success: true,
          weekStartDate: new Date().toISOString(),
          weekEndDate: new Date().toISOString(),
          tasks: {},
          statistics: {
            totalTasks: 0,
            completedTasks: 0,
            skippedTasks: 0,
            pendingTasks: 0,
            completionRate: 0,
          },
        });
      } else {
        toast.error("Failed to load tasks");
      }
    } catch (error) {
      console.error("Error fetching week data:", error);
      toast.error("Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }, [currentProjectId]);

  const checkRedditConnection = useCallback(async () => {
    if (!currentProjectId) return;

    try {
      const response = await fetch(
        `/api/social/accounts?projectId=${currentProjectId}`,
      );
      if (response.ok) {
        const data = (await response.json()) as {
          data?: { reddit?: { connected: boolean } };
        };
        setRedditConnected(data.data?.reddit?.connected ?? false);
      }
    } catch (error) {
      console.error("Error checking Reddit connection:", error);
      setRedditConnected(false);
    }
  }, [currentProjectId]);

  const checkRedditSettings = useCallback(async () => {
    if (!currentProjectId) return;

    try {
      const response = await fetch(
        `/api/tools/reddit-automation/settings/check?projectId=${currentProjectId}`,
      );
      if (response.ok) {
        const data = (await response.json()) as {
          hasSettings: boolean;
        };
        setHasRedditSettings(data.hasSettings);
      }
    } catch (error) {
      console.error("Error checking Reddit settings:", error);
      setHasRedditSettings(false);
    }
  }, [currentProjectId]);

  useEffect(() => {
    if (currentProjectId) {
      void fetchWeekData();
      void checkRedditConnection();
      void checkRedditSettings();
    }
  }, [
    currentProjectId,
    fetchWeekData,
    checkRedditConnection,
    checkRedditSettings,
  ]);

  const handleTaskClick = (task: RedditTask) => {
    setSelectedTask(task);
    setIsTaskModalOpen(true);
  };

  const handleTaskComplete = async (
    taskId: number,
    redditUrl?: string,
    karmaEarned?: number,
  ) => {
    try {
      const response = await fetch(
        `/api/tools/reddit-automation/tasks/${taskId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status: "completed",
            redditUrl,
            karmaEarned,
          }),
        },
      );

      if (response.ok) {
        toast.success("Task marked as completed!");
        void fetchWeekData(); // Refresh data
      } else {
        const error = (await response.json()) as { error?: string };
        toast.error(error.error ?? "Failed to complete task");
      }
    } catch (error) {
      console.error("Error completing task:", error);
      toast.error("Failed to complete task");
    }
  };

  const handleTaskSkip = async (taskId: number) => {
    try {
      const response = await fetch(
        `/api/tools/reddit-automation/tasks/${taskId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status: "skipped",
          }),
        },
      );

      if (response.ok) {
        toast.success("Task skipped");
        void fetchWeekData(); // Refresh data
      } else {
        const error = (await response.json()) as { error?: string };
        toast.error(error.error ?? "Failed to skip task");
      }
    } catch (error) {
      console.error("Error skipping task:", error);
      toast.error("Failed to skip task");
    }
  };

  const handleTaskUpdate = async (
    taskId: number,
    updates: { scheduledDate?: Date },
  ) => {
    try {
      const response = await fetch(
        `/api/tools/reddit-automation/tasks/${taskId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            scheduledDate: updates.scheduledDate?.toISOString(),
          }),
        },
      );

      if (!response.ok) {
        const error = (await response.json()) as { error?: string };
        throw new Error(error.error ?? "Failed to update task");
      }
    } catch (error) {
      console.error("Error updating task:", error);
      throw error; // Re-throw so the calling component can handle it
    }
  };

  const handleTaskOptimisticUpdate = (
    taskId: number,
    updates: Partial<RedditTask>,
  ) => {
    if (!weekData) return;

    // Create a deep copy of weekData and update the specific task
    const updatedWeekData = { ...weekData };
    updatedWeekData.tasks = { ...weekData.tasks };

    // Find and update the task across all days
    Object.keys(updatedWeekData.tasks).forEach((dayKey) => {
      const dayTasks = updatedWeekData.tasks[dayKey];
      if (dayTasks) {
        const taskIndex = dayTasks.findIndex((task) => task.id === taskId);
        if (taskIndex !== -1) {
          // Remove task from current day
          const updatedDayTasks = [...dayTasks];
          const [taskToMove] = updatedDayTasks.splice(taskIndex, 1);
          updatedWeekData.tasks[dayKey] = updatedDayTasks;

          // Apply updates to the task
          if (taskToMove && updates.scheduledDate) {
            const updatedTask = { ...taskToMove, ...updates };
            const newDayKey = format(
              new Date(updates.scheduledDate),
              "yyyy-MM-dd",
            );

            // Add task to new day
            updatedWeekData.tasks[newDayKey] ??= [];
            updatedWeekData.tasks[newDayKey] = [
              ...(updatedWeekData.tasks[newDayKey] ?? []),
              updatedTask,
            ];
          }
        }
      }
    });

    setWeekData(updatedWeekData);
  };

  const handleRefresh = () => {
    void fetchWeekData();
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  const hasTasks = weekData && weekData.statistics.totalTasks > 0;

  return (
    <div className="container mx-auto">
      {/* Reddit Connection Alert */}
      {redditConnected === false && (
        <Alert className="mb-6 border-orange-200 bg-orange-50">
          <AlertCircle className="h-4 w-4 text-orange-600" />
          <AlertDescription className="text-orange-800">
            Your Reddit account is not connected for this project. Connect your
            Reddit account for better subreddit discovery.{" "}
            <Button
              variant="link"
              className="h-auto p-0 text-orange-800 underline"
              onClick={() => router.push("/dashboard/social")}
            >
              Go to Social Settings
              <ExternalLink className="ml-1 h-3 w-3" />
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Main Content */}
      {hasRedditSettings === false ? (
        <div className="py-12 text-center">
          <Settings className="mx-auto mb-4 h-12 w-12 text-gray-400" />
          <h3 className="mb-2 text-lg font-semibold text-gray-900">
            Configure Your Settings
          </h3>
          <p className="mx-auto mb-6 max-w-md text-gray-600">
            Set up your Reddit preferences to get started with weekly task
            generation.
          </p>
          <Button
            onClick={() =>
              router.push("/dashboard/tools/reddit-automation/settings")
            }
          >
            <Settings className="mr-2 h-4 w-4" />
            Configure Settings
          </Button>
        </div>
      ) : !hasTasks ? (
        <div className="py-12 text-center">
          <Calendar className="mx-auto mb-4 h-12 w-12 text-gray-400" />
          <h3 className="mb-2 text-lg font-semibold text-gray-900">
            No Tasks This Week
          </h3>
          <p className="mx-auto mb-6 max-w-md text-gray-600">
            Generate your weekly Reddit engagement tasks to get started.
          </p>
          <GenerateTasksButton
            projectId={currentProjectId}
            onTasksGenerated={() => void fetchWeekData()}
          />
        </div>
      ) : (
        weekData &&
        currentProjectId && (
          <div className="h-[85vh]">
            <TaskCalendar
              weekData={weekData}
              onTaskClick={handleTaskClick}
              onRefresh={handleRefresh}
              onTaskUpdate={handleTaskUpdate}
              onTaskOptimisticUpdate={handleTaskOptimisticUpdate}
              onTaskComplete={handleTaskComplete}
              loading={loading}
              projectId={currentProjectId}
            />
          </div>
        )
      )}

      {/* Task Execution Modal */}
      <TaskExecutor
        task={selectedTask}
        isOpen={isTaskModalOpen}
        onClose={() => {
          setIsTaskModalOpen(false);
          setSelectedTask(null);
        }}
        onComplete={handleTaskComplete}
        onSkip={handleTaskSkip}
      />
    </div>
  );
}
