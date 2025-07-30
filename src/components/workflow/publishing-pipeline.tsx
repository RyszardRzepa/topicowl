"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArticleCard } from "./article-card";
import { Check, Calendar, Settings, FileText } from "lucide-react";
import { toast } from "sonner";
import type { Article } from "@/types";

interface PublishingPipelineProps {
  articles: Article[];
  onUpdateArticle: (
    articleId: string,
    updates: Partial<Article>,
  ) => Promise<void>;
  onPublishArticle: (articleId: string) => Promise<void>;
  onSchedulePublishing: (articleId: string, scheduledAt: Date) => Promise<void>;
  onBulkPublish: (articleIds: string[]) => Promise<void>;
  onBulkSchedule: (articleIds: string[], scheduledAt: Date) => Promise<void>;
  onNavigateToArticle: (articleId: string) => void;
}

export function PublishingPipeline({
  articles,
  onUpdateArticle,
  onPublishArticle,
  onSchedulePublishing,
  onBulkPublish,
  onBulkSchedule,
  onNavigateToArticle,
}: PublishingPipelineProps) {
  const [selectedArticles, setSelectedArticles] = useState<Set<string>>(
    new Set(),
  );
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [isSchedulingBulk, setIsSchedulingBulk] = useState(false);

  // Group articles by status for publishing phase
  const readyToPublish = articles.filter(
    (a) => a.status === "wait_for_publish",
  );
  const publishedArticles = articles.filter((a) => a.status === "published");

  // Separate scheduled from unscheduled in ready to publish
  const readyNow = readyToPublish.filter((a) => !a.publishScheduledAt);
  const scheduledToPublish = readyToPublish.filter((a) => a.publishScheduledAt);

  const handleBulkPublish = async () => {
    if (selectedArticles.size === 0) return;
    
    await onBulkPublish(Array.from(selectedArticles));
    setSelectedArticles(new Set());
    setIsBulkMode(false);
  };

  const handleBulkSchedule = async (scheduledAt: string) => {
    if (selectedArticles.size === 0) return;
    
    await onBulkSchedule(Array.from(selectedArticles), new Date(scheduledAt));
    setSelectedArticles(new Set());
    setIsBulkMode(false);
    setIsSchedulingBulk(false);
  };

  const toggleArticleSelection = (articleId: string) => {
    const newSelected = new Set(selectedArticles);
    if (newSelected.has(articleId)) {
      newSelected.delete(articleId);
    } else {
      newSelected.add(articleId);
    }
    setSelectedArticles(newSelected);
  };

  return (
    <div
      role="tabpanel"
      id="publishing-panel"
      aria-labelledby="publishing-tab"
      className="space-y-6"
    >
      {/* Header with actions */}
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">
            Publishing Pipeline
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            Schedule and publish completed articles
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {/* Bulk action mode toggle */}
          {readyNow.length > 0 && (
            <Button
              variant={isBulkMode ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setIsBulkMode(!isBulkMode);
                setSelectedArticles(new Set());
              }}
            >
              <Settings className="mr-2 h-4 w-4" />
              {isBulkMode ? "Exit Bulk Mode" : "Bulk Actions"}
            </Button>
          )}

          {/* Bulk actions */}
          {isBulkMode && selectedArticles.size > 0 && (
            <>
              <Button
                size="sm"
                className="bg-blue-600 hover:bg-blue-700"
                onClick={handleBulkPublish}
              >
                <Check className="mr-2 h-4 w-4" />
                Publish Selected ({selectedArticles.size})
              </Button>

              {isSchedulingBulk ? (
                <div className="flex items-center gap-2">
                  <input
                    type="datetime-local"
                    className="rounded border border-gray-200 px-2 py-1 text-xs"
                    min={new Date().toISOString().slice(0, 16)}
                    onChange={(e) => {
                      if (e.target.value) {
                        void handleBulkSchedule(
                          new Date(e.target.value).toISOString(),
                        );
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsSchedulingBulk(false)}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsSchedulingBulk(true)}
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  Schedule Selected
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Article sections */}
      <div className="grid gap-6">
        {/* Ready to publish now section */}
        {readyNow.length > 0 && (
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">
                Ready to Publish ({readyNow.length})
              </h3>
              {!isBulkMode && readyNow.length > 1 && (
                <Button
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700"
                  onClick={() => onBulkPublish(readyNow.map(a => a.id))}
                >
                  <Check className="mr-2 h-4 w-4" />
                  Publish All Ready
                </Button>
              )}
            </div>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {readyNow.map((article) => (
                <div key={article.id} className="relative">
                  {isBulkMode && (
                    <div className="absolute top-2 left-2 z-10">
                      <input
                        type="checkbox"
                        checked={selectedArticles.has(article.id)}
                        onChange={() => toggleArticleSelection(article.id)}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </div>
                  )}
                  <ArticleCard
                    article={article}
                    mode="publishing"
                    onUpdate={onUpdateArticle}
                    onPublish={onPublishArticle}
                    onSchedulePublishing={onSchedulePublishing}
                    onNavigate={onNavigateToArticle}
                    className={isBulkMode ? "ml-6" : ""}
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Scheduled to publish section */}
        {scheduledToPublish.length > 0 && (
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">
                Scheduled to Publish ({scheduledToPublish.length})
              </h3>
            </div>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {scheduledToPublish.map((article) => (
                <ArticleCard
                  key={article.id}
                  article={article}
                  mode="publishing"
                  onUpdate={onUpdateArticle}
                  onPublish={onPublishArticle}
                  onSchedulePublishing={onSchedulePublishing}
                  onNavigate={onNavigateToArticle}
                />
              ))}
            </div>
          </section>
        )}

        {/* Published articles section */}
        {publishedArticles.length > 0 && (
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">
                Published ({publishedArticles.length})
              </h3>
            </div>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {publishedArticles
                .sort(
                  (a, b) =>
                    new Date(b.publishedAt ?? b.updatedAt).getTime() -
                    new Date(a.publishedAt ?? a.updatedAt).getTime(),
                )
                .slice(0, 12) // Show only most recent 12
                .map((article) => (
                  <ArticleCard
                    key={article.id}
                    article={article}
                    mode="publishing"
                    onNavigate={onNavigateToArticle}
                  />
                ))}
            </div>
            {publishedArticles.length > 12 && (
              <div className="mt-4 text-center">
                <Button variant="outline" size="sm">
                  View All Published Articles ({publishedArticles.length})
                </Button>
              </div>
            )}
          </section>
        )}

        {/* Empty state */}
        {readyToPublish.length === 0 && publishedArticles.length === 0 && (
          <div className="py-12 text-center">
            <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-gray-100">
              <FileText className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="mb-2 text-lg font-medium text-gray-900">
              No articles ready for publishing
            </h3>
            <p className="mb-4 text-gray-600">
              Generate some articles first in the Planning Hub
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
