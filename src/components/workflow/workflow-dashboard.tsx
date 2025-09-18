"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ReusableTabs } from "@/components/ui/reusable-tabs";
import { PlanningHub } from "./planning-hub";
import { ArticleGenerations } from "./article-generations";
import { PublishingPipeline } from "./publishing-pipeline";
import { useGenerationPolling } from "@/hooks/use-generation-polling";
import type { WorkflowPhase } from "@/types";
import { useWorkflowArticles } from "./use-workflow-articles";

interface WorkflowDashboardProps {
  className?: string;
}

const phaseFromStatus = (
  status: string | undefined,
):
  | "research"
  | "writing"
  | "quality-control"
  | "validation"
  | "optimization"
  | undefined => {
  switch (status) {
    case "research":
      return "research";
    case "writing":
      return "writing";
    case "quality-control":
      return "quality-control";
    case "validating":
      return "validation";
    case "updating":
    case "image":
      return "optimization";
    default:
      return undefined;
  }
};

export function WorkflowDashboard({ className }: WorkflowDashboardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const {
    state: { articles, error },
    partitions: {
      planningArticles,
      generationsArticles,
      publishingArticles,
      generatingArticles,
    },
    refetch: fetchArticles,
    actions,
  } = useWorkflowArticles();

  // Get active tab from URL search params, fallback to 'planning'
  const getValidTab = (tab: string | null): WorkflowPhase => {
    if (tab === "planning" || tab === "generations" || tab === "publishing") {
      return tab;
    }
    return "planning";
  };

  const activeTabFromUrl = getValidTab(searchParams.get("tab"));
  const [activeTab, setActiveTab] = useState<WorkflowPhase>(activeTabFromUrl);
  // Article state managed by hook

  // Polling interval constant for generation status. 5s balances UI freshness and backend load.
  // If we add real-time updates (SSE/WebSockets) this can be removed or lengthened.
  const GENERATION_POLL_INTERVAL_MS = 5000;

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
  // Transformation handled inside hook

  // Fetch articles from API
  // fetchArticles provided by hook

  // Get currently generating articles
  const generatingArticlesList = generatingArticles;

  // Handle generation status updates
  const handleGenerationStatusUpdate = useCallback(
    (
      articleId: string,
      statusData: {
        progress?: number;
        phase?:
          | "research"
          | "writing"
          | "quality-control"
          | "validation"
          | "optimization";
        error?: string;
      },
    ) => {
      actions.setArticles((prev) =>
        prev.map((a) =>
          a.id === articleId
            ? {
                ...a,
                generationProgress: statusData.progress,
                generationPhase: statusData.phase,
                generationError: statusData.error,
              }
            : a,
        ),
      );
    },
    [actions],
  );

  const handleGenerationComplete = useCallback(
    (articleId: string) => {
      const article = articles.find((a) => a.id === articleId);
      void import("sonner").then(({ toast }) => {
        toast.success("Article generation completed!", {
          description: article
            ? `"${article.title}" is ready for publishing.`
            : "Your article is ready for publishing.",
        });
      });
      void fetchArticles();
      actions.refreshCredits();
    },
    [articles, fetchArticles, actions],
  );

  const handleGenerationError = useCallback(
    (articleId: string, error: string) => {
      const article = articles.find((a) => a.id === articleId);
      void import("sonner").then(({ toast }) => {
        toast.error("Article generation failed", {
          description: article
            ? `"${article.title}" failed to generate: ${error}`
            : `Generation failed: ${error}`,
        });
      });
      actions.setArticles((prev) =>
        prev.map((a) =>
          a.id === articleId ? { ...a, generationError: error } : a,
        ),
      );
    },
    [articles, actions],
  );

  // Use polling for the first generating article as an example
  // In a real implementation, you'd need a more sophisticated approach for multiple articles
  const firstGeneratingArticle = generatingArticlesList[0];

  // Don't poll if user is on an article page (to avoid duplicate polling)
  const isOnArticlePage =
    pathname.startsWith("/articles/") ||
    pathname.startsWith("/dashboard/articles/");

  useGenerationPolling({
    articleId: firstGeneratingArticle?.id ?? "",
    enabled:
      !!firstGeneratingArticle &&
      !firstGeneratingArticle.generationError &&
      !isOnArticlePage, // Disable if on article page
    // Use default 5-second interval for consistent polling
    intervalMs: GENERATION_POLL_INTERVAL_MS,
    onStatusUpdate: (statusData) =>
      handleGenerationStatusUpdate(firstGeneratingArticle?.id ?? "", {
        progress: statusData.progress,
        phase: phaseFromStatus(statusData.status as string),
        error: statusData.error,
      }),
    onComplete: () =>
      handleGenerationComplete(firstGeneratingArticle?.id ?? ""),
    onError: (error) =>
      handleGenerationError(firstGeneratingArticle?.id ?? "", error),
  });

  // Initial fetch handled inside hook

  // Listen for storage changes from other tabs/windows only
  // Removed automatic refresh on tab focus/visibility to prevent unwanted data refreshing
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "articleStatusChanged" && e.newValue) {
        sessionStorage.removeItem("articleStatusChanged");
        void fetchArticles();
      }
    };

    window.addEventListener("storage", handleStorageChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [fetchArticles]);

  // Action handlers removed in favor of hook-provided actions

  const handleNavigateToArticle = (articleId: string) => {
    router.push(`/dashboard/articles/${articleId}`);
  };

  // Count articles for each phase
  // partitions provided by hook

  // Debug: Log article statuses to help with troubleshooting
  console.log("Article distribution:", {
    total: articles.length,
    planning: planningArticles.length,
    generations: generationsArticles.length,
    publishing: publishingArticles.length,
    statuses: articles.map((a) => ({
      id: a.id,
      title: a.title,
      status: a.status,
    })),
  });

  // Don't show loading indicator to prevent flickering on tab changes
  // Just show empty content until data arrives

  if (error) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Alert variant="destructive" className="max-w-md">
          <AlertDescription className="mb-4">{error}</AlertDescription>
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
        <ReusableTabs
          activeTab={activeTab}
          onTabChange={(tab: string) => handleTabChange(getValidTab(tab))}
          tabs={[
            {
              value: "planning",
              label: "Planning",
              count: planningArticles.length,
            },
            {
              value: "generations",
              label: "Generations",
              count: generationsArticles.length,
            },
            {
              value: "publishing",
              label: "Publishing",
              count: publishingArticles.length,
            },
          ]}
        />

        <TabsContent value="planning">
          <PlanningHub
            articles={planningArticles}
            onCreateArticle={actions.create}
            onUpdateArticle={actions.update}
            onDeleteArticle={actions.delete}
            onGenerateArticle={actions.generate}
            onBulkGenerate={actions.bulkGenerate}
            onNavigateToArticle={handleNavigateToArticle}
          />
        </TabsContent>

        <TabsContent value="generations">
          <ArticleGenerations
            articles={generationsArticles}
            onRetryGeneration={actions.generate}
            onNavigateToArticle={handleNavigateToArticle}
            onRefresh={fetchArticles}
            onUpdateArticleStatus={actions.update}
          />
        </TabsContent>

        <TabsContent value="publishing">
          <PublishingPipeline
            articles={publishingArticles}
            onUpdateArticle={actions.update}
            onDeleteArticle={actions.delete}
            onPublishArticle={actions.publish}
            onSchedulePublishing={actions.schedulePublishing}
            onCancelPublishSchedule={actions.cancelPublishSchedule}
            onBulkPublish={actions.bulkPublish}
            onBulkSchedule={actions.bulkSchedulePublishing}
            onNavigateToArticle={handleNavigateToArticle}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
