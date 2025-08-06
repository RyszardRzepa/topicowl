"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { WorkflowTabs } from "./workflow-tabs";
import { PlanningHub } from "./planning-hub";
import { ArticleGenerations } from "./article-generations";
import { PublishingPipeline } from "./publishing-pipeline";
import { useGenerationPolling } from "@/hooks/use-generation-polling";
import { toast } from "sonner";
import type { Article, WorkflowPhase } from "@/types";
import type {
  DatabaseArticle,
  KanbanColumn,
} from "@/app/api/articles/board/route";
import type { ScheduleGenerationResponse } from "@/app/api/articles/schedule-generation/route";
import type { SchedulePublishingResponse } from "@/app/api/articles/schedule-publishing/route";

interface WorkflowDashboardProps {
  className?: string;
}

export function WorkflowDashboard({ className }: WorkflowDashboardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  // Get active tab from URL search params, fallback to 'planning'
  const getValidTab = (tab: string | null): WorkflowPhase => {
    if (tab === "planning" || tab === "generations" || tab === "publishing") {
      return tab;
    }
    return "planning";
  };

  const activeTabFromUrl = getValidTab(searchParams.get("tab"));
  const [activeTab, setActiveTab] = useState<WorkflowPhase>(activeTabFromUrl);
  const [articles, setArticles] = useState<Article[]>([]);
  const [, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Function to update URL when tab changes
  const handleTabChange = (newTab: WorkflowPhase) => {
    setActiveTab(newTab);
    const newSearchParams = new URLSearchParams(searchParams.toString());
    newSearchParams.set("tab", newTab);
    router.push(`${pathname}?${newSearchParams.toString()}`, { scroll: false });
  };

  // Sync activeTab with URL changes (e.g., browser back/forward)
  useEffect(() => {
    const urlTab = getValidTab(searchParams.get("tab"));
    if (urlTab !== activeTab) {
      setActiveTab(urlTab);
    }
  }, [searchParams, activeTab]);

  // Transform database article to domain Article type
  const transformDatabaseArticle = (dbArticle: DatabaseArticle): Article => {
    // Auto-correct status for completed generations that should be in publishing pipeline
    let correctedStatus = dbArticle.status;
    if (
      dbArticle.generationStatus === 'completed' &&
      dbArticle.generationProgress === 100 &&
      (dbArticle.status === 'scheduled' || dbArticle.status === 'generating')
    ) {
      correctedStatus = 'wait_for_publish';
      console.log(`Auto-correcting article ${dbArticle.id} status from ${dbArticle.status} to wait_for_publish`);
    }

    return {
      id: dbArticle.id.toString(),
      title: dbArticle.title,
      content: dbArticle.content ?? dbArticle.draft ?? undefined,
      status: correctedStatus,
      keywords: Array.isArray(dbArticle.keywords)
        ? (dbArticle.keywords as string[])
        : [],
      notes: dbArticle.notes ?? undefined,
      createdAt:
        dbArticle.createdAt instanceof Date
          ? dbArticle.createdAt.toISOString()
          : dbArticle.createdAt,
      updatedAt:
        dbArticle.updatedAt instanceof Date
          ? dbArticle.updatedAt.toISOString()
          : dbArticle.updatedAt,
      generationProgress: typeof dbArticle.generationProgress === 'number' ? dbArticle.generationProgress : 0,
      // Map generation status to phase for UI display
      generationPhase: dbArticle.generationStatus === 'researching' ? 'research' :
                      dbArticle.generationStatus === 'writing' ? 'writing' :
                      dbArticle.generationStatus === 'validating' ? 'validation' :
                      dbArticle.generationStatus === 'updating' ? 'optimization' :
                      undefined,
      generationError: dbArticle.generationError ?? undefined,
      estimatedReadTime: dbArticle.estimatedReadTime ?? undefined,
      views: 0, // Not tracked in database yet
      clicks: 0, // Not tracked in database yet
      generationScheduledAt:
        dbArticle.generationScheduledAt instanceof Date
          ? dbArticle.generationScheduledAt.toISOString()
          : typeof dbArticle.generationScheduledAt === "string"
            ? dbArticle.generationScheduledAt
            : undefined,
      generationStartedAt: undefined, // Will be populated when generation tracking is added
      generationCompletedAt: undefined, // Will be populated when generation tracking is added
      publishScheduledAt:
        dbArticle.scheduledAt instanceof Date
          ? dbArticle.scheduledAt.toISOString()
          : typeof dbArticle.scheduledAt === "string"
            ? dbArticle.scheduledAt
            : undefined,
      publishedAt:
        dbArticle.publishedAt instanceof Date
          ? dbArticle.publishedAt.toISOString()
          : typeof dbArticle.publishedAt === "string"
            ? dbArticle.publishedAt
            : undefined,
    };
  };

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
  const generatingArticles = articles.filter(
    (article) => article.status === "generating",
  );

  // Handle generation status updates
  const handleGenerationStatusUpdate = useCallback(
    (
      articleId: string,
      statusData: {
        progress?: number;
        phase?: "research" | "writing" | "validation" | "optimization";
        error?: string;
      },
    ) => {
      setArticles((prevArticles) =>
        prevArticles.map((article) =>
          article.id === articleId
            ? {
                ...article,
                generationProgress: statusData.progress,
                generationPhase: statusData.phase,
                generationError: statusData.error,
              }
            : article,
        ),
      );
    },
    [],
  );

  const handleGenerationComplete = useCallback(
    (articleId: string) => {
      const article = articles.find(a => a.id === articleId);
      
      toast.success("Article generation completed!", {
        description: article ? `"${article.title}" is ready for publishing.` : "Your article is ready for publishing.",
      });
      
      // Refresh articles to get the updated status
      void fetchArticles();
    },
    [fetchArticles, articles],
  );

  const handleGenerationError = useCallback(
    (articleId: string, error: string) => {
      const article = articles.find(a => a.id === articleId);
      
      toast.error("Article generation failed", {
        description: article ? `"${article.title}" failed to generate: ${error}` : `Generation failed: ${error}`,
      });
      
      setArticles((prevArticles) =>
        prevArticles.map((article) =>
          article.id === articleId
            ? {
                ...article,
                generationError: error,
              }
            : article,
        ),
      );
    },
    [articles],
  );

  // Use polling for the first generating article as an example
  // In a real implementation, you'd need a more sophisticated approach for multiple articles
  const firstGeneratingArticle = generatingArticles[0];
  
  // Don't poll if user is on an article page (to avoid duplicate polling)
  const isOnArticlePage = pathname.startsWith('/articles/') || pathname.startsWith('/dashboard/articles/');
  
  useGenerationPolling({
    articleId: firstGeneratingArticle?.id ?? "",
    enabled:
      !!firstGeneratingArticle && 
      !firstGeneratingArticle.generationError &&
      !isOnArticlePage, // Disable if on article page
    intervalMs: 45000, // Poll less frequently from dashboard (45 seconds)
    onStatusUpdate: (statusData) =>
      handleGenerationStatusUpdate(
        firstGeneratingArticle?.id ?? "",
        {
          progress: statusData.progress,
          phase: statusData.phase as "research" | "writing" | "validation" | "optimization" | undefined,
          error: statusData.error,
        },
      ),
    onComplete: () =>
      handleGenerationComplete(firstGeneratingArticle?.id ?? ""),
    onError: (error) =>
      handleGenerationError(firstGeneratingArticle?.id ?? "", error),
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
    description?: string;
    targetAudience?: string;
    notes?: string;
  }) => {
    try {
      const response = await fetch("/api/articles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: data.title,
          description: data.description ?? "Click to edit this article idea",
          keywords: data.keywords ?? [],
          targetAudience: data.targetAudience,
          notes: data.notes,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create article");
      }

      toast.success("Article idea created successfully!", {
        description: `"${data.title}" has been added to your planning phase.`,
      });
      await fetchArticles(); // Refresh articles
    } catch (error) {
      console.error("Failed to create article:", error);
      toast.error("Failed to create article", {
        description: "Please try again or check your connection.",
      });
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
      toast.error("Failed to update article", {
        description: "Please try again or check your connection.",
      });
      setError("Failed to update article");
      await fetchArticles(); // Revert on error
    }
  };

  const handleDeleteArticle = async (articleId: string) => {
    try {
      const articleToDelete = articles.find(a => a.id === articleId);
      const response = await fetch(`/api/articles/${articleId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete article");
      }

      // Optimistic update
      setArticles((prev) => prev.filter((article) => article.id !== articleId));
      
      toast.success("Article deleted successfully!", {
        description: articleToDelete ? `"${articleToDelete.title}" has been removed.` : undefined,
      });
    } catch (error) {
      console.error("Failed to delete article:", error);
      toast.error("Failed to delete article", {
        description: "Please try again or check your connection.",
      });
      setError("Failed to delete article");
      await fetchArticles(); // Revert on error
    }
  };

  const handleGenerateArticle = async (articleId: string) => {
    try {
      const article = articles.find(a => a.id === articleId);
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
      
      toast.success("Article generation started!", {
        description: article ? `Generating "${article.title}"...` : "Your article is being generated.",
      });
    } catch (error) {
      console.error("Failed to generate article:", error);
      toast.error("Failed to start article generation", {
        description: "Please try again or check your connection.",
      });
      setError("Failed to generate article");
    }
  };

  const handleScheduleGeneration = async (
    articleId: string,
    scheduledAt: Date,
  ) => {
    try {
      const article = articles.find(a => a.id === articleId);
      const response = await fetch("/api/articles/schedule-generation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          articleId: parseInt(articleId),
          scheduledAt: scheduledAt.toISOString(),
        }),
      });

      const result = await response.json() as ScheduleGenerationResponse;

      if (!response.ok || !result.success) {
        throw new Error(result.error ?? "Failed to schedule generation");
      }

      // Optimistic update - ensure the article moves to the correct tab
      setArticles((prev) => {
        const updated = prev.map((article) =>
          article.id === articleId
            ? {
                ...article,
                generationScheduledAt: scheduledAt.toISOString(),
                // Ensure status is correct for scheduled articles
                status:
                  article.status === "idea" ? "to_generate" : article.status,
              }
            : article,
        );
        return updated;
      });
      
      const formattedDate = scheduledAt.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
      
      toast.success("Generation scheduled successfully!", {
        description: article 
          ? `"${article.title}" will be generated on ${formattedDate}.`
          : `Article will be generated on ${formattedDate}.`,
      });
    } catch (error) {
      console.error("Failed to schedule generation:", error);
      toast.error("Failed to schedule generation", {
        description: "Please try again or check your connection.",
      });
      setError("Failed to schedule generation");
    }
  };

  const handlePublishArticle = async (articleId: string) => {
    try {
      const article = articles.find(a => a.id === articleId);
      
      // Call the dedicated publish API endpoint
      const response = await fetch("/api/articles/publish", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          articleId: articleId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json() as { error?: string };
        throw new Error(errorData.error ?? "Failed to publish article");
      }
      
      // Optimistic update - the publish API handles database updates
      setArticles((prev) =>
        prev.map((a) =>
          a.id === articleId
            ? {
                ...a,
                status: "published",
                publishedAt: new Date().toISOString(),
                publishScheduledAt: undefined, // Clear scheduled time
              }
            : a,
        ),
      );
      
      toast.success("Article published successfully!", {
        description: article ? `"${article.title}" is now live.` : "Your article is now live.",
      });
    } catch (error) {
      console.error("Failed to publish article:", error);
      toast.error("Failed to publish article", {
        description: "Please try again or check your connection.",
      });
      setError("Failed to publish article");
      // Revert optimistic update on error
      await fetchArticles();
    }
  };

  const handleSchedulePublishing = async (
    articleId: string,
    scheduledAt: Date,
  ) => {
    try {
      const article = articles.find(a => a.id === articleId);
      
      // Use the new dedicated publishing endpoint
      const response = await fetch("/api/articles/schedule-publishing", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          articleId: parseInt(articleId),
          publishAt: scheduledAt.toISOString(),
        }),
      });

      const result = await response.json() as SchedulePublishingResponse | { error: string };

      if (!response.ok) {
        const errorMessage = 'error' in result ? result.error : "Failed to schedule publishing";
        throw new Error(errorMessage);
      }

      if (!('success' in result) || !result.success) {
        throw new Error("Failed to schedule publishing");
      }

      // Update local state optimistically
      setArticles((prev) =>
        prev.map((a) =>
          a.id === articleId
            ? { ...a, publishScheduledAt: scheduledAt.toISOString() }
            : a,
        ),
      );
      
      const formattedDate = scheduledAt.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
      
      toast.success("Publishing scheduled successfully!", {
        description: article 
          ? `"${article.title}" will be published on ${formattedDate}.`
          : `Article will be published on ${formattedDate}.`,
      });
    } catch (error) {
      console.error("Failed to schedule publishing:", error);
      toast.error("Failed to schedule publishing", {
        description: "Please try again or check your connection.",
      });
      setError("Failed to schedule publishing");
    }
  };

  const handleBulkGenerate = async (articleIds: string[]) => {
    try {
      // For now, generate each article individually
      for (const articleId of articleIds) {
        await handleGenerateArticle(articleId);
      }
      
      toast.success(`Started generating ${articleIds.length} article${articleIds.length > 1 ? 's' : ''}!`, {
        description: "Check the Generations tab to monitor progress.",
      });
    } catch (error) {
      toast.error("Failed to start bulk generation", {
        description: "Some articles may not have started generating.",
      });
    }
  };

  const handleBulkScheduleGeneration = async (
    articleIds: string[],
    scheduledAt: Date,
  ) => {
    try {
      // Schedule each article individually
      for (const articleId of articleIds) {
        await handleScheduleGeneration(articleId, scheduledAt);
      }
      
      const formattedDate = scheduledAt.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
      
      toast.success(`Scheduled ${articleIds.length} article${articleIds.length > 1 ? 's' : ''} for generation!`, {
        description: `All articles will be generated on ${formattedDate}.`,
      });
    } catch (error) {
      toast.error("Failed to schedule bulk generation", {
        description: "Some articles may not have been scheduled.",
      });
    }
  };

  const handleBulkPublish = async (articleIds: string[]) => {
    try {
      // For now, publish each article individually
      for (const articleId of articleIds) {
        await handlePublishArticle(articleId);
      }
      
      toast.success(`Published ${articleIds.length} article${articleIds.length > 1 ? 's' : ''}!`, {
        description: "All selected articles are now live.",
      });
    } catch (error) {
      toast.error("Failed to publish all articles", {
        description: "Some articles may not have been published.",
      });
    }
  };

  const handleBulkSchedulePublishing = async (
    articleIds: string[],
    scheduledAt: Date,
  ) => {
    try {
      // For now, schedule each article individually
      for (const articleId of articleIds) {
        await handleSchedulePublishing(articleId, scheduledAt);
      }
      
      const formattedDate = scheduledAt.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
      
      toast.success(`Scheduled ${articleIds.length} article${articleIds.length > 1 ? 's' : ''} for publishing!`, {
        description: `All articles will be published on ${formattedDate}.`,
      });
    } catch (error) {
      toast.error("Failed to schedule bulk publishing", {
        description: "Some articles may not have been scheduled.",
      });
    }
  };

  const handleNavigateToArticle = (articleId: string) => {
    router.push(`/dashboard/articles/${articleId}`);
  };

  // Count articles for each phase
  const planningArticles = articles.filter(
    (a) =>
      a.status === "idea" ||
      (a.status === "to_generate" && !a.generationScheduledAt),
  );
  const generationsArticles = articles.filter(
    (a) =>
      a.status === "generating" ||
      (a.status === "to_generate" && Boolean(a.generationScheduledAt)) ||
      Boolean(a.generationError),
  );
  const publishingArticles = articles.filter(
    (a) => 
      a.status === "wait_for_publish" || 
      a.status === "published" ||
      // Include articles with completed generation that should be in publishing pipeline
      (a.generationProgress === 100 && a.generationPhase === undefined && !a.generationError),
  );

  // Debug: Log article statuses to help with troubleshooting
  console.log("Article distribution:", {
    total: articles.length,
    planning: planningArticles.length,
    generations: generationsArticles.length,
    publishing: publishingArticles.length,
    statuses: articles.map(a => ({ id: a.id, title: a.title, status: a.status }))
  });

  // Don't show loading indicator to prevent flickering on tab changes
  // Just show empty content until data arrives

  if (error) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Alert variant="destructive" className="max-w-md">
          <AlertDescription className="mb-4">
            {error}
          </AlertDescription>
          <Button onClick={fetchArticles} variant="outline" size="sm">
            Retry
          </Button>
        </Alert>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Content Workflow</h1>
        <p className="mt-1 text-sm">
          Manage your article creation and publishing pipeline
        </p>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={handleTabChange as (value: string) => void}
      >
        <WorkflowTabs
          activeTab={activeTab}
          onTabChange={handleTabChange}
          planningCount={planningArticles.length}
          generationsCount={generationsArticles.length}
          publishingCount={publishingArticles.length}
        />

        <TabsContent value="planning">
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
        </TabsContent>

        <TabsContent value="generations">
          <ArticleGenerations
            articles={generationsArticles}
            onRetryGeneration={handleGenerateArticle}
            onScheduleGeneration={handleScheduleGeneration}
            onNavigateToArticle={handleNavigateToArticle}
            onRefresh={fetchArticles}
            onUpdateArticleStatus={handleUpdateArticle}
          />
        </TabsContent>

        <TabsContent value="publishing">
          <PublishingPipeline
            articles={publishingArticles}
            onUpdateArticle={handleUpdateArticle}
            onPublishArticle={handlePublishArticle}
            onSchedulePublishing={handleSchedulePublishing}
            onBulkPublish={handleBulkPublish}
            onBulkSchedule={handleBulkSchedulePublishing}
            onNavigateToArticle={handleNavigateToArticle}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
