"use client";

import type React from "react";
import { useState, useEffect, useRef } from "react";
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
  Settings,
  Clock,
  MessageSquare,
  FileText,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Copy,
  Trash2,
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
  DialogClose,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { RedditTask, WeeklyTasksResponse } from "@/types";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { GenerateTasksButton } from "./GenerateTasksButton";

// Task layout types
interface TaskLayout {
  left: string;
  width: string;
  zIndex: number;
}

// Interface to track task column positioning during layout calculation
interface TaskWithColumn extends RedditTask {
  columnIndex: number;
}

interface GoogleCalendarProps {
  weekData: WeeklyTasksResponse;
  onTaskClick: (task: RedditTask) => void;
  loading?: boolean;
  onRefresh?: () => void;
  onWeekChange?: (weekStartDate: Date) => void;
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
    icon: Clock,
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
const DEFAULT_SCROLL_TO_HOUR = 4; // Default view starts at 4 AM
// Task visual height equals one-hour slot
const TASK_BLOCK_MINUTES = 60;

// Generate 1-hour time slots within the visible window
const timeSlots = Array.from({ length: VISIBLE_HOURS }, (_, i) => {
  const hour = VISIBLE_START_HOUR + i;
  const minute = 0;
  return { hour, minute, index: i };
});

const calculateTaskLayout = (
  tasksForDay: RedditTask[],
): Map<number, TaskLayout> => {
  const layoutMap = new Map<number, TaskLayout>();

  // Use a fixed 60-minute duration for all tasks, as per the existing UI logic.
  const TASK_DURATION_MS = 60 * 60 * 1000;

  // 1. Sort tasks primarily by start time, then by ID for stable ordering.
  const sortedTasks = [...tasksForDay].sort((a, b) => {
    const startA = new Date(a.scheduledDate).getTime();
    const startB = new Date(b.scheduledDate).getTime();
    if (startA !== startB) {
      return startA - startB;
    }
    return a.id - b.id;
  });

  // 2. Identify groups of overlapping tasks.
  const groups: TaskWithColumn[][] = [];
  if (sortedTasks.length > 0) {
    let currentGroup: TaskWithColumn[] = [sortedTasks[0] as TaskWithColumn];
    let groupEndTime =
      new Date(sortedTasks[0]!.scheduledDate).getTime() + TASK_DURATION_MS;

    for (let i = 1; i < sortedTasks.length; i++) {
      const task = sortedTasks[i] as TaskWithColumn;
      const taskStartTime = new Date(task.scheduledDate).getTime();

      // If the current task starts after the latest end time in the group,
      // the previous group is finished. Start a new one.
      if (taskStartTime >= groupEndTime) {
        groups.push(currentGroup);
        currentGroup = [task];
      } else {
        currentGroup.push(task);
      }

      // Update the group's collective end time.
      groupEndTime = Math.max(groupEndTime, taskStartTime + TASK_DURATION_MS);
    }
    groups.push(currentGroup); // Add the last group.
  }

  // 3. Calculate layout for each group.
  groups.forEach((group) => {
    // This will hold the "columns" of tasks. Each inner array is a column.
    const columns: TaskWithColumn[][] = [];

    group.forEach((task) => {
      const taskStartTime = new Date(task.scheduledDate).getTime();
      let placed = false;

      // Find the first column where this task can fit without collision.
      for (const column of columns) {
        const lastTaskInColumn = column[column.length - 1]!;
        const lastTaskEndTime =
          new Date(lastTaskInColumn.scheduledDate).getTime() + TASK_DURATION_MS;

        if (taskStartTime >= lastTaskEndTime) {
          column.push(task);
          task.columnIndex = columns.indexOf(column);
          placed = true;
          break;
        }
      }

      // If it didn't fit, it needs a new column.
      if (!placed) {
        columns.push([task]);
        task.columnIndex = columns.length - 1;
      }
    });

    const totalColumns = columns.length;

    // 4. Generate CSS properties for each task in the group to create the overlap effect.
    group.forEach((task) => {
      const columnIndex = task.columnIndex;

      // Calculate base width per column
      const baseWidthPercentage = 100 / totalColumns;

      // For visual overlap, make each task slightly wider but ensure no overflow
      // We add overlap only if there are multiple columns and it won't cause overflow
      let visualWidth = baseWidthPercentage;
      let leftPosition = columnIndex * baseWidthPercentage;

      if (totalColumns > 1) {
        // Add small overlap (max 8px equivalent, about 2% of a typical column)
        const overlapPercentage = Math.min(2, baseWidthPercentage * 0.1);
        visualWidth = baseWidthPercentage + overlapPercentage;

        // Adjust left position to create staggered effect but prevent overflow
        const maxLeftAdjustment = Math.min(1, overlapPercentage * 0.5);
        leftPosition =
          columnIndex * baseWidthPercentage - maxLeftAdjustment * columnIndex;

        // Ensure the rightmost task doesn't overflow
        if (leftPosition + visualWidth > 100) {
          visualWidth = 100 - leftPosition;
        }

        // Ensure left position doesn't go negative
        leftPosition = Math.max(0, leftPosition);
      }

      layoutMap.set(task.id, {
        width: `${visualWidth}%`,
        left: `${leftPosition}%`,
        zIndex: 10 + columnIndex, // Tasks in later columns appear on top
      });
    });
  });

  return layoutMap;
};

export function TaskCalendar({
  weekData,
  onTaskClick,
  loading = false,
  onRefresh,
  onWeekChange,
  onTaskUpdate,
  onTaskOptimisticUpdate,
  onTaskComplete,
  projectId,
}: GoogleCalendarProps) {
  const router = useRouter();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const [currentDate, setCurrentDate] = useState(() => {
    // Start with the week data's start date if available, otherwise current date
    try {
      return new Date(weekData.weekStartDate);
    } catch {
      return new Date();
    }
  });

  // Helper function to calculate week start date from the current calendar view
  // This ensures the generate button always targets the currently displayed week
  const getCurrentWeekStart = (): Date => {
    return startOfWeek(currentDate, { weekStartsOn: 1 });
  };

  // Auto-scroll to 4 AM on mount and when week changes
  useEffect(() => {
    if (scrollContainerRef.current) {
      // Each hour slot is 48px high (h-12 = 3rem = 48px)
      const hourHeight = 48;
      const scrollPosition = DEFAULT_SCROLL_TO_HOUR * hourHeight;
      scrollContainerRef.current.scrollTop = scrollPosition;
    }
  }, [weekData.weekStartDate]); // Re-scroll when week changes

  // Sync currentDate with weekData when it changes from external sources
  useEffect(() => {
    try {
      const weekDataStart = new Date(weekData.weekStartDate);
      // Only update if the week data represents a different week than current state
      const currentWeekDataStart = startOfWeek(weekDataStart, {
        weekStartsOn: 1,
      });
      const currentStateWeekStart = startOfWeek(currentDate, {
        weekStartsOn: 1,
      });

      if (currentWeekDataStart.getTime() !== currentStateWeekStart.getTime()) {
        setCurrentDate(weekDataStart);
      }
    } catch {
      // If weekData.weekStartDate is invalid, keep current state
    }
  }, [weekData.weekStartDate, currentDate]);

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
  const [isDeletingTask, setIsDeletingTask] = useState(false);
  const [newTaskData, setNewTaskData] = useState({
    taskType: "comment" as "comment" | "post",
    subreddit: "",
    searchKeywords: "",
    prompt: "",
    scheduledDate: "",
    scheduledTime: "",
  });

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
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
    setCurrentDate((prev) => {
      const newDate =
        direction === "prev" ? subWeeks(prev, 1) : addWeeks(prev, 1);
      const newWeekStart = startOfWeek(newDate, { weekStartsOn: 1 });

      // Notify parent component of week change
      if (onWeekChange) {
        onWeekChange(newWeekStart);
      }

      return newDate;
    });
  };

  const goToToday = () => {
    const today = new Date();
    const todayWeekStart = startOfWeek(today, { weekStartsOn: 1 });

    setCurrentDate(today);

    // Notify parent component of week change
    if (onWeekChange) {
      onWeekChange(todayWeekStart);
    }
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
          const response = await fetch(`/api/reddit/tasks/${taskId}`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              scheduledDate: newScheduledDate.toISOString(),
            }),
          });

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

      // Create a proper Date object and convert to ISO string
      const localDateTime = `${newTaskData.scheduledDate}T${newTaskData.scheduledTime}:00`;
      const scheduledDate = new Date(localDateTime);

      // Convert to ISO string for proper datetime validation
      const scheduledDateTime = scheduledDate.toISOString();

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

  const handleDeleteTask = async (taskId: number) => {
    try {
      setIsDeletingTask(true);

      const response = await fetch(`/api/reddit/tasks/${taskId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete task");
      }

      toast.success("Task deleted successfully!");
      closeTaskModal();
      onRefresh?.();
    } catch (error) {
      console.error("Error deleting task:", error);
      toast.error("Failed to delete task. Please try again.");
    } finally {
      setIsDeletingTask(false);
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
            <Button
              variant="outline"
              size="sm"
              onClick={goToToday}
              disabled={false}
            >
              Today
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigateWeek("prev")}
              disabled={false}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigateWeek("next")}
              disabled={false}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <div className="ml-2 flex items-center gap-2">
              <span className="text-foreground text-lg font-medium">
                {format(weekStart, "MMMM yyyy")}
              </span>
              {loading && (
                <div className="border-primary h-4 w-4 animate-spin rounded-full border-2 border-t-transparent"></div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <GenerateTasksButton
              projectId={projectId}
              weekStartDate={getCurrentWeekStart()}
              onTasksGenerated={() => onRefresh?.()}
              disabled={loading}
            />
            <Button
              variant="outline"
              onClick={() => router.push("/dashboard/reddit/settings")}
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
        <div
          ref={scrollContainerRef}
          className="h-full overflow-auto overscroll-contain"
        >
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

              // Calculate layout for tasks on this day
              const taskLayouts = calculateTaskLayout(tasksForDay);

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
                            <div className="bg-primary text-primary-foreground absolute -top-6 left-2 z-10 rounded px-2 py-1 text-xs whitespace-nowrap">
                              {formatTimeSlot(slot.hour, slot.minute)}
                            </div>
                          )}
                      </div>
                    ))}

                    {/* Tasks */}
                    {tasksForDay.map((task) => {
                      const position = getTaskPosition(task);
                      const taskLayout = taskLayouts.get(task.id);
                      const category = taskCategories[getTaskCategory(task)];
                      const IconComponent = category.icon;

                      return (
                        <div
                          key={task.id}
                          className={cn(
                            "group absolute cursor-pointer rounded-md border p-2",
                            category.color,
                            category.textColor,
                            "task-card-interactive transition-all duration-200 ease-in-out",
                            // Google Calendar-style overlap styling
                            "hover:z-50 hover:scale-105 hover:shadow-lg",
                            "border-white/30",
                            // CRITICAL FIX: Make other tasks non-interactive during drag operation
                            // This allows drop events to reach the time slot underneath
                            !!draggedTask &&
                              draggedTask.id !== task.id &&
                              "pointer-events-none",
                            // Drag states for the original task being dragged
                            draggedTask?.id === task.id &&
                              "z-0 scale-95 opacity-50",
                            isUpdatingTask && "pointer-events-none opacity-75",
                            "select-none", // Prevent text selection during drag
                          )}
                          style={{
                            ...position,
                            ...(taskLayout ?? {
                              left: "2px",
                              width: "calc(100% - 4px)",
                              zIndex: 1,
                            }),
                            // Enhanced z-index management for drag state
                            zIndex:
                              draggedTask?.id === task.id
                                ? 0
                                : (taskLayout?.zIndex ?? 1),
                          }}
                          draggable={!isUpdatingTask}
                          onDragStart={(e) => handleDragStart(e, task)}
                          onDragEnd={handleDragEnd}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!isUpdatingTask) {
                              openTaskModal(task);
                            }
                          }}
                          onMouseEnter={(e) => {
                            // Enhanced hover effects for overlapped tasks
                            if (taskLayout && !draggedTask) {
                              const element = e.currentTarget as HTMLElement;
                              element.style.zIndex = "999";
                              element.style.transform = "scale(1.05)";
                              element.style.boxShadow =
                                "0 12px 32px -8px rgba(0, 0, 0, 0.25), 0 8px 16px -8px rgba(0, 0, 0, 0.15)";
                            }
                          }}
                          onMouseLeave={(e) => {
                            // Restore original styling with smooth transition
                            if (taskLayout && !draggedTask) {
                              const element = e.currentTarget as HTMLElement;
                              element.style.zIndex =
                                taskLayout.zIndex.toString();
                              element.style.transform = "scale(1)";
                              element.style.boxShadow = "";
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

                    {/* Invisible clickable overlay for time slot creation - positioned above tasks */}
                    {timeSlots.map((slot) => {
                      const tasksInSlot = tasksForDay.filter((task) => {
                        const taskDate = new Date(task.scheduledDate);
                        return taskDate.getHours() === slot.hour;
                      });

                      // If there are overlapping tasks in this slot, create a clickable area on the right side
                      if (tasksInSlot.length > 0) {
                        const slotTaskLayouts = tasksInSlot
                          .map((task) => taskLayouts.get(task.id))
                          .filter(
                            (layout): layout is TaskLayout =>
                              layout !== undefined,
                          );

                        if (slotTaskLayouts.length > 0) {
                          const maxTaskLayout = slotTaskLayouts.reduce(
                            (max, layout) => {
                              const maxRight =
                                parseFloat(max.left) + parseFloat(max.width);
                              const layoutRight =
                                parseFloat(layout.left) +
                                parseFloat(layout.width);
                              return layoutRight > maxRight ? layout : max;
                            },
                          );

                          // Create a clickable area to the right of the rightmost task
                          const rightmostPosition =
                            parseFloat(maxTaskLayout.left) +
                            parseFloat(maxTaskLayout.width);
                          const remainingSpace = 100 - rightmostPosition;

                          if (remainingSpace > 10) {
                            // Only show if there's at least 10% space
                            return (
                              <div
                                key={`clickable-${slot.index}`}
                                className="hover:bg-accent/10 absolute h-12 cursor-pointer transition-colors"
                                style={{
                                  top: `${(slot.index * 100) / timeSlots.length}%`,
                                  left: `${rightmostPosition}%`,
                                  width: `${remainingSpace}%`,
                                  zIndex: 999, // Above all tasks
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleTimeSlotClick(day, slot.hour, 0);
                                }}
                                onDragOver={(e) =>
                                  handleDragOver(e, day, slot.hour, 0)
                                }
                                onDragLeave={handleDragLeave}
                                onDrop={(e) => handleDrop(e, day, slot.hour, 0)}
                              >
                                {/* Visual indicator for the clickable area on hover */}
                                <div className="bg-primary/20 h-full w-full rounded-r-md opacity-0 transition-opacity hover:opacity-30" />
                              </div>
                            );
                          }
                        }
                      }
                      return null;
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* New Task Creation Modal */}
      <Dialog open={showNewTaskForm} onOpenChange={setShowNewTaskForm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Task</DialogTitle>
          </DialogHeader>

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
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={cancelTaskCreation}
              disabled={isCreatingTask}
            >
              Cancel
            </Button>
            <Button
              onClick={createTask}
              disabled={
                !newTaskData.subreddit.trim() ||
                !newTaskData.prompt.trim() ||
                isCreatingTask
              }
            >
              {isCreatingTask ? "Creating..." : "Create Task"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Task Details Modal */}
      <Dialog open={showTaskModal} onOpenChange={setShowTaskModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              {selectedTask?.taskType === "comment"
                ? "Comment Task"
                : "Post Task"}
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  selectedTask && handleDeleteTask(selectedTask.id)
                }
                disabled={isDeletingTask}
                className="text-muted-foreground hover:text-foreground hover:bg-muted ml-2 h-6 w-6 p-0"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <h3 className="mb-2 text-sm font-medium">Title:</h3>
              <p className="text-foreground mb-2 text-sm">
                {selectedTask?.prompt}{" "}
                <span className="text-xs">
                  {selectedTask?.taskType === "comment" && selectedTask?.redditUrl && (
                    <a
                      href={selectedTask.redditUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:text-primary/80 inline-flex items-center gap-1 font-medium transition-colors"
                    >
                      <ExternalLink className="h-3 w-3" />
                      View Original Post
                    </a>
                  )}
                  {selectedTask?.taskType === "post" && selectedTask?.subreddit && (
                    <a
                      href={`https://reddit.com/r/${selectedTask.subreddit}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:text-primary/80 inline-flex items-center gap-1 font-medium transition-colors"
                    >
                      <ExternalLink className="h-3 w-3" />
                      {selectedTask.subreddit}
                    </a>
                  )}
                </span>
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
