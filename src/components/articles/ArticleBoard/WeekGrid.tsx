import { format, isSameDay } from "date-fns";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { STATUSES, type BoardEventConfig } from "@/lib/article-status";
import { AlertTriangle, Calendar, Edit3, Loader2, Play, Plus, Trash2, Zap } from "lucide-react";
import type { Article } from "@/types";
import type { ArticleEvent, OperationType, QueueItem } from "./types";

type BoardEvent =
  | {
      kind: "queued";
      key: string;
      dateIso: string;
      item: QueueItem;
      title: string;
      overdue: boolean;
    }
  | {
      kind: "article";
      key: string;
      dateIso: string;
      article: Article;
      title: string;
      config: BoardEventConfig;
    };

interface WeekGridProps {
  readonly weekDays: Date[];
  readonly scheduledItems: QueueItem[];
  readonly queueItems: QueueItem[];
  readonly allBoardEvents: ArticleEvent[];
  readonly articleById: Map<number, Article>;
  readonly overdueQueueItemIds: Set<number>;
  readonly isPastDay: (day: Date) => boolean;
  readonly isUpdating: boolean;
  readonly loadingOperations: Map<number, Set<OperationType>>;
  readonly isOperationLoading: (id: number, operation: OperationType) => boolean;
  readonly openCreateForDay: (day: Date) => void;
  readonly openEditModal: (item: QueueItem) => void;
  readonly openEditModalForArticle: (article: Article) => void;
  readonly handleGenerateNow: (item: QueueItem) => Promise<void>;
  readonly handleGenerateArticle: (article: Article) => Promise<void>;
  readonly handleDeleteArticle: (item: QueueItem) => Promise<void>;
  readonly handleDeleteArticleDirectly: (article: Article) => Promise<void>;
  readonly handleRetryGeneration: (article: Article) => Promise<void>;
  readonly handleRescheduleArticle: (article: Article) => Promise<void>;
}

export function WeekGrid({
  weekDays,
  scheduledItems,
  queueItems,
  allBoardEvents,
  articleById,
  overdueQueueItemIds,
  isPastDay,
  isUpdating,
  loadingOperations,
  isOperationLoading,
  openCreateForDay,
  openEditModal,
  openEditModalForArticle,
  handleGenerateNow,
  handleGenerateArticle,
  handleDeleteArticle,
  handleDeleteArticleDirectly,
  handleRetryGeneration,
  handleRescheduleArticle,
}: WeekGridProps) {
  return (

  <div className="flex-1 overflow-hidden">
    <div className="h-full overflow-auto overscroll-contain p-3">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-7 md:gap-3">
        {weekDays.map((day) => {
          // Get all events for this day using the new comprehensive system
          const dayEvents = allBoardEvents.filter((e) =>
            isSameDay(new Date(e.dateIso), day),
          );

          // Also include queued items (they have a different data structure)
          const queuedForDay = scheduledItems.flatMap((item) => {
            const article = articleById.get(item.articleId);
            if (!article) {
              return [];
            }
            const columnDate =
              article.publishScheduledAt ??
              article.publishedAt ??
              item.scheduledForDate ??
              article.createdAt;
            if (!columnDate) {
              return [];
            }
            return isSameDay(new Date(columnDate), day)
              ? [
                  {
                    item,
                    dateIso: columnDate,
                    article,
                  },
                ]
              : [];
          });

          // Combine all events with proper typing
          const allEventsForDay: Array<
            BoardEvent & { priority: number; articleId: string }
          > = [
            // Queue items (ideas, scheduled items not yet in generation)
            ...queuedForDay.map(({ item, dateIso, article }) => ({
              kind: "queued" as const,
              key: `q-${item.id}`,
              dateIso,
              item,
              title: article.title,
              overdue: overdueQueueItemIds.has(item.id),
              priority: 1,
              articleId: article.id,
            })),
            // All other article statuses
            ...dayEvents.map((e) => ({
              kind: "article" as const,
              key: `art-${e.id}`,
              dateIso: e.dateIso,
              article: e.article,
              title: e.title,
              config: e.eventConfig!,
              priority: e.eventConfig!.priority,
              articleId: e.article.id,
            })),
          ];

          // Remove duplicates by keeping the highest priority event for each article
          const bestByArticle = new Map<
            string,
            BoardEvent & { priority: number }
          >();
          for (const ev of allEventsForDay) {
            const current = bestByArticle.get(ev.articleId);
            if (!current || ev.priority < current.priority) {
              bestByArticle.set(ev.articleId, ev);
            }
          }

          const events = Array.from(bestByArticle.values())
            .map((e) => e as BoardEvent)
            .sort(
              (a, b) =>
                new Date(a.dateIso).getTime() -
                new Date(b.dateIso).getTime(),
            );

          return (
            <div
              key={day.toISOString()}
              className="flex min-h-0 flex-col overflow-hidden rounded-md border"
            >
              {/* Day header */}
              <div className="border-border bg-card flex items-center justify-between gap-2 rounded-t-md border-b p-2">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-xs uppercase">
                    {format(day, "EEE")}
                  </span>
                  <span
                    className={cn(
                      "text-lg font-medium",
                      isSameDay(day, new Date())
                        ? "bg-primary text-primary-foreground flex h-8 w-8 items-center justify-center rounded-full"
                        : "text-foreground",
                    )}
                  >
                    {format(day, "d")}
                  </span>
                </div>
                {!isPastDay(day) && (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => openCreateForDay(day)}
                    aria-label="Add idea"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                )}
              </div>

              {/* Events list */}
              <div
                className={cn(
                  "flex-1 space-y-2 p-2",
                  (isUpdating || loadingOperations.size > 0) &&
                    "pointer-events-none opacity-75",
                )}
              >
                {events.length === 0 ? (
                  <div className="text-muted-foreground text-xs">
                    No items
                  </div>
                ) : null}

                {events.map((ev) => {
                  const time = format(new Date(ev.dateIso), "HH:mm");

                  if (ev.kind === "queued") {
                    const item = ev.item;
                    return (
                      <div
                        key={ev.key}
                        className={cn(
                          "cursor-pointer rounded-md border p-2 text-white select-none",
                          ev.overdue
                            ? "bg-destructive/80"
                            : item.status === "queued"
                              ? "bg-chart-4"
                              : item.status === "processing"
                                ? "bg-muted text-foreground"
                                : "bg-muted/70 text-foreground",
                          "border-white/30",
                        )}
                      >
                        <Popover>
                          <PopoverTrigger asChild>
                            <div className="min-w-0">
                              <div className="text-xs leading-tight font-medium break-words whitespace-normal">
                                {time} — {ev.title}
                              </div>
                              <div className="text-[10px] opacity-90">
                                {item.status === "queued"
                                  ? "Idea"
                                  : item.status === "processing"
                                    ? "Processing"
                                    : item.status === "failed"
                                      ? "Failed"
                                      : "Queued"}
                              </div>
                            </div>
                          </PopoverTrigger>
                          <PopoverContent
                            className="w-[360px] rounded-xl p-3"
                            align="start"
                            sideOffset={8}
                            onOpenAutoFocus={(e) => e.preventDefault()}
                          >
                            <div className="flex items-start justify-between">
                              <div className="min-w-0 pr-3">
                                {(() => {
                                  const a = articleById.get(
                                    item.articleId,
                                  );
                                  const href = a?.slug
                                    ? `/articles/${a.slug}`
                                    : `/dashboard/articles/${a?.id ?? item.articleId}`;
                                  return (
                                    <a
                                      href={href}
                                      className="text-base leading-tight font-semibold break-words underline-offset-2 hover:underline"
                                    >
                                      {ev.title}
                                    </a>
                                  );
                                })()}
                                <div className="text-muted-foreground mt-1 text-sm">
                                  {format(
                                    new Date(item.scheduledForDate),
                                    "EEEE, MMMM d • h:mma",
                                  )}{" "}
                                  {ev.overdue && (
                                    <span className="text-destructive ml-2 font-medium">
                                      Overdue
                                    </span>
                                  )}
                                </div>
                              </div>
                              {(() => {
                                const article = articleById.get(
                                  item.articleId,
                                );
                                const scheduledDate = new Date(
                                  item.scheduledForDate,
                                );
                                const isInPast =
                                  scheduledDate.getTime() < Date.now();
                                const shouldShowActions =
                                  article &&
                                  // Show for idea phase that are not in the past
                                  ((!isInPast &&
                                    (article.status === STATUSES.IDEA ||
                                      article.status ===
                                        STATUSES.SCHEDULED)) ||
                                    // Show for failed articles regardless of time
                                    article.status === STATUSES.FAILED ||
                                    // Show for overdue scheduled articles (they need rescheduling)
                                    (isInPast && article.status === STATUSES.SCHEDULED));

                                if (!shouldShowActions) return null;

                                // For overdue scheduled articles, show only reschedule button
                                if (isInPast && article.status === STATUSES.SCHEDULED) {
                                  return (
                                    <div className="flex items-center gap-1">
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <button
                                            className="hover:bg-accent/40 text-foreground flex size-8 items-center justify-center rounded-full transition-colors"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              void handleRescheduleArticle(article);
                                            }}
                                            disabled={isOperationLoading(
                                              parseInt(article.id),
                                              "edit",
                                            )}
                                            aria-label="Reschedule date"
                                          >
                                            {isOperationLoading(
                                              parseInt(article.id),
                                              "edit",
                                            ) ? (
                                              <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                              <Calendar className="h-4 w-4" />
                                            )}
                                          </button>
                                        </TooltipTrigger>
                                        <TooltipContent side="top">
                                          Reschedule date
                                        </TooltipContent>
                                      </Tooltip>
                                    </div>
                                  );
                                }

                                // For non-overdue articles, show full action buttons
                                return (
                                  <div className="flex items-center gap-1">
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <button
                                          className="hover:bg-accent/40 text-foreground flex size-8 items-center justify-center rounded-full transition-colors"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            openEditModal(item);
                                          }}
                                          disabled={isOperationLoading(
                                            item.id,
                                            "edit",
                                          )}
                                          aria-label="Edit"
                                        >
                                          {isOperationLoading(
                                            item.id,
                                            "edit",
                                          ) ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                          ) : (
                                            <Edit3 className="h-4 w-4" />
                                          )}
                                        </button>
                                      </TooltipTrigger>
                                      <TooltipContent side="top">
                                        Edit
                                      </TooltipContent>
                                    </Tooltip>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <button
                                          className="hover:bg-accent/40 text-foreground flex size-8 items-center justify-center rounded-full transition-colors"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            void handleGenerateNow(item);
                                          }}
                                          disabled={isOperationLoading(
                                            item.id,
                                            "generate",
                                          )}
                                          aria-label="Generate now"
                                        >
                                          {isOperationLoading(
                                            item.id,
                                            "generate",
                                          ) ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                          ) : (
                                            <Play className="h-4 w-4" />
                                          )}
                                        </button>
                                      </TooltipTrigger>
                                      <TooltipContent side="top">
                                        Generate now
                                      </TooltipContent>
                                    </Tooltip>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <button
                                          className="hover:bg-accent/40 text-destructive flex size-8 items-center justify-center rounded-full transition-colors"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            void handleDeleteArticle(
                                              item,
                                            );
                                          }}
                                          disabled={isOperationLoading(
                                            item.id,
                                            "delete",
                                          )}
                                          aria-label="Delete article"
                                        >
                                          {isOperationLoading(
                                            item.id,
                                            "delete",
                                          ) ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                          ) : (
                                            <Trash2 className="h-4 w-4" />
                                          )}
                                        </button>
                                      </TooltipTrigger>
                                      <TooltipContent side="top">
                                        Delete article
                                      </TooltipContent>
                                    </Tooltip>
                                  </div>
                                );
                              })()}
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>
                    );
                  }

                  if (ev.kind === "article") {
                    const article = ev.article;
                    const config = ev.config;
                    const href = article.slug
                      ? `/articles/${article.slug}`
                      : `/dashboard/articles/${article.id}`;

                    // Special handling for generating articles
                    if (article.status === STATUSES.GENERATING) {
                      const progress = Math.max(
                        0,
                        Math.min(100, article.generationProgress ?? 0),
                      );
                      return (
                        <div
                          key={ev.key}
                          className={cn(
                            "cursor-pointer rounded-md border p-2 select-none",
                            "bg-card text-foreground border-white/30",
                          )}
                        >
                          <Popover>
                            <PopoverTrigger asChild>
                              <div className="min-w-0">
                                <div className="text-xs leading-tight font-medium break-words whitespace-normal">
                                  {time} — {ev.title}
                                </div>
                                <div className="text-muted-foreground mt-1 flex items-center gap-1 text-[10px]">
                                  <span className="bg-secondary inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium">
                                    <Zap className="h-3 w-3" />
                                    {article.generationPhase
                                      ? article.generationPhase
                                          .charAt(0)
                                          .toUpperCase() +
                                        article.generationPhase.slice(1)
                                      : "Processing"}
                                  </span>
                                </div>
                                <div className="mt-1">
                                  <div className="bg-muted h-[6px] rounded">
                                    <div
                                      className="bg-chart-3 h-[6px] rounded"
                                      style={{ width: `${progress}%` }}
                                    />
                                  </div>
                                  <div className="text-muted-foreground mt-1 text-[10px]">
                                    {progress}% complete
                                  </div>
                                </div>
                              </div>
                            </PopoverTrigger>
                            <PopoverContent
                              className="w-[360px] rounded-xl p-3"
                              align="start"
                              sideOffset={8}
                              onOpenAutoFocus={(e) => e.preventDefault()}
                            >
                              <div className="min-w-0 pr-3">
                                <div className="text-base leading-tight font-semibold break-words">
                                  {ev.title}
                                </div>
                                <div className="text-muted-foreground mt-1 flex items-center gap-2 text-sm">
                                  <span className="bg-secondary inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium">
                                    <Zap className="h-3 w-3" />
                                    {article.generationPhase
                                      ? article.generationPhase
                                          .charAt(0)
                                          .toUpperCase() +
                                        article.generationPhase.slice(1)
                                      : "Processing"}
                                  </span>
                                  <span>Creating content</span>
                                </div>
                                <div className="mt-2">
                                  <Progress value={progress} />
                                  <div className="text-muted-foreground mt-1 text-xs">
                                    {progress}% complete
                                  </div>
                                </div>
                              </div>
                            </PopoverContent>
                          </Popover>
                        </div>
                      );
                    }

                    // Special handling for failed articles
                    if (article.status === STATUSES.FAILED) {
                      return (
                        <div
                          key={ev.key}
                          className={cn(
                            "cursor-pointer rounded-md border p-2 text-white select-none",
                            config.bgColor,
                            "border-red-300",
                          )}
                        >
                          <Popover>
                            <PopoverTrigger asChild>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1 text-xs leading-tight font-medium break-words whitespace-normal">
                                  <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                                  {time} — {ev.title}
                                </div>
                                <div className="text-[10px] opacity-90">
                                  {config.label}
                                </div>
                              </div>
                            </PopoverTrigger>
                            <PopoverContent
                              className="w-[360px] rounded-xl p-3"
                              align="start"
                              sideOffset={8}
                              onOpenAutoFocus={(e) => e.preventDefault()}
                            >
                              <div className="flex items-start justify-between">
                                <div className="min-w-0 pr-3">
                                  <div className="flex items-center gap-2">
                                    <AlertTriangle className="h-4 w-4 flex-shrink-0 text-red-500" />
                                    <a
                                      href={href}
                                      className="text-base leading-tight font-semibold break-words underline-offset-2 hover:underline"
                                    >
                                      {ev.title}
                                    </a>
                                  </div>
                                  <div className="text-muted-foreground mt-1 text-sm">
                                    {format(
                                      new Date(ev.dateIso),
                                      "EEEE, MMMM d • h:mma",
                                    )}{" "}
                                    — {config.label.toLowerCase()}
                                  </div>
                                  {article.generationError && (
                                    <div className="mt-2 rounded bg-red-50 p-2 text-sm text-red-600">
                                      {article.generationError}
                                    </div>
                                  )}
                                </div>
                                {(() => {
                                  // Find the corresponding queue item
                                  const queueItem = queueItems.find(
                                    (q) =>
                                      q.articleId ===
                                      parseInt(article.id),
                                  );
                                  if (!queueItem) {
                                    // No queue item - use direct article handlers
                                    return (
                                      <div className="flex items-center gap-1">
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <button
                                              className="hover:bg-accent/40 text-foreground flex size-8 items-center justify-center rounded-full transition-colors"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                void handleRetryGeneration(
                                                  article,
                                                );
                                              }}
                                              disabled={isOperationLoading(
                                                parseInt(article.id),
                                                "generate",
                                              )}
                                            >
                                              {isOperationLoading(
                                                parseInt(article.id),
                                                "generate",
                                              ) ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                              ) : (
                                                <Play className="h-4 w-4" />
                                              )}
                                            </button>
                                          </TooltipTrigger>
                                          <TooltipContent side="top">
                                            Retry generation
                                          </TooltipContent>
                                        </Tooltip>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <button
                                              className="hover:bg-accent/40 text-destructive flex size-8 items-center justify-center rounded-full transition-colors"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                void handleDeleteArticleDirectly(
                                                  article,
                                                );
                                              }}
                                              disabled={isOperationLoading(
                                                parseInt(article.id),
                                                "delete",
                                              )}
                                              aria-label="Delete article"
                                            >
                                              {isOperationLoading(
                                                parseInt(article.id),
                                                "delete",
                                              ) ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                              ) : (
                                                <Trash2 className="h-4 w-4" />
                                              )}
                                            </button>
                                          </TooltipTrigger>
                                          <TooltipContent side="top">
                                            Delete article
                                          </TooltipContent>
                                        </Tooltip>
                                      </div>
                                    );
                                  }

                                  // If there's an actual queue item, use the regular action buttons
                                  return (
                                    <div className="flex items-center gap-1">
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <button
                                            className="hover:bg-accent/40 text-foreground flex size-8 items-center justify-center rounded-full transition-colors"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              openEditModal(queueItem);
                                            }}
                                            disabled={isOperationLoading(
                                              queueItem.id,
                                              "edit",
                                            )}
                                            aria-label="Edit"
                                          >
                                            {isOperationLoading(
                                              queueItem.id,
                                              "edit",
                                            ) ? (
                                              <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                              <Edit3 className="h-4 w-4" />
                                            )}
                                          </button>
                                        </TooltipTrigger>
                                        <TooltipContent side="top">
                                          Edit
                                        </TooltipContent>
                                      </Tooltip>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <button
                                            className="hover:bg-accent/40 text-foreground flex size-8 items-center justify-center rounded-full transition-colors"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              void handleRetryGeneration(
                                                article,
                                              );
                                            }}
                                            disabled={isOperationLoading(
                                              parseInt(article.id),
                                              "generate",
                                            )}
                                            aria-label="Retry generation"
                                          >
                                            {isOperationLoading(
                                              parseInt(article.id),
                                              "generate",
                                            ) ? (
                                              <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                              <Play className="h-4 w-4" />
                                            )}
                                          </button>
                                        </TooltipTrigger>
                                        <TooltipContent side="top">
                                          Retry generation
                                        </TooltipContent>
                                      </Tooltip>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <button
                                            className="hover:bg-accent/40 text-destructive flex size-8 items-center justify-center rounded-full transition-colors"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              void handleDeleteArticle(
                                                queueItem,
                                              );
                                            }}
                                            disabled={isOperationLoading(
                                              queueItem.id,
                                              "delete",
                                            )}
                                            aria-label="Delete article"
                                          >
                                            {isOperationLoading(
                                              queueItem.id,
                                              "delete",
                                            ) ? (
                                              <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                              <Trash2 className="h-4 w-4" />
                                            )}
                                          </button>
                                        </TooltipTrigger>
                                        <TooltipContent side="top">
                                          Delete article
                                        </TooltipContent>
                                      </Tooltip>
                                    </div>
                                  );
                                })()}
                              </div>
                            </PopoverContent>
                          </Popover>
                        </div>
                      );
                    }

                    // Default rendering for all other statuses
                    return (
                      <div
                        key={ev.key}
                        className={cn(
                          "cursor-pointer rounded-md border p-2 text-white select-none",
                          config.bgColor,
                          "border-white/30",
                        )}
                      >
                        <Popover>
                          <PopoverTrigger asChild>
                            <div className="min-w-0">
                              <div className="text-xs leading-tight font-medium break-words whitespace-normal">
                                {time} — {ev.title}
                              </div>
                              <div className="text-[10px] opacity-90">
                                {config.label}
                              </div>
                            </div>
                          </PopoverTrigger>
                          <PopoverContent
                            className="w-[360px] rounded-xl p-3"
                            align="start"
                            sideOffset={8}
                            onOpenAutoFocus={(e) => e.preventDefault()}
                          >
                            <div className="flex items-start justify-between">
                              <div className="min-w-0 pr-3">
                                <a
                                  href={href}
                                  className="text-base leading-tight font-semibold break-words underline-offset-2 hover:underline"
                                >
                                  {ev.title}
                                </a>
                                <div className="text-muted-foreground mt-1 text-sm">
                                  {format(
                                    new Date(ev.dateIso),
                                    "EEEE, MMMM d • h:mma",
                                  )}{" "}
                                  — {config.label.toLowerCase()}
                                </div>
                              </div>
                              {(() => {
                                // Show edit actions for all articles that reach this section
                                // (generating articles are handled in their own section above)
                                // Allow editing schedule date for generated, published, and all other statuses

                                return (
                                  <div className="flex items-center gap-1">
                                    {/* For idea articles, show full edit, generate, and delete buttons */}
                                    {article.status === STATUSES.IDEA && (
                                      <>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <button
                                              className="hover:bg-accent/40 text-foreground flex size-8 items-center justify-center rounded-full transition-colors"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                openEditModalForArticle(
                                                  article,
                                                );
                                              }}
                                              disabled={isOperationLoading(
                                                parseInt(article.id),
                                                "edit",
                                              )}
                                              aria-label="Edit"
                                            >
                                              {isOperationLoading(
                                                parseInt(article.id),
                                                "edit",
                                              ) ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                              ) : (
                                                <Edit3 className="h-4 w-4" />
                                              )}
                                            </button>
                                          </TooltipTrigger>
                                          <TooltipContent side="top">
                                            Edit
                                          </TooltipContent>
                                        </Tooltip>
                                        
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <button
                                              className="hover:bg-accent/40 text-foreground flex size-8 items-center justify-center rounded-full transition-colors"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                void handleGenerateArticle(
                                                  article,
                                                );
                                              }}
                                              disabled={isOperationLoading(
                                                parseInt(article.id),
                                                "generate",
                                              )}
                                              aria-label="Generate now"
                                            >
                                              {isOperationLoading(
                                                parseInt(article.id),
                                                "generate",
                                              ) ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                              ) : (
                                                <Play className="h-4 w-4" />
                                              )}
                                            </button>
                                          </TooltipTrigger>
                                          <TooltipContent side="top">
                                            Generate now
                                          </TooltipContent>
                                        </Tooltip>
                                        
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <button
                                              className="hover:bg-accent/40 text-destructive flex size-8 items-center justify-center rounded-full transition-colors"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                void handleDeleteArticleDirectly(
                                                  article,
                                                );
                                              }}
                                              disabled={isOperationLoading(
                                                parseInt(article.id),
                                                "delete",
                                              )}
                                              aria-label="Delete article"
                                            >
                                              {isOperationLoading(
                                                parseInt(article.id),
                                                "delete",
                                              ) ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                              ) : (
                                                <Trash2 className="h-4 w-4" />
                                              )}
                                            </button>
                                          </TooltipTrigger>
                                          <TooltipContent side="top">
                                            Delete article
                                          </TooltipContent>
                                        </Tooltip>
                                      </>
                                    )}
                                    
                                    {/* For scheduled articles, show only reschedule button */}
                                    {article.status === STATUSES.SCHEDULED && (
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <button
                                            className="hover:bg-accent/40 text-foreground flex size-8 items-center justify-center rounded-full transition-colors"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              void handleRescheduleArticle(article);
                                            }}
                                            disabled={isOperationLoading(
                                              parseInt(article.id),
                                              "edit",
                                            )}
                                            aria-label="Reschedule date"
                                          >
                                            {isOperationLoading(
                                              parseInt(article.id),
                                              "edit",
                                            ) ? (
                                              <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                              <Calendar className="h-4 w-4" />
                                            )}
                                          </button>
                                        </TooltipTrigger>
                                        <TooltipContent side="top">
                                          Reschedule date
                                        </TooltipContent>
                                      </Tooltip>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>
                    );
                  }

                  // Fallback for unknown event types
                  return null;
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  </div>

  );
}
