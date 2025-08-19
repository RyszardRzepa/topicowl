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
  const readyToPublish = articles.filter((a) => a.status === "wait_for_publish");
  const publishedArticles = articles.filter((a) => a.status === "published");
  // Separate scheduled from unscheduled in ready to publish
  const readyNow = readyToPublish.filter((a) => !a.publishScheduledAt);
  const scheduledToPublish = readyToPublish.filter((a) => a.publishScheduledAt);

  const allEmpty = readyNow.length === 0 && scheduledToPublish.length === 0 && publishedArticles.length === 0;

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
          <h2 className="text-xl font-semibold">Publishing Pipeline</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Schedule and publish completed articles
          </p>
        </div>
      </div>
      {/* Kanban columns */}
      {allEmpty ? (
        <div className="flex h-96 items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-muted">
              <FileText className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="mb-2 text-lg font-medium">No articles ready for publishing</h3>
            <p className="mb-4 text-sm text-muted-foreground">Generate some articles first in the Planning Hub</p>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {/* Column: Ready Now */}
          <div className="flex flex-col rounded-lg border bg-card p-3">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold tracking-wide">Ready to Publish</h3>
              <span className="text-xs text-muted-foreground">{readyNow.length}</span>
            </div>
            <div className="flex flex-1 flex-col gap-3 overflow-y-auto">
              {readyNow.length === 0 && (
                <div className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
                  None ready now
                </div>
              )}
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
          </div>
          {/* Column: Scheduled */}
          <div className="flex flex-col rounded-lg border bg-card p-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold tracking-wide">Scheduled Articles</h3>
                <Badge variant="blue" className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  <span className="text-[10px]">Queued</span>
                </Badge>
              </div>
              <span className="text-xs text-muted-foreground">{scheduledToPublish.length}</span>
            </div>
            {scheduledToPublish.length > 0 && (
              <div className="mb-2 text-[10px] uppercase tracking-wide text-muted-foreground">
                Next {new Date(
                  Math.min(...scheduledToPublish.map((a) => new Date(a.publishScheduledAt!).getTime())),
                ).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </div>
            )}
            <div className="flex flex-1 flex-col gap-3 overflow-y-auto">
              {scheduledToPublish.length === 0 && (
                <div className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
                  Nothing scheduled
                </div>
              )}
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
          </div>
          {/* Column: Published */}
          <div className="flex flex-col rounded-lg border bg-card p-3">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold tracking-wide">Published</h3>
              <span className="text-xs text-muted-foreground">{publishedArticles.length}</span>
            </div>
            <div className="flex flex-1 flex-col gap-3 overflow-y-auto">
              {publishedArticles.length === 0 && (
                <div className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
                  None published yet
                </div>
              )}
              {publishedArticles
                .sort(
                  (a, b) =>
                    new Date(b.publishedAt ?? b.updatedAt).getTime() -
                    new Date(a.publishedAt ?? a.updatedAt).getTime(),
                )
                .slice(0, 25) // show more in column context
                .map((article) => (
                  <ArticleCard
                    key={article.id}
                    article={article}
                    mode="publishing"
                    onNavigate={onNavigateToArticle}
                  />
                ))}
            </div>
            {publishedArticles.length > 25 && (
              <div className="mt-2 text-center">
                <Button variant="outline" size="sm">
                  View All ({publishedArticles.length})
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
