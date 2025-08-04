"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
          <h2 className="text-xl font-semibold">
            Publishing Pipeline
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
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
              <h3 className="text-lg font-medium">
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
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-medium">
                  Scheduled Articles ({scheduledToPublish.length})
                </h3>
                <Badge variant="blue" className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  <span>Publishing scheduled</span>
                </Badge>
              </div>
              {scheduledToPublish.length > 0 && (
                <div className="text-sm text-muted-foreground">
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
                  />
                ))}
            </div>
          </section>
        )}

        {/* Published articles section */}
        {publishedArticles.length > 0 && (
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-medium">
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
          <div className="flex h-96 items-center justify-center">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-muted">
                <FileText className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="mb-2 text-lg font-medium">
                No articles ready for publishing
              </h3>
              <p className="mb-4 text-sm text-muted-foreground">
                Generate some articles first in the Planning Hub
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
