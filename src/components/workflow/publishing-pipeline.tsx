"use client";

import { Button } from "@/components/ui/button";
import { ArticleCard } from "./article-card";
import { FileText, Calendar } from "lucide-react";
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
  onBulkPublish: _onBulkPublish,
  onBulkSchedule: _onBulkSchedule,
  onNavigateToArticle,
}: PublishingPipelineProps) {


  // Group articles by status for publishing phase
  const readyToPublish = articles.filter(
    (a) => a.status === "wait_for_publish",
  );
  const publishedArticles = articles.filter((a) => a.status === "published");

  // Separate scheduled from unscheduled in ready to publish
  const readyNow = readyToPublish.filter((a) => !a.publishScheduledAt);
  const scheduledToPublish = readyToPublish.filter((a) => a.publishScheduledAt);



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
            </div>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {readyNow.map((article) => (
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

        {/* Scheduled to publish section */}
        {scheduledToPublish.length > 0 && (
          <section>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-medium text-gray-900">
                  Scheduled Articles ({scheduledToPublish.length})
                </h3>
                <div className="flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-700">
                  <Calendar className="h-4 w-4" />
                  <span>Publishing scheduled</span>
                </div>
              </div>
              {scheduledToPublish.length > 0 && (
                <div className="text-sm text-gray-600">
                  Next: {new Date(
                    Math.min(...scheduledToPublish.map(a => new Date(a.publishScheduledAt!).getTime()))
                  ).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit'
                  })}
                </div>
              )}
            </div>
            <div className="rounded-lg border border-blue-200 bg-blue-50/30 p-4">
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {scheduledToPublish
                  .sort((a, b) => {
                    const dateA = new Date(a.publishScheduledAt!).getTime();
                    const dateB = new Date(b.publishScheduledAt!).getTime();
                    return dateA - dateB;
                  })
                  .map((article) => (
                    <ArticleCard
                      key={article.id}
                      article={article}
                      mode="publishing"
                      onUpdate={onUpdateArticle}
                      onPublish={onPublishArticle}
                      onSchedulePublishing={onSchedulePublishing}
                      onNavigate={onNavigateToArticle}
                      className="border-blue-200 bg-white shadow-sm"
                    />
                  ))}
              </div>
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
