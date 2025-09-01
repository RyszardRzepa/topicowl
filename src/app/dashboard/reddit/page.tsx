"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { format, startOfWeek } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Settings,
} from "lucide-react";
import { toast } from "sonner";
import { useCurrentProjectId } from "@/contexts/project-context";
import { TaskCalendar } from "@/components/reddit/TaskCalendar";
import { TaskExecutor } from "@/components/reddit/TaskExecutor";
import { GenerateTasksButton } from "@/components/reddit/GenerateTasksButton";
import type { RedditTask, WeeklyTasksResponse } from "@/types";

export default function RedditPage() {
  const router = useRouter();
  const currentProjectId = useCurrentProjectId();
  const [weekData, setWeekData] = useState<WeeklyTasksResponse | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [weekLoading, setWeekLoading] = useState(false);
  const [redditConnected, setRedditConnected] = useState<boolean | null>(null);
  const [hasRedditSettings, setHasRedditSettings] = useState<boolean | null>(
    null,
  );
  const [selectedTask, setSelectedTask] = useState<RedditTask | null>(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => 
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );

  const fetchWeekData = useCallback(async (weekStartDate?: Date, isInitialLoad = false) => {
    if (!currentProjectId) return;

    try {
      // Only show full loading on initial load, use week loading for navigation
      if (isInitialLoad) {
        setInitialLoading(true);
      } else {
        setWeekLoading(true);
      }
      
      // Build URL with optional week parameter
      let url = `/api/reddit/tasks/week?projectId=${currentProjectId}`;
      if (weekStartDate) {
        url += `&weekStartDate=${weekStartDate.toISOString()}`;
      }
      
      const response = await fetch(url);

      if (response.ok) {
        const data = (await response.json()) as WeeklyTasksResponse;
        setWeekData(data);
        // Update current week start if we got data
        if (data.weekStartDate) {
          setCurrentWeekStart(new Date(data.weekStartDate));
        }
      } else if (response.status === 404) {
        // No tasks found, that's okay
        const targetWeekStart = weekStartDate ?? startOfWeek(new Date(), { weekStartsOn: 1 });
        setWeekData({
          success: true,
          weekStartDate: targetWeekStart.toISOString(),
          weekEndDate: new Date(targetWeekStart.getTime() + 6 * 24 * 60 * 60 * 1000).toISOString(),
          tasks: {},
          statistics: {
            totalTasks: 0,
            completedTasks: 0,
            skippedTasks: 0,
            pendingTasks: 0,
            completionRate: 0,
          },
        });
        setCurrentWeekStart(targetWeekStart);
      } else {
        toast.error("Failed to load tasks");
      }
    } catch (error) {
      console.error("Error fetching week data:", error);
      toast.error("Failed to load tasks");
    } finally {
      if (isInitialLoad) {
        setInitialLoading(false);
      } else {
        setWeekLoading(false);
      }
    }
  }, [currentProjectId]);

  const checkRedditConnection = useCallback(async () => {
    if (!currentProjectId) return;

    try {
      const response = await fetch(
        `/api/reddit/status?projectId=${currentProjectId}`,
      );
      if (response.ok) {
        const data = (await response.json()) as {
          connected: boolean;
        };
        setRedditConnected(data.connected);
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
        `/api/reddit/settings/check?projectId=${currentProjectId}`,
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
      void fetchWeekData(undefined, true); // Mark as initial load
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
        `/api/reddit/tasks/${taskId}`,
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
        // In-place state update to avoid refetch
        setWeekData((prev) => {
          if (!prev) return prev;
          const updated: WeeklyTasksResponse = {
            ...prev,
            tasks: { ...prev.tasks },
            statistics: { ...prev.statistics },
          };

          for (const dayKey of Object.keys(updated.tasks)) {
            const dayTasks = updated.tasks[dayKey];
            if (!dayTasks) continue;
            const idx = dayTasks.findIndex((t) => t.id === taskId);
            if (idx !== -1) {
              const oldTask = dayTasks[idx]!; // assert exists
              const wasCompleted = oldTask.status === "completed";
              const wasSkipped = oldTask.status === "skipped";

              const newTask = {
                ...oldTask,
                status: "completed" as const,
                redditUrl: redditUrl ?? oldTask.redditUrl,
                karmaEarned: karmaEarned ?? oldTask.karmaEarned,
              };

              const newDayTasks = [...dayTasks];
              newDayTasks[idx] = newTask as typeof oldTask;
              updated.tasks[dayKey] = newDayTasks;

              if (!wasCompleted) {
                updated.statistics.completedTasks += 1;
                if (wasSkipped) {
                  updated.statistics.skippedTasks = Math.max(0, updated.statistics.skippedTasks - 1);
                } else {
                  updated.statistics.pendingTasks = Math.max(0, updated.statistics.pendingTasks - 1);
                }
                const total = updated.statistics.totalTasks;
                updated.statistics.completionRate = total > 0 ? Math.round((updated.statistics.completedTasks / total) * 100) : 0;
              }
              break;
            }
          }

          return updated;
        });
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
        `/api/reddit/tasks/${taskId}`,
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
        // In-place state update to avoid refetch
        setWeekData((prev) => {
          if (!prev) return prev;
          const updated: WeeklyTasksResponse = {
            ...prev,
            tasks: { ...prev.tasks },
            statistics: { ...prev.statistics },
          };

          for (const dayKey of Object.keys(updated.tasks)) {
            const dayTasks = updated.tasks[dayKey];
            if (!dayTasks) continue;
            const idx = dayTasks.findIndex((t) => t.id === taskId);
            if (idx !== -1) {
              const oldTask = dayTasks[idx]!;
              const wasSkipped = oldTask.status === "skipped";
              const wasCompleted = oldTask.status === "completed";

              const newTask = {
                ...oldTask,
                status: "skipped" as const,
              };

              const newDayTasks = [...dayTasks];
              newDayTasks[idx] = newTask as typeof oldTask;
              updated.tasks[dayKey] = newDayTasks;

              if (!wasSkipped) {
                updated.statistics.skippedTasks += 1;
                if (wasCompleted) {
                  updated.statistics.completedTasks = Math.max(0, updated.statistics.completedTasks - 1);
                } else {
                  updated.statistics.pendingTasks = Math.max(0, updated.statistics.pendingTasks - 1);
                }
                const total = updated.statistics.totalTasks;
                updated.statistics.completionRate = total > 0 ? Math.round((updated.statistics.completedTasks / total) * 100) : 0;
              }
              break;
            }
          }

          return updated;
        });
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
        `/api/reddit/tasks/${taskId}`,
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

    // Find the task to move
    let taskToMove: RedditTask | null = null;
    let sourceDay: string | null = null;

    // First, find and remove the task from its current location
    for (const dayKey of Object.keys(updatedWeekData.tasks)) {
      const dayTasks = updatedWeekData.tasks[dayKey];
      if (dayTasks) {
        const taskIndex = dayTasks.findIndex((task) => task.id === taskId);
        if (taskIndex !== -1) {
          // Found the task, remove it from current day
          const updatedDayTasks = [...dayTasks];
          [taskToMove] = updatedDayTasks.splice(taskIndex, 1);
          updatedWeekData.tasks[dayKey] = updatedDayTasks;
          sourceDay = dayKey;
          break; // Stop after finding the first (and only) occurrence
        }
      }
    }

    // If we found the task and have updates, add it to the new location
    if (taskToMove && updates.scheduledDate) {
      const updatedTask = { ...taskToMove, ...updates };
      const newDayKey = format(
        new Date(updates.scheduledDate),
        "yyyy-MM-dd",
      );

      // Ensure the target day exists
      if (!updatedWeekData.tasks[newDayKey]) {
        updatedWeekData.tasks[newDayKey] = [];
      }

      // Add task to new day
      updatedWeekData.tasks[newDayKey] = [
        ...updatedWeekData.tasks[newDayKey],
        updatedTask,
      ];
    }

    setWeekData(updatedWeekData);
  };

  const handleRefresh = () => {
    void fetchWeekData(currentWeekStart, false);
  };

  const handleWeekChange = (weekStartDate: Date) => {
    setCurrentWeekStart(weekStartDate);
    void fetchWeekData(weekStartDate, false); // Not an initial load
  };

  if (initialLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  // Show Reddit connection screen if not connected
  if (redditConnected === false) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="mx-auto max-w-lg">
          <Card className="p-8 text-center">
            <div className="mb-6">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-orange-100">
                <svg
                  className="h-10 w-10 text-orange-600"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900">
                Connect Reddit Account
              </h2>
              <p className="mt-2 text-gray-600">
                Connect your Reddit account to access community insights, subreddit discovery, and automated engagement planning for this project.
              </p>
            </div>

            <div className="space-y-4">
              <div className="rounded-lg bg-gray-50 p-4">
                <h3 className="font-medium text-gray-900 mb-2">What you&apos;ll get:</h3>
                <ul className="text-sm text-gray-600 space-y-1 text-left">
                  <li>• Automated subreddit discovery</li>
                  <li>• Weekly engagement task planning</li>
                  <li>• Community insights and analytics</li>
                  <li>• Content research and trend analysis</li>
                </ul>
              </div>

              <Button
                onClick={() => {
                  if (currentProjectId) {
                    window.location.href = `/api/reddit/auth?projectId=${currentProjectId}`;
                  }
                }}
                size="lg"
                className="w-full"
              >
                Connect Reddit Account
              </Button>

              <p className="text-xs text-gray-500">
                Your Reddit account will be connected securely to this project only.
                You can disconnect at any time.
              </p>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto">
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
              router.push("/dashboard/reddit/settings")
            }
          >
            <Settings className="mr-2 h-4 w-4" />
            Configure Settings
          </Button>
        </div>
      ) : (
        weekData &&
        currentProjectId && (
          <div className="h-[85vh]">
            <TaskCalendar
              weekData={weekData}
              onTaskClick={handleTaskClick}
              onRefresh={handleRefresh}
              onWeekChange={handleWeekChange}
              onTaskUpdate={handleTaskUpdate}
              onTaskOptimisticUpdate={handleTaskOptimisticUpdate}
              onTaskComplete={handleTaskComplete}
              loading={weekLoading}
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
