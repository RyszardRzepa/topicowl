"use client";

import { useState, useEffect, useCallback } from "react";
import { startOfWeek, format } from "date-fns";
import { toast } from "sonner";
import { ArticleCalendarGrid } from "./ArticleCalendarGrid";
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

      {/* TODO: Add ArticleCreationModal component */}
      {showCreationForm && selectedTimeSlot && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background p-6 rounded-lg shadow-lg max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Create New Article</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Scheduled for {format(selectedTimeSlot.day, "MMM d, yyyy")} at{" "}
              {selectedTimeSlot.hour.toString().padStart(2, "0")}:
              {selectedTimeSlot.minute.toString().padStart(2, "0")}
            </p>
            
            {/* Temporary simple form - will be replaced with proper modal component */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const title = formData.get("title") as string;
                
                if (!title.trim()) {
                  toast.error("Please enter a title");
                  return;
                }
                
                const scheduledAt = new Date(selectedTimeSlot.day);
                scheduledAt.setHours(selectedTimeSlot.hour, selectedTimeSlot.minute, 0, 0);
                
                handleCreateArticle({
                  title: title.trim(),
                  description: formData.get("description") as string || undefined,
                  notes: formData.get("notes") as string || undefined,
                  scheduledAt,
                  scheduleType: "generation", // Default to generation scheduling
                });
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium mb-1">
                  Article Title *
                </label>
                <input
                  name="title"
                  type="text"
                  required
                  className="w-full px-3 py-2 border border-input rounded-md"
                  placeholder="Enter article title..."
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">
                  Description
                </label>
                <textarea
                  name="description"
                  rows={3}
                  className="w-full px-3 py-2 border border-input rounded-md"
                  placeholder="Brief description (optional)..."
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">
                  Notes
                </label>
                <textarea
                  name="notes"
                  rows={2}
                  className="w-full px-3 py-2 border border-input rounded-md"
                  placeholder="Notes for AI generation (optional)..."
                />
              </div>
              
              <div className="flex gap-2 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90"
                >
                  Create Article
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreationForm(false);
                    setSelectedTimeSlot(null);
                  }}
                  className="px-4 py-2 border border-input rounded-md hover:bg-muted"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TODO: Add ArticleDetailModal component */}
      {showArticleModal && selectedArticle && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background p-6 rounded-lg shadow-lg max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Article Details</h3>
            
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-muted-foreground">
                  Title
                </label>
                <p className="text-sm">{selectedArticle.title}</p>
              </div>
              
              {selectedArticle.description && (
                <div>
                  <label className="block text-sm font-medium text-muted-foreground">
                    Description
                  </label>
                  <p className="text-sm">{selectedArticle.description}</p>
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-muted-foreground">
                  Status
                </label>
                <p className="text-sm capitalize">{selectedArticle.status.replace("_", " ")}</p>
              </div>
              
              {selectedArticle.generationProgress !== undefined && selectedArticle.generationProgress !== null && selectedArticle.generationProgress > 0 && (
                <div>
                  <label className="block text-sm font-medium text-muted-foreground">
                    Generation Progress
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-muted rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full transition-all"
                        style={{ width: `${selectedArticle.generationProgress}%` }}
                      />
                    </div>
                    <span className="text-sm">{selectedArticle.generationProgress}%</span>
                  </div>
                </div>
              )}
            </div>
            
            <div className="flex gap-2 pt-6">
              <button
                onClick={() => {
                  setShowArticleModal(false);
                  setSelectedArticle(null);
                }}
                className="flex-1 px-4 py-2 border border-input rounded-md hover:bg-muted"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}