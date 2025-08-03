"use client";

import {
  Clock,
  Play,
  Pause,
  AlertCircle,
  CheckCircle,
  Loader2,
  X,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { Article } from "@/types";
import { cn } from "@/lib/utils";
import type { RunNowResponse } from "@/app/api/articles/[id]/run-now/route";
import type { CancelScheduleResponse } from "@/app/api/articles/[id]/cancel-schedule/route";
import type { GenerationStatus } from "@/app/api/articles/[id]/generation-status/route";

interface ArticleGenerationsProps {
  articles: Article[];
  onCancelGeneration?: (articleId: string) => void;
  onRetryGeneration?: (articleId: string) => void;
  onNavigateToArticle?: (articleId: string) => void;
  onRefresh?: () => void;
  onUpdateArticleStatus?: (
    articleId: string,
    updates: Partial<Article>,
  ) => void;
}

export function ArticleGenerations({
  articles,
  onCancelGeneration,
  onRetryGeneration,
  onNavigateToArticle,
  onRefresh,
  onUpdateArticleStatus,
}: ArticleGenerationsProps) {
  const [loadingActions, setLoadingActions] = useState<Record<string, boolean>>(
    {},
  );
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-refresh generation status every 5 seconds for generating articles
  useEffect(() => {
    const generatingArticles = articles.filter(
      (article) => article.status === "generating",
    );

    if (generatingArticles.length > 0) {
      // Clear any existing interval
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }

      // Set up new interval to fetch status for each generating article
      intervalRef.current = setInterval(() => {
        void (async () => {
          try {
            // Fetch status for all generating articles in parallel
            const statusPromises = generatingArticles.map(async (article) => {
              try {
                const response = await fetch(
                  `/api/articles/${article.id}/generation-status`,
                );
                if (response.ok) {
                  const statusData = await response.json() as GenerationStatus;
                  return { articleId: article.id, statusData };
                }
              } catch (error) {
                console.error(
                  `Failed to fetch status for article ${article.id}:`,
                  error,
                );
              }
              return null;
            });

            const results = await Promise.all(statusPromises);

            // Update local article status and check if we need full refresh
            let needsFullRefresh = false;

            results.forEach((result) => {
              if (result?.statusData && onUpdateArticleStatus) {
                const { articleId, statusData } = result;

                // Map the status data to Article updates
                const updates: Partial<Article> = {
                  generationProgress: statusData.progress ?? 0,
                  generationPhase: statusData.phase as
                    | "research"
                    | "writing"
                    | "validation"
                    | "optimization"
                    | undefined,
                  generationError: statusData.error,
                };

                // If generation completed or failed, we need a full refresh to update status
                if (
                  statusData.status === "completed" ||
                  statusData.status === "failed"
                ) {
                  needsFullRefresh = true;
                } else {
                  // Update local state for progress updates
                  onUpdateArticleStatus(articleId, updates);
                }
              }
            });

            // Full refresh only when articles complete or fail
            if (needsFullRefresh && onRefresh) {
              onRefresh();
            }
          } catch (error) {
            console.error("Failed to fetch generation statuses:", error);
          }
        })();
      }, 5000); // 5 seconds

      // Cleanup function
      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      };
    } else {
      // Clear interval if no generating articles
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
  }, [articles, onRefresh, onUpdateArticleStatus]);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Handler for running scheduled generation immediately
  const handleRunNow = async (articleId: string) => {
    const article = articles.find((a) => a.id === articleId);
    setLoadingActions((prev) => ({ ...prev, [`run-${articleId}`]: true }));
    try {
      const response = await fetch(`/api/articles/${articleId}/run-now`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const result = (await response.json()) as RunNowResponse;

      if (!response.ok || !result.success) {
        throw new Error(result.error ?? "Failed to start generation");
      }

      toast.success("Generation started immediately!", {
        description: article
          ? `"${article.title}" is now being generated.`
          : "Article generation has started.",
      });

      // Refresh the articles list
      onRefresh?.();
    } catch (error) {
      console.error("Failed to run generation now:", error);
      toast.error("Failed to start generation", {
        description: "Please try again or check your connection.",
      });
    } finally {
      setLoadingActions((prev) => ({ ...prev, [`run-${articleId}`]: false }));
    }
  };

  // Handler for canceling scheduled generation
  const handleCancelSchedule = async (articleId: string) => {
    const article = articles.find((a) => a.id === articleId);
    setLoadingActions((prev) => ({ ...prev, [`cancel-${articleId}`]: true }));
    try {
      const response = await fetch(
        `/api/articles/${articleId}/cancel-schedule`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        },
      );

      const result = (await response.json()) as CancelScheduleResponse;

      if (!response.ok || !result.success) {
        throw new Error(result.error ?? "Failed to cancel generation");
      }

      toast.success("Generation schedule cancelled!", {
        description: article
          ? `"${article.title}" will not be generated automatically.`
          : "Article generation has been cancelled.",
      });

      // Refresh the articles list
      onRefresh?.();
    } catch (error) {
      console.error("Failed to cancel generation:", error);
      toast.error("Failed to cancel generation", {
        description: "Please try again or check your connection.",
      });
    } finally {
      setLoadingActions((prev) => ({
        ...prev,
        [`cancel-${articleId}`]: false,
      }));
    }
  };

  // Separate articles by status (mutually exclusive categories)
  const failedArticles = articles.filter((a) => a.generationError);
  const scheduledArticles = articles.filter(
    (a) =>
      a.generationScheduledAt &&
      a.status === "to_generate" &&
      !a.generationError,
  );
  const generatingArticles = articles.filter(
    (a) => a.status === "generating" && !a.generationError,
  );
  const completedArticles = articles.filter(
    (a) =>
      a.status === "wait_for_publish" &&
      a.generationCompletedAt &&
      !a.generationError,
  );

  const getProgressColor = (progress: number) => {
    if (progress < 30) return "bg-red-400";
    if (progress < 70) return "bg-brand-orange";
    return "bg-brand-green";
  };

  const getPhaseLabel = (phase?: string) => {
    switch (phase) {
      case "research":
        return "Researching";
      case "writing":
        return "Writing";
      case "validation":
        return "Validating";
      case "optimization":
        return "Optimizing";
      default:
        return "Processing";
    }
  };

  const formatScheduledTime = (scheduledAt: string) => {
    const date = new Date(scheduledAt);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffHours = Math.ceil(diffMs / (1000 * 60 * 60));

    if (diffHours <= 0) return "Starting soon";
    if (diffHours < 24) return `In ${diffHours}h`;
    const diffDays = Math.ceil(diffHours / 24);
    return `In ${diffDays}d`;
  };

  const ArticleCard = ({
    article,
    status,
  }: {
    article: Article;
    status: "scheduled" | "generating" | "completed" | "failed";
  }) => (
    <div
      className={cn(
        "group relative rounded-lg border bg-brand-white/5 p-4 transition-shadow hover:shadow-md",
        {
          "border-brand-orange/30": status === "scheduled",
          "border-brand-green/30": status === "generating",
          "border-brand-green/30": status === "completed",
          "border-red-400/30": status === "failed",
        },
      )}
      onMouseEnter={() => setHoveredCard(article.id)}
      onMouseLeave={() => setHoveredCard(null)}
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-center gap-2">
            {status === "scheduled" && (
              <Clock className="h-4 w-4 text-brand-orange" />
            )}
            {status === "generating" && (
              <Loader2 className="h-4 w-4 animate-spin text-brand-green" />
            )}
            {status === "completed" && (
              <CheckCircle className="h-4 w-4 text-brand-green" />
            )}
            {status === "failed" && (
              <AlertCircle className="h-4 w-4 text-red-400" />
            )}

            <h3 className="truncate text-sm font-medium text-brand-white">
              {article.title}
            </h3>
          </div>

          {/* Status-specific content */}
          {status === "scheduled" && article.generationScheduledAt && (
            <p className="mb-2 text-xs text-brand-white/60">
              Scheduled: {formatScheduledTime(article.generationScheduledAt)}
            </p>
          )}

          {status === "generating" && (
            <div className="mb-2">
              <div className="mb-1 flex items-center justify-between text-xs text-brand-white/70">
                <span>{getPhaseLabel(article.generationPhase)}</span>
                <span>{article.generationProgress ?? 0}%</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-brand-white/20">
                <div
                  className={cn(
                    "h-1.5 rounded-full transition-all duration-300",
                    getProgressColor(article.generationProgress ?? 0),
                  )}
                  style={{ width: `${article.generationProgress ?? 0}%` }}
                />
              </div>
            </div>
          )}

          {status === "completed" && article.generationCompletedAt && (
            <p className="mb-2 text-xs text-brand-white/60">
              Completed:{" "}
              {new Date(article.generationCompletedAt).toLocaleString()}
            </p>
          )}

          {status === "failed" && article.generationError && (
            <p className="mb-2 text-xs text-red-400">
              Error: {article.generationError}
            </p>
          )}

          {/* Keywords */}
          {article.keywords && article.keywords.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1">
              {article.keywords.slice(0, 3).map((keyword, index) => (
                <span
                  key={index}
                  className="inline-flex items-center rounded bg-brand-white/10 px-2 py-0.5 text-xs font-medium text-brand-white/80"
                >
                  {keyword}
                </span>
              ))}
              {article.keywords.length > 3 && (
                <span className="text-xs text-brand-white/60">
                  +{article.keywords.length - 3} more
                </span>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="ml-4 flex items-center gap-2">
          {/* Scheduled article actions - show on hover */}
          {status === "scheduled" && hoveredCard === article.id && (
            <>
              <Button
                onClick={() => handleRunNow(article.id)}
                disabled={loadingActions[`run-${article.id}`]}
                size="sm"
                className="text-xs"
                title="Run generation now"
              >
                {loadingActions[`run-${article.id}`] ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Play className="h-3 w-3" />
                )}
                Run Now
              </Button>
              <Button
                onClick={() => handleCancelSchedule(article.id)}
                disabled={loadingActions[`cancel-${article.id}`]}
                variant="outline"
                size="sm"
                className="text-xs"
                title="Cancel scheduled generation"
              >
                {loadingActions[`cancel-${article.id}`] ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <X className="h-3 w-3" />
                )}
                Cancel
              </Button>
            </>
          )}

          {status === "generating" && onCancelGeneration && (
            <button
              onClick={() => onCancelGeneration(article.id)}
              className="p-1 text-gray-400 transition-colors hover:text-red-600"
              title="Cancel generation"
            >
              <Pause className="h-4 w-4" />
            </button>
          )}

          {status === "failed" && onRetryGeneration && (
            <button
              onClick={() => onRetryGeneration(article.id)}
              className="p-1 text-gray-400 transition-colors hover:text-blue-600"
              title="Retry generation"
            >
              <Play className="h-4 w-4" />
            </button>
          )}

          {(status === "completed" || status === "failed") &&
            onNavigateToArticle && (
              <button
                onClick={() => onNavigateToArticle(article.id)}
                className="text-xs font-medium text-blue-600 hover:text-blue-800"
              >
                View
              </button>
            )}
        </div>
      </div>
    </div>
  );

  if (articles.length === 0) {
    return (
      <div className="py-12 text-center">
        <Loader2 className="mx-auto mb-4 h-12 w-12 text-gray-400" />
        <h3 className="mb-2 text-lg font-medium text-gray-900">
          No Article Generations
        </h3>
        <p className="text-gray-500">
          Articles will appear here when you start generating them from the
          Planning tab.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Currently Generating */}
      {generatingArticles.length > 0 && (
        <div>
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900">
            Currently Generating ({generatingArticles.length})
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {generatingArticles.map((article) => (
              <ArticleCard
                key={`generating-${article.id}`}
                article={article}
                status="generating"
              />
            ))}
          </div>
        </div>
      )}
      {/* Scheduled for Generation */}
      {scheduledArticles.length > 0 && (
        <div>
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900">
            <Clock className="h-5 w-5 text-orange-500" />
            Scheduled for Generation ({scheduledArticles.length})
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {scheduledArticles.map((article) => (
              <ArticleCard
                key={`scheduled-${article.id}`}
                article={article}
                status="scheduled"
              />
            ))}
          </div>
        </div>
      )}
      Recently Completed
      {completedArticles.length > 0 && (
        <div>
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900">
            <CheckCircle className="h-5 w-5 text-green-500" />
            Recently Completed ({completedArticles.length})
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {completedArticles.map((article) => (
              <ArticleCard
                key={`completed-${article.id}`}
                article={article}
                status="completed"
              />
            ))}
          </div>
        </div>
      )}
      {/* Failed Generations */}
      {failedArticles.length > 0 && (
        <div>
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900">
            <AlertCircle className="h-5 w-5 text-red-500" />
            Failed Generations ({failedArticles.length})
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {failedArticles.map((article) => (
              <ArticleCard
                key={`failed-${article.id}`}
                article={article}
                status="failed"
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
