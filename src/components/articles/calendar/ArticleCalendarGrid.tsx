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
  Calendar,
  Plus,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useProject } from "@/contexts/project-context";
import type { WeeklyArticlesResponse } from "@/app/api/articles/calendar/week/route";

// Calendar display constants
const VISIBLE_START_HOUR = 0; // 12 AM
const VISIBLE_END_HOUR = 24; // 12 AM next day
const VISIBLE_HOURS = VISIBLE_END_HOUR - VISIBLE_START_HOUR;
const DEFAULT_SCROLL_TO_HOUR = 8; // 8 AM
const ARTICLE_DURATION_MINUTES = 60; // 1 hour blocks

// Article with scheduling information
interface ArticleWithScheduling {
  id: number;
  title: string;
  description: string | null;
  status: string;
  projectId: number;
  keywords: unknown;
  targetAudience: string | null;
  publishScheduledAt: Date | null;
  publishedAt: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  generationScheduledAt?: Date | null;
  generationStatus?: string | null;
  generationProgress?: number | null;
}

interface ArticleLayout {
  width: string;
  left: string;
  zIndex: number;
}

interface ArticleWithColumn extends ArticleWithScheduling {
  columnIndex: number;
}

interface TimeSlot {
  day: Date;
  hour: number;
  minute: number;
}

interface ArticleCalendarGridProps {
  weekData: WeeklyArticlesResponse["data"];
  loading?: boolean;
  onTimeSlotClick: (day: Date, hour: number, minute: number) => void;
  onArticleClick: (article: ArticleWithScheduling) => void;
  onArticleDrag: (article: ArticleWithScheduling, targetSlot: TimeSlot) => void;
  onRefresh?: () => void;
  onWeekChange?: (weekStart: Date) => void;
  className?: string;
}

// Calculate layout for overlapping articles (adapted from TaskCalendar)
function calculateArticleLayout(articles: ArticleWithScheduling[]): Map<number, ArticleLayout> {
  const layoutMap = new Map<number, ArticleLayout>();

  if (articles.length === 0) return layoutMap;

  // Convert articles to include column information
  type ArticleWithColumn = ArticleWithScheduling & { columnIndex: number };
  const articlesWithColumns = articles.map(article => ({
    ...article,
    columnIndex: 0
  })) as ArticleWithColumn[];

  // Sort articles by their scheduled time
  const sortedArticles = articlesWithColumns.sort((a, b) => {
    const timeA = getArticleDisplayTime(a).getTime();
    const timeB = getArticleDisplayTime(b).getTime();
    return timeA - timeB;
  });

  const ARTICLE_DURATION_MS = ARTICLE_DURATION_MINUTES * 60 * 1000;

  // Group overlapping articles
  const groups: ArticleWithColumn[][] = [];
  if (sortedArticles.length > 0) {
    let currentGroup: ArticleWithColumn[] = [sortedArticles[0]!];
    let groupEndTime = getArticleDisplayTime(sortedArticles[0]!).getTime() + ARTICLE_DURATION_MS;

    for (let i = 1; i < sortedArticles.length; i++) {
      const article = sortedArticles[i]!;
      const articleStartTime = getArticleDisplayTime(article).getTime();

      if (articleStartTime >= groupEndTime) {
        groups.push(currentGroup);
        currentGroup = [article];
      } else {
        currentGroup.push(article);
      }

      groupEndTime = Math.max(groupEndTime, articleStartTime + ARTICLE_DURATION_MS);
    }
    groups.push(currentGroup);
  }

  // Calculate layout for each group
  groups.forEach((group) => {
    const columns: ArticleWithColumn[][] = [];

    group.forEach((article) => {
      const articleStartTime = getArticleDisplayTime(article).getTime();
      let placed = false;

      for (const column of columns) {
        const lastArticleInColumn = column[column.length - 1]!;
        const lastArticleEndTime = getArticleDisplayTime(lastArticleInColumn).getTime() + ARTICLE_DURATION_MS;

        if (articleStartTime >= lastArticleEndTime) {
          column.push(article);
          article.columnIndex = columns.indexOf(column);
          placed = true;
          break;
        }
      }

      if (!placed) {
        columns.push([article]);
        article.columnIndex = columns.length - 1;
      }
    });

    const totalColumns = columns.length;

    group.forEach((article) => {
      const columnIndex = article.columnIndex;
      const baseWidthPercentage = 100 / totalColumns;

      let visualWidth = baseWidthPercentage;
      let leftPosition = columnIndex * baseWidthPercentage;

      if (totalColumns > 1) {
        const overlapPercentage = Math.min(2, baseWidthPercentage * 0.1);
        visualWidth = baseWidthPercentage + overlapPercentage;

        const maxLeftAdjustment = Math.min(1, overlapPercentage * 0.5);
        leftPosition = columnIndex * baseWidthPercentage - maxLeftAdjustment * columnIndex;

        if (leftPosition + visualWidth > 100) {
          visualWidth = 100 - leftPosition;
        }

        leftPosition = Math.max(0, leftPosition);
      }

      layoutMap.set(article.id, {
        width: `${visualWidth}%`,
        left: `${leftPosition}%`,
        zIndex: 10 + columnIndex,
      });
    });
  });

  return layoutMap;
}

// Get the display time for an article (priority: publishScheduledAt > generationScheduledAt > publishedAt > createdAt)
function getArticleDisplayTime(article: ArticleWithScheduling): Date {
  return new Date(
    article.publishScheduledAt ||
    article.generationScheduledAt ||
    article.publishedAt ||
    article.createdAt
  );
}

// Get article position within the calendar
function getArticlePosition(article: ArticleWithScheduling) {
  const dt = getArticleDisplayTime(article);
  const hour = dt.getHours();
  const minute = dt.getMinutes();

  const minutesFromStart = (hour - VISIBLE_START_HOUR) * 60 + minute;
  const totalVisibleMinutes = VISIBLE_HOURS * 60;
  const heightPercent = (ARTICLE_DURATION_MINUTES / totalVisibleMinutes) * 100;
  const topPercent = (minutesFromStart / totalVisibleMinutes) * 100;

  return {
    height: `${heightPercent}%`,
    top: `${topPercent}%`,
  };
}

// Article status categories for styling
const articleCategories = {
  idea: {
    color: "bg-gray-100 border-gray-300",
    textColor: "text-gray-800",
    label: "Idea",
  },
  scheduled: {
    color: "bg-blue-100 border-blue-300",
    textColor: "text-blue-800",
    label: "Scheduled",
  },
  generating: {
    color: "bg-yellow-100 border-yellow-300",
    textColor: "text-yellow-800",
    label: "Generating",
  },
  "wait_for_publish": {
    color: "bg-green-100 border-green-300",
    textColor: "text-green-800",
    label: "Ready to Publish",
  },
  published: {
    color: "bg-emerald-100 border-emerald-300",
    textColor: "text-emerald-800",
    label: "Published",
  },
  failed: {
    color: "bg-red-100 border-red-300",
    textColor: "text-red-800",
    label: "Failed",
  },
};

export function ArticleCalendarGrid({
  weekData,
  loading = false,
  onTimeSlotClick,
  onArticleClick,
  onArticleDrag,
  onRefresh,
  onWeekChange,
  className,
}: ArticleCalendarGridProps) {
  const { currentProject } = useProject();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const [currentDate, setCurrentDate] = useState(() => {
    try {
      return new Date(weekData.weekStartDate);
    } catch {
      return new Date();
    }
  });

  // Auto-scroll to 8 AM on mount
  useEffect(() => {
    if (scrollContainerRef.current) {
      const hourHeight = 64; // h-16 = 4rem = 64px
      const scrollPosition = DEFAULT_SCROLL_TO_HOUR * hourHeight;
      scrollContainerRef.current.scrollTop = scrollPosition;
    }
  }, [weekData.weekStartDate]);

  // Sync currentDate with weekData
  useEffect(() => {
    try {
      const weekDataStart = new Date(weekData.weekStartDate);
      const currentWeekDataStart = startOfWeek(weekDataStart, { weekStartsOn: 1 });
      const currentStateWeekStart = startOfWeek(currentDate, { weekStartsOn: 1 });

      if (currentWeekDataStart.getTime() !== currentStateWeekStart.getTime()) {
        setCurrentDate(weekDataStart);
      }
    } catch {
      // Keep current state if weekData is invalid
    }
  }, [weekData.weekStartDate, currentDate]);

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const getArticlesForDay = (day: Date): ArticleWithScheduling[] => {
    const dayKey = format(day, "yyyy-MM-dd");
    return weekData.articles[dayKey] ?? [];
  };

  const handlePreviousWeek = () => {
    const prevWeek = subWeeks(currentDate, 1);
    setCurrentDate(prevWeek);
    onWeekChange?.(startOfWeek(prevWeek, { weekStartsOn: 1 }));
  };

  const handleNextWeek = () => {
    const nextWeek = addWeeks(currentDate, 1);
    setCurrentDate(nextWeek);
    onWeekChange?.(startOfWeek(nextWeek, { weekStartsOn: 1 }));
  };

  const handleToday = () => {
    const today = new Date();
    setCurrentDate(today);
    onWeekChange?.(startOfWeek(today, { weekStartsOn: 1 }));
  };

  const handleTimeSlotClick = (day: Date, hour: number) => {
    onTimeSlotClick(day, hour, 0); // Default to start of hour
  };

  // Generate time slots for the left column
  const timeSlots = Array.from({ length: VISIBLE_HOURS }, (_, i) => {
    const hour = VISIBLE_START_HOUR + i;
    return {
      hour,
      label: format(new Date().setHours(hour, 0, 0, 0), "HH:mm"),
    };
  });

  return (
    <div className={cn("flex flex-col h-full bg-background", className)}>
      {/* Header with navigation */}
      <div className="flex-shrink-0 border-b bg-background p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePreviousWeek}
                disabled={loading}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleNextWeek}
                disabled={loading}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleToday}
                disabled={loading}
              >
                Today
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold">
                {format(weekStart, "MMM d")} -{" "}
                {format(addDays(weekStart, 6), "MMM d, yyyy")}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onRefresh && (
              <Button
                variant="outline"
                size="sm"
                onClick={onRefresh}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Refresh"
                )}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="flex-1 flex overflow-hidden">
        {/* Time column */}
        <div className="flex-shrink-0 w-16 border-r bg-muted/30">
          <div className="h-12 border-b" /> {/* Header spacer */}
          <div>
            {timeSlots.map(({ hour, label }) => (
              <div
                key={hour}
                className="h-16 border-b border-border/50 flex items-start justify-end pr-2 pt-1"
              >
                <span className="text-xs text-muted-foreground font-medium">
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Days columns */}
        <div className="flex-1 flex">
          {/* Day headers */}
          <div className="absolute top-0 left-16 right-0 h-12 flex border-b bg-background z-20">
            {weekDays.map((day) => (
              <div
                key={day.toISOString()}
                className="flex-1 border-r border-border/50 last:border-r-0 p-2"
              >
                <div className="text-center">
                  <div className="text-sm font-medium text-foreground">
                    {format(day, "EEE")}
                  </div>
                  <div
                    className={cn(
                      "text-sm",
                      isSameDay(day, new Date())
                        ? "bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center mx-auto mt-1"
                        : "text-muted-foreground mt-1"
                    )}
                  >
                    {format(day, "d")}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Scrollable content */}
          <div
            ref={scrollContainerRef}
            className="flex-1 overflow-y-auto pt-12"
            style={{ height: "calc(100vh - 200px)" }}
          >
            <div className="flex relative">
              {weekDays.map((day) => {
                const dayArticles = getArticlesForDay(day);
                const articleLayout = calculateArticleLayout(dayArticles);

                return (
                  <div
                    key={day.toISOString()}
                    className="flex-1 border-r border-border/50 last:border-r-0 relative"
                  >
                    {/* Time slots for this day */}
                    {timeSlots.map(({ hour }) => (
                      <div
                        key={`${day.toISOString()}-${hour}`}
                        className="h-16 border-b border-border/50 hover:bg-muted/50 cursor-pointer transition-colors"
                        onClick={() => handleTimeSlotClick(day, hour)}
                      >
                        {/* Click area for creating new articles */}
                      </div>
                    ))}

                    {/* Articles positioned absolutely */}
                    {dayArticles.map((article) => {
                      const position = getArticlePosition(article);
                      const layout = articleLayout.get(article.id);
                      const category = articleCategories[article.status as keyof typeof articleCategories] || articleCategories.idea;

                      return (
                        <div
                          key={article.id}
                          className={cn(
                            "absolute p-2 rounded-md border shadow-sm cursor-pointer transition-all hover:shadow-md",
                            category.color,
                            category.textColor
                          )}
                          style={{
                            top: position.top,
                            height: position.height,
                            width: layout?.width || "100%",
                            left: layout?.left || "0%",
                            zIndex: layout?.zIndex || 1,
                            minHeight: "48px",
                          }}
                          onClick={() => onArticleClick(article)}
                        >
                          <div className="text-xs font-medium truncate">
                            {article.title}
                          </div>
                          <div className="text-xs opacity-75 mt-1">
                            {category.label}
                          </div>
                          {article.generationProgress !== undefined && article.generationProgress !== null && article.generationProgress > 0 && (
                            <div className="mt-1">
                              <div className="w-full bg-black/10 rounded-full h-1">
                                <div
                                  className="bg-current h-1 rounded-full transition-all"
                                  style={{ width: `${article.generationProgress}%` }}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}