"use client";

import type React from "react";
import { useState } from "react";
import {
  format,
  startOfWeek,
  addDays,
  addWeeks,
  subWeeks,
  isSameDay,
} from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Settings,
  Clock,
  X,
  MessageSquare,
  FileText,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Copy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubredditAutosuggestions } from "@/components/ui/subreddit-autosuggestions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { RedditTask, WeeklyTasksResponse } from "@/types";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface GoogleCalendarProps {
  weekData: WeeklyTasksResponse;
  onTaskClick: (task: RedditTask) => void;
  loading?: boolean;
  onRefresh?: () => void;
  onTaskUpdate?: (
    taskId: number,
    updates: { scheduledDate?: Date },
  ) => Promise<void>;
  onTaskOptimisticUpdate?: (
    taskId: number,
    updates: Partial<RedditTask>,
  ) => void;
  onTaskComplete?: (
    taskId: number,
    redditUrl?: string,
    karmaEarned?: number,
  ) => Promise<void>;
  projectId: number;
}

// Task categories for different types and statuses
const getTaskCategory = (task: RedditTask) => {
  if (task.status === "completed") return "completed";
  if (task.status === "skipped") return "skipped";
  if (task.taskType === "comment") return "comment";
  if (task.taskType === "post") return "post";
  return "pending";
};

// Component for expandable AI draft
const ExpandableAIDraft = ({ draft }: { draft: string }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const CHARACTER_LIMIT = 150;
  const shouldTruncate = draft.length > CHARACTER_LIMIT;
  const displayText =
    isExpanded || !shouldTruncate
      ? draft
      : draft.slice(0, CHARACTER_LIMIT) + "...";

  return (
    <div className="space-y-2">
      <p className="text-foreground text-sm whitespace-pre-wrap">
        {displayText}
      </p>
      {shouldTruncate && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-primary hover:text-primary/80 flex items-center gap-1 text-xs font-medium transition-colors"
        >
          {isExpanded ? (
            <>
              <ChevronUp className="h-3 w-3" />
              Show Less
            </>
          ) : (
            <>
              <ChevronDown className="h-3 w-3" />
              Show More
            </>
          )}
        </button>
      )}
    </div>
  );
};

const taskCategories = {
  completed: {
    color: "bg-chart-1",
    textColor: "text-white",
    label: "Completed",
    icon: Clock,
  },
  skipped: {
    color: "bg-gray-300",
    textColor: "text-gray-700",
    label: "Skipped",
    icon: X,
  },
  comment: {
    color: "bg-chart-2",
    textColor: "text-white",
    label: "Comment Task",
    icon: MessageSquare,
  },
  post: {
    color: "bg-chart-3",
    textColor: "text-white",
    label: "Post Task",
    icon: FileText,
  },
  pending: {
    color: "bg-chart-4",
    textColor: "text-white",
    label: "Pending",
    icon: Clock,
  },
};

// Visible time range configuration
// Show full 24h day, scroll inside calendar only
const VISIBLE_START_HOUR = 0; // 12 AM
const VISIBLE_END_HOUR = 24; // Midnight (exclusive upper bound)
const VISIBLE_HOURS = VISIBLE_END_HOUR - VISIBLE_START_HOUR;
// Task visual height equals one-hour slot
const TASK_BLOCK_MINUTES = 60;

// Generate 1-hour time slots within the visible window
const timeSlots = Array.from({ length: VISIBLE_HOURS }, (_, i) => {
  const hour = VISIBLE_START_HOUR + i;
  const minute = 0;
  return { hour, minute, index: i };
});

export function TaskCalendar({
  weekData,
  onTaskClick,
  loading = false,
  onRefresh,
  onTaskUpdate,
  onTaskOptimisticUpdate,
  onTaskComplete,
  projectId,
}: GoogleCalendarProps) {
  const router = useRouter();

  const [currentDate, setCurrentDate] = useState(() => {
    // Start with the week data's start date if available, otherwise current date
    try {
      return new Date(weekData.weekStartDate);
    } catch {
      return new Date();
    }
  });
  const [draggedTask, setDraggedTask] = useState<RedditTask | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<{
    day: Date;
    hour: number;
    minute: number;
  } | null>(null);
  const [isUpdatingTask, setIsUpdatingTask] = useState(false);

  // New task creation state
  const [showNewTaskForm, setShowNewTaskForm] = useState(false);
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [selectedTask, setSelectedTask] = useState<RedditTask | null>(null);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [isCompletingTask, setIsCompletingTask] = useState(false);
  const [newTaskData, setNewTaskData] = useState({
    taskType: "comment" as "comment" | "post",
    subreddit: "",
    searchKeywords: "",
    prompt: "",
    scheduledDate: "",
    scheduledTime: "",
  });

  const handleRefresh = () => {
    onRefresh?.();
  };

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const getTasksForDay = (day: Date) => {
    const dayKey = format(day, "yyyy-MM-dd");
    return weekData.tasks[dayKey] ?? [];
  };

  const getTaskPosition = (task: RedditTask) => {
    // Position task by its scheduled time within visible window; fixed height = 1 hour
    const dt = new Date(task.scheduledDate);
    const hour = dt.getHours();
    const minute = dt.getMinutes();

    // Convert to minutes from visible start
    const minutesFromStart = (hour - VISIBLE_START_HOUR) * 60 + minute;
    const totalVisibleMinutes = VISIBLE_HOURS * 60;
    const heightPercent = (TASK_BLOCK_MINUTES / totalVisibleMinutes) * 100;

    // Clamp top so the block stays within the grid
    const clampedMinutes = Math.max(
      0,
      Math.min(minutesFromStart, totalVisibleMinutes - TASK_BLOCK_MINUTES),
    );
    const topPercent = (clampedMinutes / totalVisibleMinutes) * 100;

    return {
      top: `${topPercent}%`,
      height: `${heightPercent}%`,
    };
  };

  const navigateWeek = (direction: "prev" | "next") => {
    setCurrentDate((prev) =>
      direction === "prev" ? subWeeks(prev, 1) : addWeeks(prev, 1),
    );
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Check if current week has any tasks
  const currentWeekHasTasks = weekDays.some((day) => {
    const dayKey = format(day, "yyyy-MM-dd");
    return weekData.tasks[dayKey] && weekData.tasks[dayKey].length > 0;
  });

  const handleDragStart = (e: React.DragEvent, task: RedditTask) => {
    if (isUpdatingTask) {
      e.preventDefault();
      return;
    }
    setDraggedTask(task);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", task.id.toString());
  };

  const handleDragEnd = () => {
    setDraggedTask(null);
    setDragOverSlot(null);
  };

  const handleDragOver = (
    e: React.DragEvent,
    day: Date,
    hour: number,
    minute: number,
  ) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";

    if (
      !dragOverSlot ||
      dragOverSlot.day.getTime() !== day.getTime() ||
      dragOverSlot.hour !== hour ||
      dragOverSlot.minute !== minute
    ) {
      setDragOverSlot({ day, hour, minute });
    }
  };

  const handleDragLeave = () => {
    // This prevents flickering when moving between adjacent time slots
    setTimeout(() => {
      setDragOverSlot(null);
    }, 50);
  };

  const handleDrop = async (
    e: React.DragEvent,
    day: Date,
    hour: number,
    minute: number,
  ) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData("text/plain");

    if (!taskId || !draggedTask || isUpdatingTask) return;

    try {
      setIsUpdatingTask(true);

      // Calculate the new scheduled date and time
      const newScheduledDate = new Date(day);
      newScheduledDate.setHours(hour, minute, 0, 0);

      // Check if the date actually changed to avoid unnecessary updates
      const currentDate = new Date(draggedTask.scheduledDate);
      const sameTimestamp =
        currentDate.getTime() === newScheduledDate.getTime();

      // Optimistic update - immediately update the UI
      if (onTaskOptimisticUpdate) {
        onTaskOptimisticUpdate(parseInt(taskId), {
          scheduledDate: newScheduledDate,
        });
      }

      // If no actual change, skip server call but still let UI reflect position
      if (!sameTimestamp) {
        // Update the task in the database
        if (onTaskUpdate) {
          await onTaskUpdate(parseInt(taskId), {
            scheduledDate: newScheduledDate,
          });
        } else {
          // Fallback to direct API call if no onTaskUpdate prop provided
          const response = await fetch(
            `/api/reddit/tasks/${taskId}`,
            {
              method: "PUT",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                scheduledDate: newScheduledDate.toISOString(),
              }),
            },
          );

          if (!response.ok) {
            throw new Error("Failed to update task");
          }
        }
      }

      // Show success message
      toast.success("Task moved successfully!");
    } catch (error) {
      console.error("Error updating task schedule:", error);
      toast.error("Failed to move task. Please try again.");

      // Revert optimistic update on error by refreshing
      if (onRefresh) {
        onRefresh();
      }
    } finally {
      setIsUpdatingTask(false);
      setDraggedTask(null);
      setDragOverSlot(null);
    }
  };

  const formatTimeSlot = (hour: number, minute: number) => {
    const period = hour < 12 ? "AM" : "PM";
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    const displayMinute = minute.toString().padStart(2, "0");
    return `${displayHour}:${displayMinute} ${period}`;
  };

  const handleTimeSlotClick = (day: Date, hour: number, minute: number) => {
    // Open creation form prefilled with the selected slot
    const dateStr = format(day, "yyyy-MM-dd");
    const timeStr = `${hour.toString().padStart(2, "0")}:${minute
      .toString()
      .padStart(2, "0")}`;

    setNewTaskData({
      taskType: "comment",
      subreddit: "",
      searchKeywords: "",
      prompt: "",
      scheduledDate: dateStr,
      scheduledTime: timeStr,
    });
    setShowNewTaskForm(true);
  };

  const createTask = async () => {
    if (!newTaskData.subreddit.trim() || !newTaskData.prompt.trim()) return;

    try {
      setIsCreatingTask(true);

      const scheduledDateTime = `${newTaskData.scheduledDate}T${newTaskData.scheduledTime}:00`;

      const response = await fetch("/api/reddit/tasks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          projectId,
          scheduledDate: scheduledDateTime,
          taskType: newTaskData.taskType,
          subreddit: newTaskData.subreddit,
          searchKeywords: newTaskData.searchKeywords || undefined,
          prompt: newTaskData.prompt,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create task");
      }

      toast.success("Task created successfully!");
      setShowNewTaskForm(false);
      setNewTaskData({
        taskType: "comment",
        subreddit: "",
        searchKeywords: "",
        prompt: "",
        scheduledDate: "",
        scheduledTime: "",
      });
      onRefresh?.();
    } catch (error) {
      console.error("Error creating task:", error);
      toast.error("Failed to create task. Please try again.");
    } finally {
      setIsCreatingTask(false);
    }
  };

  const cancelTaskCreation = () => {
    setShowNewTaskForm(false);
    setNewTaskData({
      taskType: "comment",
      subreddit: "",
      searchKeywords: "",
      prompt: "",
      scheduledDate: "",
      scheduledTime: "",
    });
  };

  const openTaskModal = (task: RedditTask) => {
    setSelectedTask(task);
    setShowTaskModal(true);
  };

  const closeTaskModal = () => {
    setShowTaskModal(false);
    setSelectedTask(null);
  };

  const handleCopyDraft = async (draft: string) => {
    try {
      await navigator.clipboard.writeText(draft);
      toast.success("AI draft copied to clipboard!");
    } catch (error) {
      console.error("Failed to copy text:", error);
      toast.error("Failed to copy text. Please try again.");
    }
  };

  return (
    <div className="bg-background flex h-full flex-col rounded-lg border">
      {/* Header */}
      <header className="border-border bg-card flex items-center justify-between rounded-t-lg border-b p-4">
        <div className="flex items-center gap-4">
          <h2 className="text-foreground text-xl font-bold">
            Reddit Tasks Calendar
          </h2>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={goToToday}>
              Today
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigateWeek("prev")}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigateWeek("next")}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <span className="text-foreground ml-2 text-lg font-medium">
              {format(weekStart, "MMMM yyyy")}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={handleRefresh}
              disabled={loading}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                router.push("/dashboard/reddit/settings")
              }
            >
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </Button>
          </div>
        </div>
      </header>

      {/* Calendar Grid */}
      <div className="flex-1 overflow-hidden">
        {/* Single internal scroll container for the calendar view */}
        <div className="h-full overflow-auto overscroll-contain">
          {/* Optional empty-state helper above the grid */}
          {!currentWeekHasTasks && (
            <div className="text-muted-foreground px-4 py-2 text-center text-sm">
              No tasks this week — click any slot to create one.
            </div>
          )}
          <div className="grid h-full grid-cols-8">
            {/* Time column */}
            <div className="border-border bg-muted/30 border-r">
              {/* Sticky header for time column */}
              <div className="border-border bg-muted/30 sticky top-0 z-20 h-16 border-b"></div>
              {timeSlots.map((slot) => (
                <div
                  key={slot.index}
                  className={cn(
                    "border-border flex h-12 items-start justify-end border-b pt-1 pr-2",
                  )}
                >
                  <span className="text-muted-foreground text-xs">
                    {slot.hour === 0
                      ? "12 AM"
                      : slot.hour < 12
                        ? `${slot.hour} AM`
                        : slot.hour === 12
                          ? "12 PM"
                          : `${slot.hour - 12} PM`}
                  </span>
                </div>
              ))}
            </div>

            {/* Day columns */}
            {weekDays.map((day) => {
              const tasksForDay = getTasksForDay(day);

              return (
                <div
                  key={day.toISOString()}
                  className="border-border relative border-r"
                >
                  {/* Sticky Day header */}
                  <div className="border-border bg-card sticky top-0 z-10 flex h-16 flex-col items-center justify-center border-b">
                    <span className="text-muted-foreground text-xs uppercase">
                      {format(day, "EEE")}
                    </span>
                    <span
                      className={cn(
                        "text-lg font-medium",
                        isSameDay(day, new Date())
                          ? "bg-primary text-primary-foreground flex h-8 w-8 items-center justify-center rounded-full"
                          : "text-foreground",
                      )}
                    >
                      {format(day, "d")}
                    </span>
                  </div>

                  {/* Time slots (1-hour each) */}
                  <div className="relative">
                    {timeSlots.map((slot) => (
                      <div
                        key={slot.index}
                        className={cn(
                          "border-border relative h-12 cursor-pointer border-b transition-colors",
                          "hover:bg-accent/20",
                          dragOverSlot?.day.getTime() === day.getTime() &&
                            dragOverSlot?.hour === slot.hour &&
                            "bg-primary/20 border-primary/50",
                        )}
                        onClick={() => handleTimeSlotClick(day, slot.hour, 0)}
                        onDragOver={(e) => handleDragOver(e, day, slot.hour, 0)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, day, slot.hour, 0)}
                      >
                        {draggedTask &&
                          dragOverSlot?.day.getTime() === day.getTime() &&
                          dragOverSlot?.hour === slot.hour &&
                          dragOverSlot?.minute === slot.minute && (
                            <div className="bg-primary text-primary-foreground absolute -top-6 left-2 z-10 rounded px-2 py-1 text-xs whitespace-nowrap shadow-lg">
                              {formatTimeSlot(slot.hour, slot.minute)}
                            </div>
                          )}
                      </div>
                    ))}

                    {/* Tasks */}
                    {tasksForDay.map((task) => {
                      const position = getTaskPosition(task);
                      const category = taskCategories[getTaskCategory(task)];
                      const IconComponent = category.icon;

                      return (
                        <div
                          key={task.id}
                          className={cn(
                            "absolute right-1 left-1 cursor-pointer rounded-md border border-white/20 p-2 shadow-sm",
                            category.color,
                            category.textColor,
                            "transition-all hover:shadow-md",
                            draggedTask?.id === task.id &&
                              "scale-95 opacity-50",
                            isUpdatingTask && "pointer-events-none opacity-75",
                            "select-none", // Prevent text selection during drag
                          )}
                          style={position}
                          draggable={!isUpdatingTask}
                          onDragStart={(e) => handleDragStart(e, task)}
                          onDragEnd={handleDragEnd}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!isUpdatingTask) {
                              openTaskModal(task);
                            }
                          }}
                        >
                          <div className="flex items-start gap-2">
                            <IconComponent className="mt-0.5 h-3 w-3 flex-shrink-0" />
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-xs leading-tight font-medium">
                                {task.subreddit}
                              </div>
                              <div className="mt-1 truncate text-xs leading-tight opacity-90">
                                {task.prompt}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* New Task Creation Modal */}
      {showNewTaskForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card max-h-[80vh] w-[30vw] overflow-y-auto rounded-lg p-6 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-foreground text-lg font-semibold">
                Create New Task
              </h2>
              <Button variant="ghost" size="icon" onClick={cancelTaskCreation}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-4">
              <div>
                <Label
                  htmlFor="taskType"
                  className="text-foreground mb-1 block text-sm font-medium"
                >
                  Task Type
                </Label>
                <Select
                  value={newTaskData.taskType}
                  onValueChange={(value: "comment" | "post") =>
                    setNewTaskData((prev) => ({ ...prev, taskType: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="comment">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4" />
                        Comment Task
                      </div>
                    </SelectItem>
                    <SelectItem value="post">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Post Task
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label
                  htmlFor="subreddit"
                  className="text-foreground mb-1 block text-sm font-medium"
                >
                  Subreddit *
                </Label>
                <SubredditAutosuggestions
                  inputId="subreddit"
                  className="w-full"
                  value={newTaskData.subreddit}
                  onChange={(value) =>
                    setNewTaskData((prev) => ({ ...prev, subreddit: value }))
                  }
                  placeholder="Select subreddit"
                  disabled={isCreatingTask}
                />
              </div>

              <div>
                <Label
                  htmlFor="prompt"
                  className="text-foreground mb-1 block text-sm font-medium"
                >
                  Task Description *
                </Label>
                <Textarea
                  id="prompt"
                  placeholder="Describe what to comment or post about..."
                  value={newTaskData.prompt}
                  onChange={(e) =>
                    setNewTaskData((prev) => ({
                      ...prev,
                      prompt: e.target.value,
                    }))
                  }
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label
                    htmlFor="scheduledDate"
                    className="text-foreground mb-1 block text-sm font-medium"
                  >
                    Date
                  </Label>
                  <Input
                    id="scheduledDate"
                    type="date"
                    value={newTaskData.scheduledDate}
                    onChange={(e) =>
                      setNewTaskData((prev) => ({
                        ...prev,
                        scheduledDate: e.target.value,
                      }))
                    }
                  />
                </div>
                <div>
                  <Label
                    htmlFor="scheduledTime"
                    className="text-foreground mb-1 block text-sm font-medium"
                  >
                    Time
                  </Label>
                  <Input
                    id="scheduledTime"
                    type="time"
                    value={newTaskData.scheduledTime}
                    onChange={(e) =>
                      setNewTaskData((prev) => ({
                        ...prev,
                        scheduledTime: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={cancelTaskCreation}
                  className="flex-1 bg-transparent"
                  disabled={isCreatingTask}
                >
                  Cancel
                </Button>
                <Button
                  onClick={createTask}
                  className="flex-1"
                  disabled={
                    !newTaskData.subreddit.trim() ||
                    !newTaskData.prompt.trim() ||
                    isCreatingTask
                  }
                >
                  {isCreatingTask ? "Creating..." : "Create Task"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Task Details Modal */}
      <Dialog open={showTaskModal} onOpenChange={setShowTaskModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              {selectedTask?.taskType === "comment"
                ? "Comment Task"
                : "Post Task"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <h3 className="mb-2 text-sm font-medium">Description</h3>
              <p className="text-foreground mb-2 text-sm">
                {selectedTask?.prompt} <span className="text-xs">{selectedTask?.redditUrl && (
                  <a
                    href={selectedTask.redditUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:text-primary/80 inline-flex items-center gap-1 font-medium transition-colors"
                  >
                    <ExternalLink className="h-3 w-3" />
                    View Original Post
                  </a>
                )}</span>
              </p>
              
            </div>

            {/* AI Draft section - only for comment tasks */}
            {selectedTask?.taskType === "comment" && selectedTask?.aiDraft && (
              <div>
                <div className="mb-2 flex items-center">
                  <h3 className="text-sm font-medium">AI Draft Response</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopyDraft(selectedTask.aiDraft!)}
                    className="h-6 px-2"
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
                <ExpandableAIDraft draft={selectedTask.aiDraft} />
              </div>
            )}
          </div>

          <DialogFooter>
            {selectedTask?.status !== "completed" && (
              <Button
                onClick={async () => {
                  if (selectedTask && onTaskComplete) {
                    try {
                      setIsCompletingTask(true);
                      await onTaskComplete(selectedTask.id);
                      closeTaskModal();
                    } catch (error) {
                      console.error("Error completing task:", error);
                      // Error handling is done in the parent component
                    } finally {
                      setIsCompletingTask(false);
                    }
                  } else if (selectedTask) {
                    // Fallback to original behavior if no completion handler
                    onTaskClick(selectedTask);
                    closeTaskModal();
                  }
                }}
                className="w-full"
                disabled={isCompletingTask}
              >
                {isCompletingTask ? "Completing..." : "Mark Complete"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
