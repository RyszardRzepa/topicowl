"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
  const [selectedScheduleTime, setSelectedScheduleTime] = useState<
    Date | undefined
  >();
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
        "cursor-pointer transition-all duration-200 relative group",
        {
          "border-primary/20 bg-primary/5": isGenerating,
          "border-accent bg-accent/50": isPublished,
        },
        className,
      )}
      onClick={handleCardClick}
    >
      <CardHeader>
        {isEditing ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Article Title
              </label>
              <Input
                value={editData.title}
                onChange={(e) =>
                  setEditData({ ...editData, title: e.target.value })
                }
                className="text-base"
                placeholder="Enter article title..."
                disabled={isUpdating}
                autoFocus
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Keywords
              </label>
              <Input
                value={editData.keywords}
                onChange={(e) =>
                  setEditData({ ...editData, keywords: e.target.value })
                }
                className="text-sm"
                placeholder="keyword1, keyword2, keyword3..."
                disabled={isUpdating}
              />
              <p className="text-xs text-muted-foreground">
                Separate keywords with commas
              </p>
            </div>
          </div>
        ) : (
          <>
            <CardTitle className="line-clamp-2 min-w-0">
              {article.title}
            </CardTitle>

            {/* Keywords displayed directly under title */}
            {article.keywords && article.keywords.length > 0 && (
              <div className="mt-2">
                <div className="flex flex-wrap gap-1">
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
              </div>
            )}
          </>
        )}

        {/* Edit action buttons when editing */}
        {isEditing && (
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancel}
              disabled={isUpdating}
            >
              <X className="mr-2 h-4 w-4" />
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isUpdating || !editData.title.trim()}
            >
              <Check className="mr-2 h-4 w-4" />
              {isUpdating ? "Saving..." : "Save"}
            </Button>
          </div>
        )}
      </CardHeader>

      {/* Hover action buttons - positioned absolutely in top-right corner */}
      {!isEditing && (canEdit || canDelete) && (
        <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex gap-1 z-10">
          {canEdit && (
            <Button
              variant="secondary"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={(e) => {
                e.stopPropagation();
                setIsEditing(true);
              }}
            >
              <Edit3 className="h-4 w-4" />
            </Button>
          )}
          {canDelete && (
            <Button
              variant="secondary"
              size="sm"
              className="h-8 w-8 p-0 hover:bg-red-50 hover:text-red-600"
              onClick={(e) => {
                e.stopPropagation();
                void handleDelete();
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}

      <CardContent>
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
            className="mb-4"
          />
        )}

        {/* Publishing mode metadata */}
        {mode === "publishing" && (
          <div className="space-y-2">
            {article.estimatedReadTime && (
              <div className="flex items-center gap-2 text-sm text-stone-600">
                <Clock className="h-4 w-4" />
                {article.estimatedReadTime} min read
              </div>
            )}

            {article.generationCompletedAt && (
              <div className="text-sm">
                Generated: {formatRelativeTime(article.generationCompletedAt)}
              </div>
            )}
          </div>
        )}

        {/* Show scheduled times */}
        {article.generationScheduledAt && (
          <Alert className="border-primary/20 bg-primary/5 text-primary-foreground">
            <Calendar className="h-4 w-4" />
            <AlertDescription>
              Scheduled: {formatRelativeTime(article.generationScheduledAt)}
            </AlertDescription>
          </Alert>
        )}

        {article.publishScheduledAt && (
          <div className="rounded-lg bg-accent p-3 text-sm">
            <div className="flex items-center gap-2 text-accent-foreground">
              <Calendar className="h-4 w-4" />
              <span className="font-medium">Scheduled to publish</span>
            </div>
            <div className="mt-1 text-accent-foreground/80">
              {new Date(article.publishScheduledAt).toLocaleString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
              })}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {formatRelativeTime(article.publishScheduledAt)}
            </div>
          </div>
        )}
      </CardContent>

      {/* Action buttons in footer */}
      {!isEditing && (
        <CardFooter className="flex-col gap-2">
          {/* Planning mode actions */}
          {mode === "planning" && canGenerate && (
            <>
              {/* Scheduling UI */}
              {isScheduling ? (
                <div className="w-full space-y-3">
                  <DateTimePicker
                    value={selectedScheduleTime}
                    onChange={setSelectedScheduleTime}
                    placeholder="Select date and time"
                    minDate={new Date(Date.now() + 60000)} // 1 minute from now
                    className="w-full"
                  />
                  <div className="flex gap-2">
                    <Button
                      onClick={() => {
                        setIsScheduling(false);
                        setSelectedScheduleTime(undefined);
                      }}
                      size="sm"
                      variant="outline"
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleConfirmSchedule}
                      size="sm"
                      disabled={!selectedScheduleTime}
                      className="flex-1"
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
                      variant="destructive"
                      className="w-full"
                    >
                      <Play className="mr-2 h-4 w-4" />
                      Retry Generation
                    </Button>
                  ) : (
                    <div className="flex w-full gap-2">
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleGenerate();
                        }}
                        size="sm"
                      >
                        <Play className="mr-2 h-4 w-4" />
                        Generate
                      </Button>
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsScheduling(true);
                        }}
                        size="sm"
                        variant="outline"
                        className="flex-1"
                      >
                        <Calendar className="mr-2 h-4 w-4" />
                        Schedule Generation
                      </Button>
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {/* Publishing mode actions - only show for unscheduled articles */}
          {mode === "publishing" &&
            canPublish &&
            !article.publishScheduledAt && (
              <>
                {/* Publishing UI */}
                {isScheduling ? (
                  <div className="w-full space-y-3">
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
                      className="w-full"
                    />
                    <Button
                      onClick={() => {
                        setIsScheduling(false);
                        setSelectedScheduleTime(undefined);
                      }}
                      size="sm"
                      variant="outline"
                      className="w-full"
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <div className="flex w-full gap-2">
                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        void handlePublish();
                      }}
                      size="sm"
                      className="flex-1"
                    >
                      <Check className="mr-2 h-4 w-4" />
                      Publish
                    </Button>
                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsScheduling(true);
                      }}
                      size="sm"
                      variant="outline"
                      className="flex-1"
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      Schedule Publishing
                    </Button>
                  </div>
                )}
              </>
            )}

          {/* Simple reschedule action for already scheduled articles */}
          {mode === "publishing" && article.publishScheduledAt && (
            <>
              {isScheduling ? (
                <div className="w-full space-y-3">
                  <DateTimePicker
                    value={selectedScheduleTime}
                    onChange={(date) => {
                      setSelectedScheduleTime(date);
                      if (date) {
                        void handleSchedulePublishing(date);
                      }
                    }}
                    placeholder="Select new publishing date and time"
                    minDate={new Date()}
                    className="w-full"
                  />
                  <Button
                    onClick={() => {
                      setIsScheduling(false);
                      setSelectedScheduleTime(undefined);
                    }}
                    size="sm"
                    variant="outline"
                    className="w-full"
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsScheduling(true);
                  }}
                  size="sm"
                  variant="outline"
                  className="w-full"
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  Reschedule
                </Button>
              )}
            </>
          )}
        </CardFooter>
      )}
    </Card>
  );
}
