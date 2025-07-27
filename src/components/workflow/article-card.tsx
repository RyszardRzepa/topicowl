"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { StatusIndicator, formatRelativeTime } from "./status-indicator";
import { Play, Calendar, Edit3, Trash2, Check, X, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Article, WorkflowPhase } from "@/types";

interface ArticleCardProps {
  article: Article;
  mode: WorkflowPhase;
  onUpdate?: (articleId: string, updates: Partial<Article>) => Promise<void>;
  onDelete?: (articleId: string) => Promise<void>;
  onGenerate?: (articleId: string) => Promise<void>;
  onScheduleGeneration?: (
    articleId: string,
    scheduledAt: Date,
  ) => Promise<void>;
  onPublish?: (articleId: string) => Promise<void>;
  onSchedulePublishing?: (
    articleId: string,
    scheduledAt: Date,
  ) => Promise<void>;
  onNavigate?: (articleId: string) => void;
  className?: string;
}

export function ArticleCard({
  article,
  mode,
  onUpdate,
  onDelete,
  onGenerate,
  onScheduleGeneration,
  onPublish,
  onSchedulePublishing,
  onNavigate,
  className,
}: ArticleCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isScheduling, setIsScheduling] = useState(false);
  const [selectedScheduleTime, setSelectedScheduleTime] = useState<Date | undefined>();
  const [editData, setEditData] = useState({
    title: article.title,
    keywords: article.keywords?.join(", ") ?? "",
  });
  const [isUpdating, setIsUpdating] = useState(false);

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't navigate if clicking on interactive elements or during editing
    if (isEditing || isScheduling) return;

    const target = e.target as HTMLElement;
    const isInteractive =
      target.closest("button") ??
      target.closest("input") ??
      target.closest("a");

    if (!isInteractive && onNavigate) {
      e.preventDefault();
      onNavigate(article.id);
    }
  };

  const handleSave = async () => {
    if (!editData.title.trim() || !onUpdate) return;

    setIsUpdating(true);
    try {
      const keywords = editData.keywords
        .split(",")
        .map((k) => k.trim())
        .filter((k) => k.length > 0);

      await onUpdate(article.id, {
        title: editData.title.trim(),
        keywords: keywords.length > 0 ? keywords : [],
      });
      setIsEditing(false);
    } catch (error) {
      console.error("Failed to update article:", error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancel = () => {
    setEditData({
      title: article.title,
      keywords: article.keywords?.join(", ") ?? "",
    });
    setIsEditing(false);
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    if (window.confirm("Are you sure you want to delete this article?")) {
      await onDelete(article.id);
    }
  };

  const handleGenerate = async () => {
    if (onGenerate) {
      await onGenerate(article.id);
    }
  };

  const handlePublish = async () => {
    if (onPublish) {
      await onPublish(article.id);
    }
  };

  const handleScheduleGeneration = async (scheduledAt: Date) => {
    if (onScheduleGeneration) {
      await onScheduleGeneration(article.id, scheduledAt);
      setIsScheduling(false);
      setSelectedScheduleTime(undefined);
    }
  };

  const handleConfirmSchedule = async () => {
    if (selectedScheduleTime) {
      await handleScheduleGeneration(selectedScheduleTime);
    }
  };

  const handleSchedulePublishing = async (scheduledAt: Date) => {
    if (onSchedulePublishing) {
      await onSchedulePublishing(article.id, scheduledAt);
      setIsScheduling(false);
      setSelectedScheduleTime(undefined);
    }
  };

  // Determine what actions are available based on mode and status
  const canEdit =
    mode === "planning" &&
    (article.status === "idea" || article.status === "to_generate");
  const canDelete = mode === "planning" && article.status === "idea";
  const canGenerate =
    mode === "planning" &&
    (article.status === "idea" ||
      article.status === "to_generate" ||
      (article.status === "generating" && article.generationError));
  const canRetry =
    mode === "planning" &&
    article.status === "generating" &&
    article.generationError;
  const canPublish =
    mode === "publishing" && article.status === "wait_for_publish";
  const isGenerating = article.status === "generating";
  const isPublished = article.status === "published";

  return (
    <Card
      className={cn(
        "cursor-pointer transition-all duration-200 hover:shadow-md",
        {
          "border-blue-200 bg-blue-50": isGenerating,
          "border-green-200 bg-green-50": isPublished,
        },
        className,
      )}
      onClick={handleCardClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          {isEditing ? (
            <div className="min-w-0 flex-1 space-y-2">
              <input
                value={editData.title}
                onChange={(e) =>
                  setEditData({ ...editData, title: e.target.value })
                }
                className="w-full rounded border border-gray-200 bg-transparent px-2 py-1 text-sm font-medium outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Article title..."
                disabled={isUpdating}
                autoFocus
              />
              <input
                value={editData.keywords}
                onChange={(e) =>
                  setEditData({ ...editData, keywords: e.target.value })
                }
                className="w-full rounded border border-gray-200 bg-transparent px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="keyword1, keyword2, keyword3..."
                disabled={isUpdating}
              />
            </div>
          ) : (
            <CardTitle className="line-clamp-2 min-w-0 flex-1 text-sm font-medium">
              {article.title}
            </CardTitle>
          )}

          <div className="flex flex-shrink-0 items-center gap-1">
            {isEditing ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={handleSave}
                  disabled={isUpdating || !editData.title.trim()}
                >
                  <Check className="h-3 w-3 text-green-600" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={handleCancel}
                  disabled={isUpdating}
                >
                  <X className="h-3 w-3 text-gray-500" />
                </Button>
              </>
            ) : (
              <>
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsEditing(true);
                    }}
                  >
                    <Edit3 className="h-3 w-3" />
                  </Button>
                )}
                {canDelete && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleDelete();
                    }}
                  >
                    <Trash2 className="h-3 w-3 text-red-500" />
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col pt-0">
        {/* Keywords display - moved to top */}
        {article.keywords && article.keywords.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-1">
            {article.keywords.slice(0, 3).map((keyword, index) => (
              <Badge key={index} variant="outline" className="text-xs">
                {typeof keyword === "string" ? keyword : String(keyword)}
              </Badge>
            ))}
            {article.keywords.length > 3 && (
              <Badge variant="outline" className="text-xs">
                +{article.keywords.length - 3} more
              </Badge>
            )}
          </div>
        )}

        {/* Status indicator - only show for generating articles or if there's an error */}
        {(isGenerating || article.generationError) && (
          <StatusIndicator
            status={article.status}
            isScheduled={!!article.generationScheduledAt}
            progress={article.generationProgress}
            phase={article.generationPhase}
            error={article.generationError}
            estimatedCompletion={
              isGenerating && article.generationStartedAt ? "5 min" : undefined
            }
            className="mb-3"
          />
        )}

        {/* Publishing mode metadata */}
        {mode === "publishing" && (
          <div className="mb-3 space-y-1">
            {article.estimatedReadTime && (
              <div className="flex items-center gap-1 text-xs text-gray-600">
                <Clock className="h-3 w-3" />
                {article.estimatedReadTime} min read
              </div>
            )}

            {article.generationCompletedAt && (
              <div className="text-xs text-gray-600">
                Generated: {formatRelativeTime(article.generationCompletedAt)}
              </div>
            )}
          </div>
        )}

        {/* Spacer to push actions to bottom */}
        <div className="flex-1" />

        {/* Action buttons at bottom */}
        {!isEditing && (
          <div className="mt-4 space-y-2">
            {/* Show scheduled times */}
            {article.generationScheduledAt && (
              <div className="flex items-center gap-1 rounded bg-blue-50 p-2 text-xs text-blue-600">
                <Calendar className="h-3 w-3" />
                <span>
                  Scheduled: {formatRelativeTime(article.generationScheduledAt)}
                </span>
              </div>
            )}

            {article.publishScheduledAt && (
              <div className="flex items-center gap-1 rounded bg-green-50 p-2 text-xs text-green-600">
                <Calendar className="h-3 w-3" />
                <span>
                  Publish scheduled:{" "}
                  {formatRelativeTime(article.publishScheduledAt)}
                </span>
              </div>
            )}

            {/* Planning mode actions */}
            {mode === "planning" && canGenerate && (
              <>
                {/* Scheduling UI */}
                {isScheduling ? (
                  <div className="space-y-2">
                    <DateTimePicker
                      value={selectedScheduleTime}
                      onChange={setSelectedScheduleTime}
                      placeholder="Select date and time"
                      minDate={new Date(Date.now() + 60000)} // 1 minute from now
                      className="text-xs"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        onClick={() => {
                          setIsScheduling(false);
                          setSelectedScheduleTime(undefined);
                        }}
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs"
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleConfirmSchedule}
                        size="sm"
                        disabled={!selectedScheduleTime}
                        className="h-8 text-xs"
                      >
                        Schedule
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Show retry button for failed generations */}
                    {canRetry ? (
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleGenerate();
                        }}
                        size="sm"
                        className="h-9 w-full bg-red-600 text-sm text-white hover:bg-red-700"
                      >
                        <Play className="mr-2 h-4 w-4" />
                        Retry Generation
                      </Button>
                    ) : (
                      <div className="grid grid-cols-1 gap-2">
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleGenerate();
                          }}
                          size="sm"
                          className="h-9 bg-green-600 text-sm text-white hover:bg-green-700"
                        >
                          <Play className="mr-2 h-4 w-4" />
                          Generate Article
                        </Button>
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsScheduling(true);
                          }}
                          size="sm"
                          variant="outline"
                          className="h-9 text-sm"
                        >
                          <Calendar className="mr-2 h-4 w-4" />
                          Schedule Article
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </>
            )}

            {/* Publishing mode actions */}
            {mode === "publishing" && canPublish && (
              <>
                {/* Publishing UI */}
                {isScheduling ? (
                  <div className="space-y-2">
                    <DateTimePicker
                      value={selectedScheduleTime}
                      onChange={(date) => {
                        setSelectedScheduleTime(date);
                        if (date) {
                          void handleSchedulePublishing(date);
                        }
                      }}
                      placeholder="Select publish date and time"
                      minDate={new Date()}
                      className="text-xs"
                    />
                    <Button
                      onClick={() => {
                        setIsScheduling(false);
                        setSelectedScheduleTime(undefined);
                      }}
                      size="sm"
                      variant="outline"
                      className="h-8 w-full text-xs"
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2">
                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        void handlePublish();
                      }}
                      size="sm"
                      className="h-9 bg-blue-600 text-sm text-white hover:bg-blue-700"
                    >
                      <Check className="mr-2 h-4 w-4" />
                      Publish Article
                    </Button>
                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsScheduling(true);
                      }}
                      size="sm"
                      variant="outline"
                      className="h-9 text-sm"
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      Schedule Article
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
