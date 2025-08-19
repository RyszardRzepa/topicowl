"use client";

import { useEffect, useRef, useState } from "react";
import { ArticleCard } from "./article-card";
import type { Article } from "@/types";
import type { GenerationStatus } from "@/app/api/articles/[id]/generation-status/route";

interface ArticleGenerationsProps {
  articles: Article[];
  onCancelGeneration?: (articleId: string) => void;
  onRetryGeneration?: (articleId: string) => void;
  onScheduleGeneration?: (articleId: string, scheduledAt: Date) => Promise<void>;
  onNavigateToArticle?: (articleId: string) => void;
  onRefresh?: () => void;
  onUpdateArticleStatus?: (
    articleId: string,
    updates: Partial<Article>,
  ) => void;
}

export function ArticleGenerations({
  articles,
  onCancelGeneration: _onCancelGeneration,
  onRetryGeneration: _onRetryGeneration,
  onScheduleGeneration,
  onNavigateToArticle,
  onRefresh,
  onUpdateArticleStatus,
}: ArticleGenerationsProps) {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const [generatingArticleIds, setGeneratingArticleIds] = useState<Set<string>>(new Set());

  // Wrapper function to convert onUpdateArticleStatus to the format expected by ArticleCard
  const handleUpdateArticle = async (articleId: string, updates: Partial<Article>) => {
    if (onUpdateArticleStatus) {
      onUpdateArticleStatus(articleId, updates);
    }
  };

  // Wrapper function to convert onRetryGeneration to the format expected by ArticleCard  
  const handleGenerateArticle = async (articleId: string) => {
    setGeneratingArticleIds((prev) => new Set(prev).add(articleId));
    try {
      if (_onRetryGeneration) {
        _onRetryGeneration(articleId);
      }
    } finally {
      setGeneratingArticleIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(articleId);
        return newSet;
      });
    }
  };

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

  // Group articles by status
  const generatingArticles = articles.filter(
    (article) => article.status === "generating",
  );
  const scheduledArticles = articles.filter(
    (article) => article.status === "to_generate" && article.generationScheduledAt,
  );
  const completedArticles = articles.filter(
    (article) => article.status === "wait_for_publish" || 
    (article.generationProgress === 100 && !article.generationError),
  );
  const failedArticles = articles.filter(
    (article) => article.generationError,
  );

  return (
    <div
      role="tabpanel"
      id="generations-panel"
      aria-labelledby="generations-tab"
      className="space-y-6"
    >
      {/* Header with actions */}
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row">
        <div>
          <h2 className="text-xl font-semibold">
            Article Generations
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Monitor and manage article generation progress
          </p>
        </div>
      </div>

      {/* Article sections */}
      <div className="grid gap-6">
        {/* Currently Generating */}
        {generatingArticles.length > 0 && (
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-medium">
                Currently Generating ({generatingArticles.length})
              </h3>
            </div>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {generatingArticles.map((article) => (
                <ArticleCard
                  key={`generating-${article.id}`}
                  article={article}
                  mode="generations"
                  onScheduleGeneration={onScheduleGeneration}
                  onNavigate={onNavigateToArticle}
                />
              ))}
            </div>
          </section>
        )}

        {/* Scheduled for Generation */}
        {scheduledArticles.length > 0 && (
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-medium">
                Scheduled for Generation ({scheduledArticles.length})
              </h3>
            </div>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {scheduledArticles.map((article) => (
                <ArticleCard
                  key={`scheduled-${article.id}`}
                  article={article}
                  mode="generations"
                  onUpdate={handleUpdateArticle}
                  onGenerate={handleGenerateArticle}
                  onScheduleGeneration={onScheduleGeneration}
                  onNavigate={onNavigateToArticle}
                  isButtonLoading={generatingArticleIds.has(article.id)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Recently Completed */}
        {completedArticles.length > 0 && (
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-medium">
                Recently Completed ({completedArticles.length})
              </h3>
            </div>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {completedArticles.map((article) => (
                <ArticleCard
                  key={`completed-${article.id}`}
                  article={article}
                  mode="generations"
                  onScheduleGeneration={onScheduleGeneration}
                  onNavigate={onNavigateToArticle}
                />
              ))}
            </div>
          </section>
        )}

        {/* Failed Generations */}
        {failedArticles.length > 0 && (
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-medium">
                Failed Generations ({failedArticles.length})
              </h3>
            </div>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {failedArticles.map((article) => (
                <ArticleCard
                  key={`failed-${article.id}`}
                  article={article}
                  mode="generations"
                  onScheduleGeneration={onScheduleGeneration}
                  onNavigate={onNavigateToArticle}
                />
              ))}
            </div>
          </section>
        )}

        {/* Empty state */}
        {articles.length === 0 && (
          <div className="flex h-96 items-center justify-center">
            <div className="text-center">
              <h3 className="mb-2 text-lg font-medium">
                No generations in progress
              </h3>
              <p className="text-sm text-muted-foreground">
                Articles you generate will appear here
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}