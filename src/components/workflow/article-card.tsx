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
import { Textarea } from "@/components/ui/textarea";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { StatusIndicator, formatRelativeTime } from "./status-indicator";
import {
  Play,
  Calendar,
  Edit3,
  Trash2,
  Check,
  X,
  Clock,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

import type { Article, WorkflowPhase } from "@/types";

interface ArticleCardProps {
  article: Article;
  mode: WorkflowPhase;
  isButtonLoading?: boolean;
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
  onCancelPublishSchedule?: (articleId: string) => Promise<void>;
  onNavigate?: (articleId: string) => void;
  className?: string;
}

export function ArticleCard({
  article,
  mode,
  isButtonLoading = false,
  onUpdate,
  onDelete,
  onGenerate,
  onScheduleGeneration,
  onPublish,
  onSchedulePublishing,
  onCancelPublishSchedule,
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
    notes: article.notes ?? "",
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
        notes: editData.notes.trim() || undefined,
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
      notes: article.notes ?? "",
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

  const handleConfirmPublishingSchedule = async () => {
    if (selectedScheduleTime) {
      await handleSchedulePublishing(selectedScheduleTime);
    }
  };

  const handleRemoveSchedule = async () => {
    if (!onUpdate) return;
    if (
      window.confirm(
        "Are you sure you want to remove the schedule and move this article back to ideas?",
      )
    ) {
      await onUpdate(article.id, {
        status: "idea",
        generationScheduledAt: undefined,
      });
    }
  };

  const handleCancelPublishSchedule = async () => {
    if (!onCancelPublishSchedule) return;
    if (
      window.confirm(
        "Cancel the publishing schedule and move article back to Ready to Publish?",
      )
    ) {
      await onCancelPublishSchedule(article.id);
    }
  };

  const generationComplete =
    (typeof article.generationProgress === "number" &&
      article.generationProgress >= 100) ||
    Boolean(article.content);

  const isReadyToPublish =
    article.status === "scheduled" &&
    generationComplete &&
    !article.generationPhase &&
    !article.generationError;

  // Determine what actions are available based on mode and status
  const canEdit =
    mode === "planning" &&
    (article.status === "idea" || article.status === "scheduled");
  const canDelete =
    (mode === "planning" && article.status === "idea") ||
    (mode === "publishing" && isReadyToPublish);
  const canGenerate =
    mode === "planning" &&
    (article.status === "idea" ||
      article.status === "scheduled" ||
      (article.status === "generating" && article.generationError));
  const canRetry =
    mode === "planning" &&
    article.status === "generating" &&
    article.generationError;
  const canReschedule =
    mode === "generations" &&
    article.status === "scheduled" &&
    article.generationScheduledAt;
  const canRemoveSchedule =
    mode === "generations" &&
    article.status === "scheduled" &&
    article.generationScheduledAt;
  const canPublish =
    mode === "publishing" && isReadyToPublish;
  const isGenerating = article.status === "generating";
  const isPublished = article.status === "published";

  // Debug logging for generating articles
  if (isGenerating) {
    console.log("ArticleCard: Generating article detected", {
      id: article.id,
      title: article.title,
      status: article.status,
      isGenerating,
    });
  }

  return (
    <Card
      className={cn(
        "group relative cursor-pointer transition-all duration-200",
        {
          "border-blue-200 bg-blue-50": isGenerating,
        },
        className,
      )}
      onClick={handleCardClick}
    >
      <CardHeader>
        {isEditing ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-foreground text-sm font-medium">
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
              <label className="text-foreground text-sm font-medium">
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
              <p className="text-muted-foreground text-xs">
                Separate keywords with commas
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-foreground text-sm font-medium">
                Notes
              </label>
              <Textarea
                value={editData.notes}
                onChange={(e) =>
                  setEditData({ ...editData, notes: e.target.value })
                }
                className="min-h-[80px] resize-none text-sm"
                placeholder="Add notes, context, or specific requirements for this article..."
                disabled={isUpdating}
              />
              <p className="text-muted-foreground text-xs">
                Provide additional context or requirements to guide AI
                generation
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
          <div className="flex justify-end gap-2 border-t pt-2">
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
      {(() => {
        const showHoverActions = [
          canEdit,
          canDelete,
          canRemoveSchedule,
          mode === "publishing" && !!article.publishScheduledAt,
        ].some(Boolean);
        if (isEditing || !showHoverActions) return null;
        return (
          <div className="absolute top-3 right-3 z-10 flex gap-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
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
            {canRemoveSchedule && (
              <Button
                variant="secondary"
                size="sm"
                className="h-8 w-8 p-0 hover:bg-red-50 hover:text-red-600"
                onClick={(e) => {
                  e.stopPropagation();
                  void handleRemoveSchedule();
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
            {mode === "publishing" && article.publishScheduledAt && (
              <Button
                variant="secondary"
                size="sm"
                title="Cancel publishing schedule"
                className="h-8 w-8 p-0 hover:bg-red-50 hover:text-red-600"
                onClick={(e) => {
                  e.stopPropagation();
                  void handleCancelPublishSchedule();
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        );
      })()}

      <CardContent className="space-y-3">
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
          />
        )}

        {/* Article metadata - consistent across all modes */}
        {(article.estimatedReadTime ?? article.generationCompletedAt) && (
          <div className="text-muted-foreground space-y-2 text-sm">
            {article.estimatedReadTime && (
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                {article.estimatedReadTime} min read
              </div>
            )}

            {article.generationCompletedAt && (
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4" />
                Generated: {formatRelativeTime(article.generationCompletedAt)}
              </div>
            )}
          </div>
        )}

        {/* Show scheduled times */}
        {article.generationScheduledAt && !isGenerating && (
          <div className="rounded-lg border p-3 text-sm">
            <div className="text-foreground flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span className="font-medium">Scheduled to generate</span>
            </div>
            <div className="text-muted-foreground mt-1">
              {new Date(article.generationScheduledAt).toLocaleString(
                undefined,
                {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                  hour12: true,
                },
              )}
            </div>
            <div className="text-muted-foreground mt-1 text-xs">
              {formatRelativeTime(article.generationScheduledAt)}
            </div>
          </div>
        )}

        {article.publishScheduledAt && (
          <div className="rounded-lg border p-3 text-sm">
            <div className="text-foreground flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span className="font-medium">Scheduled to publish</span>
            </div>
            <div className="text-muted-foreground mt-1">
              {new Date(article.publishScheduledAt).toLocaleString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
              })}
            </div>
            <div className="text-muted-foreground mt-1 text-xs">
              {formatRelativeTime(article.publishScheduledAt)}
            </div>
          </div>
        )}
      </CardContent>

      {/* Action buttons in footer */}
      {!isEditing && !isPublished && (
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
                      disabled={isButtonLoading}
                    >
                      {isButtonLoading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Play className="mr-2 h-4 w-4" />
                      )}
                      {isButtonLoading ? "Generating..." : "Retry Generation"}
                    </Button>
                  ) : (
                    <div className="flex w-full gap-2">
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleGenerate();
                        }}
                        size="sm"
                        disabled={isButtonLoading}
                      >
                        {isButtonLoading ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Play className="mr-2 h-4 w-4" />
                        )}
                        {isButtonLoading ? "Generating..." : "Generate"}
                      </Button>
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsScheduling(true);
                        }}
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        disabled={isButtonLoading}
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

          {/* Generations mode actions - reschedule for scheduled articles */}
          {mode === "generations" && canReschedule && (
            <>
              {/* Rescheduling UI */}
              {isScheduling ? (
                <div className="w-full space-y-3">
                  <DateTimePicker
                    value={selectedScheduleTime}
                    onChange={setSelectedScheduleTime}
                    placeholder="Select new date and time"
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
                      Reschedule
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex w-full gap-2">
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleGenerate();
                    }}
                    size="sm"
                    className="flex-1"
                    disabled={isButtonLoading}
                  >
                    {isButtonLoading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Play className="mr-2 h-4 w-4" />
                    )}
                    {isButtonLoading ? "Generating..." : "Generate Now"}
                  </Button>
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsScheduling(true);
                    }}
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    disabled={isButtonLoading}
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    Reschedule Generation
                  </Button>
                </div>
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
                      }}
                      placeholder="Select publish date and time"
                      minDate={new Date()}
                      className="w-full"
                    />
                    <div className="flex gap-2">
                      <Button
                        onClick={handleConfirmPublishingSchedule}
                        disabled={!selectedScheduleTime}
                        size="sm"
                        className="flex-1"
                      >
                        <Calendar className="mr-2 h-4 w-4" />
                        Schedule Publishing
                      </Button>
                      <Button
                        onClick={() => {
                          setIsScheduling(false);
                          setSelectedScheduleTime(undefined);
                        }}
                        size="sm"
                        variant="outline"
                      >
                        Cancel
                      </Button>
                    </div>
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
                      Schedule
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
                    }}
                    placeholder="Select new publishing date and time"
                    minDate={new Date()}
                    className="w-full"
                  />
                  <div className="flex gap-2">
                    <Button
                      onClick={handleConfirmPublishingSchedule}
                      disabled={!selectedScheduleTime}
                      size="sm"
                      className="flex-1"
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      Update Schedule
                    </Button>
                    <Button
                      onClick={() => {
                        setIsScheduling(false);
                        setSelectedScheduleTime(undefined);
                      }}
                      size="sm"
                      variant="outline"
                    >
                      Cancel
                    </Button>
                  </div>
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
                    Reschedule
                  </Button>
                </div>
              )}
            </>
          )}
        </CardFooter>
      )}
    </Card>
  );
}
