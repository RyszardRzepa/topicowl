"use client";

import {
  Clock,
  Play,
  Pause,
  AlertCircle,
  CheckCircle,
  Loader2,
} from "lucide-react";
import type { Article } from "@/types";
import { cn } from "@/lib/utils";

interface ArticleGenerationsProps {
  articles: Article[];
  onCancelGeneration?: (articleId: string) => void;
  onRetryGeneration?: (articleId: string) => void;
  onNavigateToArticle?: (articleId: string) => void;
}

export function ArticleGenerations({
  articles,
  onCancelGeneration,
  onRetryGeneration,
  onNavigateToArticle,
}: ArticleGenerationsProps) {
  // Separate articles by status
  const scheduledArticles = articles.filter(
    (a) => a.generationScheduledAt && a.status === "to_generate",
  );
  const generatingArticles = articles.filter((a) => a.status === "generating");
  const completedArticles = articles.filter(
    (a) => a.status === "wait_for_publish" && a.generationCompletedAt,
  );
  const failedArticles = articles.filter((a) => a.generationError);

  const getProgressColor = (progress: number) => {
    if (progress < 30) return "bg-red-500";
    if (progress < 70) return "bg-yellow-500";
    return "bg-green-500";
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
        "rounded-lg border bg-white p-4 transition-shadow hover:shadow-md",
        {
          "border-orange-200": status === "scheduled",
          "border-blue-200": status === "generating",
          "border-green-200": status === "completed",
          "border-red-200": status === "failed",
        },
      )}
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-center gap-2">
            {status === "scheduled" && (
              <Clock className="h-4 w-4 text-orange-500" />
            )}
            {status === "generating" && (
              <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
            )}
            {status === "completed" && (
              <CheckCircle className="h-4 w-4 text-green-500" />
            )}
            {status === "failed" && (
              <AlertCircle className="h-4 w-4 text-red-500" />
            )}

            <h3 className="truncate text-sm font-medium text-gray-900">
              {article.title}
            </h3>
          </div>

          {/* Status-specific content */}
          {status === "scheduled" && article.generationScheduledAt && (
            <p className="mb-2 text-xs text-gray-500">
              Scheduled: {formatScheduledTime(article.generationScheduledAt)}
            </p>
          )}

          {status === "generating" && (
            <div className="mb-2">
              <div className="mb-1 flex items-center justify-between text-xs text-gray-600">
                <span>{getPhaseLabel(article.generationPhase)}</span>
                <span>{article.generationProgress ?? 0}%</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-gray-200">
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
            <p className="mb-2 text-xs text-gray-500">
              Completed:{" "}
              {new Date(article.generationCompletedAt).toLocaleString()}
            </p>
          )}

          {status === "failed" && article.generationError && (
            <p className="mb-2 text-xs text-red-600">
              Error: {article.generationError}
            </p>
          )}

          {/* Keywords */}
          {article.keywords && article.keywords.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1">
              {article.keywords.slice(0, 3).map((keyword, index) => (
                <span
                  key={index}
                  className="inline-flex items-center rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-800"
                >
                  {keyword}
                </span>
              ))}
              {article.keywords.length > 3 && (
                <span className="text-xs text-gray-500">
                  +{article.keywords.length - 3} more
                </span>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="ml-4 flex items-center gap-2">
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
            <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
            Currently Generating ({generatingArticles.length})
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {generatingArticles.map((article) => (
              <ArticleCard
                key={article.id}
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
                key={article.id}
                article={article}
                status="scheduled"
              />
            ))}
          </div>
        </div>
      )}

      {/* Recently Completed */}
      {completedArticles.length > 0 && (
        <div>
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900">
            <CheckCircle className="h-5 w-5 text-green-500" />
            Recently Completed ({completedArticles.length})
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {completedArticles.map((article) => (
              <ArticleCard
                key={article.id}
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
              <ArticleCard key={article.id} article={article} status="failed" />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
