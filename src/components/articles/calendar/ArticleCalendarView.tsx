"use client";

import { useState, useEffect, useCallback } from "react";
import { startOfWeek, format } from "date-fns";
import { toast } from "sonner";
import { ArticleCalendarGrid } from "./ArticleCalendarGrid";
import { ArticleCreationModal } from "./ArticleCreationModal";
import { ArticleDetailModal } from "./ArticleDetailModal";
import { useProject } from "@/contexts/project-context";
import type { WeeklyArticlesResponse } from "@/app/api/articles/calendar/week/route";

interface ArticleCalendarViewProps {
  className?: string;
}

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

interface TimeSlot {
  day: Date;
  hour: number;
  minute: number;
}

export function ArticleCalendarView({ className }: ArticleCalendarViewProps) {
  const { currentProject } = useProject();
  const [currentWeek, setCurrentWeek] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [weeklyData, setWeeklyData] = useState<WeeklyArticlesResponse["data"]>({
    weekStartDate: format(currentWeek, "yyyy-MM-dd"),
    articles: {},
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // State for article creation modal
  const [showCreationForm, setShowCreationForm] = useState(false);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<TimeSlot | null>(null);
  
  // State for article detail modal
  const [selectedArticle, setSelectedArticle] = useState<ArticleWithScheduling | null>(null);
  const [showArticleModal, setShowArticleModal] = useState(false);

  // Fetch articles for the current week
  const fetchWeeklyArticles = useCallback(async () => {
    if (!currentProject) return;

    setLoading(true);
    setError(null);

    try {
      const weekStartDate = format(currentWeek, "yyyy-MM-dd");
      const response = await fetch(
        `/api/articles/calendar/week?weekStartDate=${weekStartDate}&projectId=${currentProject.id}`,
      );

      if (!response.ok) {
        throw new Error("Failed to fetch weekly articles");
      }

      const data: WeeklyArticlesResponse = await response.json();
      
      if (!data.success) {
        throw new Error("Failed to fetch weekly articles");
      }

      setWeeklyData(data.data);
    } catch (err) {
      console.error("Error fetching weekly articles:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch articles");
      toast.error("Failed to fetch articles");
    } finally {
      setLoading(false);
    }
  }, [currentProject, currentWeek]);

  // Fetch data when component mounts or dependencies change
  useEffect(() => {
    if (currentProject) {
      fetchWeeklyArticles();
    }
  }, [fetchWeeklyArticles, currentProject]);

  // Handle week navigation
  const handleWeekChange = (newWeekStart: Date) => {
    setCurrentWeek(newWeekStart);
  };

  // Handle time slot clicks (create new article)
  const handleTimeSlotClick = (day: Date, hour: number, minute: number) => {
    if (!currentProject) {
      toast.error("Please select a project first");
      return;
    }

    setSelectedTimeSlot({ day, hour, minute });
    setShowCreationForm(true);
  };

  // Handle article clicks (view/edit article)
  const handleArticleClick = (article: ArticleWithScheduling) => {
    setSelectedArticle(article);
    setShowArticleModal(true);
  };

  // Handle article drag and drop (reschedule)
  const handleArticleDrag = async (article: ArticleWithScheduling, targetSlot: TimeSlot) => {
    try {
      // Calculate new scheduled time
      const newScheduledTime = new Date(targetSlot.day);
      newScheduledTime.setHours(targetSlot.hour, targetSlot.minute, 0, 0);

      // Determine if this is a generation or publishing reschedule
      // If article has generation scheduling, reschedule generation
      // Otherwise, reschedule publishing
      const scheduleType = article.generationScheduledAt || article.status === 'scheduled' 
        ? 'generation' 
        : 'publishing';

      const response = await fetch(`/api/articles/${article.id}/reschedule`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          scheduledAt: newScheduledTime.toISOString(),
          scheduleType,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to reschedule article");
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || "Failed to reschedule article");
      }

      toast.success("Article rescheduled successfully");
      
      // Refresh the calendar data
      fetchWeeklyArticles();
    } catch (err) {
      console.error("Error rescheduling article:", err);
      toast.error(err instanceof Error ? err.message : "Failed to reschedule article");
    }
  };

  // Handle article creation
  const handleCreateArticle = async (articleData: {
    title: string;
    description?: string;
    keywords?: string[];
    targetAudience?: string;
    notes?: string;
    scheduledAt?: Date;
    scheduleType?: 'generation' | 'publishing';
  }) => {
    if (!currentProject) {
      toast.error("Please select a project first");
      return;
    }

    try {
      const requestBody: any = {
        title: articleData.title,
        description: articleData.description,
        keywords: articleData.keywords,
        targetAudience: articleData.targetAudience,
        notes: articleData.notes,
        projectId: currentProject.id,
      };

      // Add scheduling parameters if provided
      if (articleData.scheduledAt) {
        if (articleData.scheduleType === 'generation') {
          requestBody.generationScheduledAt = articleData.scheduledAt.toISOString();
        } else {
          requestBody.publishScheduledAt = articleData.scheduledAt.toISOString();
        }
      }

      const response = await fetch("/api/articles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error("Failed to create article");
      }

      const newArticle = await response.json();
      
      toast.success("Article created successfully");
      
      // Close the creation form
      setShowCreationForm(false);
      setSelectedTimeSlot(null);
      
      // Refresh the calendar data
      fetchWeeklyArticles();
    } catch (err) {
      console.error("Error creating article:", err);
      toast.error(err instanceof Error ? err.message : "Failed to create article");
    }
  };

  if (!currentProject) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <p className="text-muted-foreground">
            Please select a project to view the article calendar.
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <p className="text-destructive mb-4">{error}</p>
          <button
            onClick={() => fetchWeeklyArticles()}
            className="text-primary hover:underline"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <ArticleCalendarGrid
        weekData={weeklyData}
        loading={loading}
        onTimeSlotClick={handleTimeSlotClick}
        onArticleClick={handleArticleClick}
        onArticleDrag={handleArticleDrag}
        onRefresh={fetchWeeklyArticles}
        onWeekChange={handleWeekChange}
      />

      <ArticleCreationModal
        open={showCreationForm}
        onClose={() => {
          setShowCreationForm(false);
          setSelectedTimeSlot(null);
        }}
        timeSlot={selectedTimeSlot}
        onCreateArticle={handleCreateArticle}
      />

      <ArticleDetailModal
        open={showArticleModal}
        onClose={() => {
          setShowArticleModal(false);
          setSelectedArticle(null);
        }}
        article={selectedArticle}
      />
    </div>
  );
}