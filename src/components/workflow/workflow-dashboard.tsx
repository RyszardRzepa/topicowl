"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { WorkflowTabs } from "./workflow-tabs";
import { PlanningHub } from "./planning-hub";
import { ArticleGenerations } from "./article-generations";
import { PublishingPipeline } from "./publishing-pipeline";
import { useGenerationPolling } from "@/hooks/use-generation-polling";
import type { Article, WorkflowPhase } from "@/types";
import type {
  DatabaseArticle,
  KanbanColumn,
} from "@/app/api/articles/board/route";

interface WorkflowDashboardProps {
  className?: string;
}

export function WorkflowDashboard({ className }: WorkflowDashboardProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<WorkflowPhase>("planning");
  const [articles, setArticles] = useState<Article[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Transform database article to domain Article type
  const transformDatabaseArticle = (dbArticle: DatabaseArticle): Article => ({
    id: dbArticle.id.toString(),
    title: dbArticle.title,
    content: dbArticle.optimizedContent ?? dbArticle.draft ?? undefined,
    status: dbArticle.status,
    keywords: Array.isArray(dbArticle.keywords)
      ? (dbArticle.keywords as string[])
      : [],
    createdAt:
      dbArticle.createdAt instanceof Date
        ? dbArticle.createdAt.toISOString()
        : dbArticle.createdAt,
    updatedAt:
      dbArticle.updatedAt instanceof Date
        ? dbArticle.updatedAt.toISOString()
        : dbArticle.updatedAt,
    generationProgress: dbArticle.generationProgress ?? 0,
    estimatedReadTime: dbArticle.estimatedReadTime ?? undefined,
    views: dbArticle.views ?? 0,
    clicks: dbArticle.clicks ?? 0,
    generationScheduledAt:
      dbArticle.generationScheduledAt instanceof Date
        ? dbArticle.generationScheduledAt.toISOString()
        : (dbArticle.generationScheduledAt ?? undefined),
    generationStartedAt:
      dbArticle.generationStartedAt instanceof Date
        ? dbArticle.generationStartedAt.toISOString()
        : (dbArticle.generationStartedAt ?? undefined),
    generationCompletedAt:
      dbArticle.generationCompletedAt instanceof Date
        ? dbArticle.generationCompletedAt.toISOString()
        : (dbArticle.generationCompletedAt ?? undefined),
    publishScheduledAt:
      dbArticle.scheduledAt instanceof Date
        ? dbArticle.scheduledAt.toISOString()
        : (dbArticle.scheduledAt ?? undefined),
    publishedAt:
      dbArticle.publishedAt instanceof Date
        ? dbArticle.publishedAt.toISOString()
        : (dbArticle.publishedAt ?? undefined),
  });

  // Fetch articles from API
  const fetchArticles = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/articles/board");
      if (!response.ok) {
        throw new Error("Failed to fetch articles");
      }

      // Transform kanban board response to flat articles array
      const response_data: unknown = await response.json();

      // Type guard to ensure we have the correct response structure
      if (!Array.isArray(response_data)) {
        throw new Error("Invalid response format");
      }

      // Type assertion after validation
      const data = response_data as KanbanColumn[];
      const allArticles: Article[] = [];

      data.forEach((column) => {
        column.articles.forEach((dbArticle) => {
          allArticles.push(transformDatabaseArticle(dbArticle));
        });
      });

      setArticles(allArticles);
      setError(null);
    } catch (error) {
      console.error("Failed to load articles:", error);
      setError("Failed to load articles");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Get currently generating articles
  const generatingArticles = articles.filter(article => article.status === 'generating');
  
  // Handle generation status updates
  const handleGenerationStatusUpdate = useCallback((articleId: string, statusData: { progress?: number; phase?: 'research' | 'writing' | 'validation' | 'optimization'; error?: string }) => {
    setArticles(prevArticles => 
      prevArticles.map(article => 
        article.id === articleId 
          ? {
              ...article,
              generationProgress: statusData.progress,
              generationPhase: statusData.phase,
              generationError: statusData.error,
            }
          : article
      )
    );
  }, []);

  const handleGenerationComplete = useCallback((_articleId: string) => {
    // Refresh articles to get the updated status
    void fetchArticles();
  }, [fetchArticles]);

  const handleGenerationError = useCallback((articleId: string, error: string) => {
    setArticles(prevArticles => 
      prevArticles.map(article => 
        article.id === articleId 
          ? {
              ...article,
              generationError: error,
            }
          : article
      )
    );
  }, []);

  // Use polling for the first generating article as an example
  // In a real implementation, you'd need a more sophisticated approach for multiple articles
  const firstGeneratingArticle = generatingArticles[0];
  useGenerationPolling({
    articleId: firstGeneratingArticle?.id ?? '',
    enabled: !!firstGeneratingArticle && !firstGeneratingArticle.generationError,
    onStatusUpdate: (statusData) => handleGenerationStatusUpdate(firstGeneratingArticle?.id ?? '', statusData),
    onComplete: () => handleGenerationComplete(firstGeneratingArticle?.id ?? ''),
    onError: (error) => handleGenerationError(firstGeneratingArticle?.id ?? '', error),
  });

  useEffect(() => {
    void fetchArticles();
  }, [fetchArticles]);

  // Refresh when returning from article preview
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        const statusChange = sessionStorage.getItem("articleStatusChanged");
        if (statusChange) {
          sessionStorage.removeItem("articleStatusChanged");
          void fetchArticles();
        }
      }
    };

    const handleFocus = () => {
      const statusChange = sessionStorage.getItem("articleStatusChanged");
      if (statusChange) {
        sessionStorage.removeItem("articleStatusChanged");
        void fetchArticles();
      }
    };

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "articleStatusChanged" && e.newValue) {
        void fetchArticles();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("storage", handleStorageChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [fetchArticles]);

  // Article action handlers
  const handleCreateArticle = async (data: {
    title: string;
    keywords?: string[];
  }) => {
    try {
      const response = await fetch("/api/articles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: data.title,
          description: "Click to edit this article idea",
          keywords: data.keywords ?? [],
          priority: "medium",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create article");
      }

      await fetchArticles(); // Refresh articles
    } catch (error) {
      console.error("Failed to create article:", error);
      setError("Failed to create article");
    }
  };

  const handleUpdateArticle = async (
    articleId: string,
    updates: Partial<Article>,
  ) => {
    try {
      const response = await fetch(`/api/articles/${articleId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error("Failed to update article");
      }

      // Optimistic update
      setArticles((prev) =>
        prev.map((article) =>
          article.id === articleId ? { ...article, ...updates } : article,
        ),
      );
    } catch (error) {
      console.error("Failed to update article:", error);
      setError("Failed to update article");
      await fetchArticles(); // Revert on error
    }
  };

  const handleDeleteArticle = async (articleId: string) => {
    try {
      const response = await fetch(`/api/articles/${articleId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete article");
      }

      // Optimistic update
      setArticles((prev) => prev.filter((article) => article.id !== articleId));
    } catch (error) {
      console.error("Failed to delete article:", error);
      setError("Failed to delete article");
      await fetchArticles(); // Revert on error
    }
  };

  const handleGenerateArticle = async (articleId: string) => {
    try {
      const response = await fetch("/api/articles/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleId }),
      });

      if (!response.ok) {
        throw new Error("Failed to start article generation");
      }

      // Optimistic update to generating status
      setArticles((prev) =>
        prev.map((article) =>
          article.id === articleId
            ? { ...article, status: "generating", generationProgress: 0 }
            : article,
        ),
      );
    } catch (error) {
      console.error("Failed to generate article:", error);
      setError("Failed to generate article");
    }
  };

  const handleScheduleGeneration = async (
    articleId: string,
    scheduledAt: Date,
  ) => {
    try {
      const response = await fetch("/api/articles/schedule-generation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          articleId: parseInt(articleId),
          generationScheduledAt: scheduledAt.toISOString(),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to schedule generation");
      }

      // Optimistic update
      setArticles((prev) =>
        prev.map((article) =>
          article.id === articleId
            ? { ...article, generationScheduledAt: scheduledAt.toISOString() }
            : article,
        ),
      );
    } catch (error) {
      console.error("Failed to schedule generation:", error);
      setError("Failed to schedule generation");
    }
  };

  const handlePublishArticle = async (articleId: string) => {
    try {
      // Update article status to published
      await handleUpdateArticle(articleId, {
        status: "published",
        publishedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Failed to publish article:", error);
      setError("Failed to publish article");
    }
  };

  const handleSchedulePublishing = async (
    articleId: string,
    scheduledAt: Date,
  ) => {
    try {
      // Update article with scheduled publish time
      await handleUpdateArticle(articleId, {
        publishScheduledAt: scheduledAt.toISOString(),
      });
    } catch (error) {
      console.error("Failed to schedule publishing:", error);
      setError("Failed to schedule publishing");
    }
  };

  const handleBulkGenerate = async (articleIds: string[]) => {
    // For now, generate each article individually
    for (const articleId of articleIds) {
      await handleGenerateArticle(articleId);
    }
  };

  const handleBulkScheduleGeneration = async (
    articleIds: string[],
    scheduledAt: Date,
  ) => {
    // For now, schedule each article individually
    for (const articleId of articleIds) {
      await handleScheduleGeneration(articleId, scheduledAt);
    }
  };

  const handleBulkPublish = async (articleIds: string[]) => {
    // For now, publish each article individually
    for (const articleId of articleIds) {
      await handlePublishArticle(articleId);
    }
  };

  const handleBulkSchedulePublishing = async (
    articleIds: string[],
    scheduledAt: Date,
  ) => {
    // For now, schedule each article individually
    for (const articleId of articleIds) {
      await handleSchedulePublishing(articleId, scheduledAt);
    }
  };

  const handleNavigateToArticle = (articleId: string) => {
    router.push(`/articles/${articleId}`);
  };

  // Count articles for each phase
  const planningArticles = articles.filter(
    (a) => a.status === "idea" || a.status === "to_generate",
  );
  const generationsArticles = articles.filter(
    (a) => 
      a.status === "generating" || 
      (a.generationScheduledAt && a.status === "to_generate") ||
      (a.status === "wait_for_publish" && a.generationCompletedAt) ||
      a.generationError,
  );
  const publishingArticles = articles.filter(
    (a) => a.status === "wait_for_publish" || a.status === "published",
  );

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-gray-900"></div>
          <p className="mt-2 text-gray-600">Loading workflow dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="text-center">
          <p className="mb-4 text-red-600">{error}</p>
          <button
            onClick={fetchArticles}
            className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Content Workflow</h1>
        <p className="mt-1 text-sm text-gray-600">
          Manage your article creation and publishing pipeline
        </p>
      </div>

      <WorkflowTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
        planningCount={planningArticles.length}
        generationsCount={generationsArticles.length}
        publishingCount={publishingArticles.length}
      />

      {activeTab === "planning" && (
        <PlanningHub
          articles={planningArticles}
          onCreateArticle={handleCreateArticle}
          onUpdateArticle={handleUpdateArticle}
          onDeleteArticle={handleDeleteArticle}
          onGenerateArticle={handleGenerateArticle}
          onScheduleGeneration={handleScheduleGeneration}
          onBulkGenerate={handleBulkGenerate}
          onBulkSchedule={handleBulkScheduleGeneration}
          onNavigateToArticle={handleNavigateToArticle}
        />
      )}

      {activeTab === "generations" && (
        <ArticleGenerations
          articles={generationsArticles}
          onRetryGeneration={handleGenerateArticle}
          onNavigateToArticle={handleNavigateToArticle}
        />
      )}

      {activeTab === "publishing" && (
        <PublishingPipeline
          articles={publishingArticles}
          onUpdateArticle={handleUpdateArticle}
          onPublishArticle={handlePublishArticle}
          onSchedulePublishing={handleSchedulePublishing}
          onBulkPublish={handleBulkPublish}
          onBulkSchedule={handleBulkSchedulePublishing}
          onNavigateToArticle={handleNavigateToArticle}
        />
      )}
    </div>
  );
}
