import { format, isSameDay } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { STATUSES, type BoardEventConfig } from "@/lib/article-status";
import {
  AlertTriangle,
  Calendar,
  Edit3,
  MoreHorizontal,
  Play,
  Plus,
  Send,
  Trash2,
  Zap,
} from "lucide-react";
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
  readonly queueItems: QueueItem[]; // Kept for interface compatibility but unused
  readonly allBoardEvents: ArticleEvent[];
  readonly articleById: Map<number, Article>;
  readonly overdueQueueItemIds: Set<number>;
  readonly isPastDay: (day: Date) => boolean;
  readonly isUpdating: boolean;
  readonly loadingOperations: Map<number, Set<OperationType>>;
  readonly isOperationLoading: (
    id: number,
    operation: OperationType,
  ) => boolean;
  readonly openCreateForDay: (day: Date) => void;
  readonly openEditModal: (item: QueueItem) => void;
  readonly openEditModalForArticle: (article: Article) => void;
  readonly handleGenerateNow: (item: QueueItem) => Promise<void>;
  readonly handleGenerateArticle: (article: Article) => Promise<void>;
  readonly handleDeleteArticle: (item: QueueItem) => Promise<void>;
  readonly handleDeleteArticleDirectly: (article: Article) => Promise<void>;
  readonly handleRetryGeneration: (article: Article) => Promise<void>;
  readonly handleRescheduleArticle: (article: Article) => Promise<void>;
  readonly handlePublishNow: (article: Article) => Promise<void>;
}

export function WeekGrid({
  weekDays,
  scheduledItems,
  queueItems: _queueItems,
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
  handlePublishNow,
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
                  new Date(a.dateIso).getTime() - new Date(b.dateIso).getTime(),
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
                                    const a = articleById.get(item.articleId);
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
                                  if (!article) return null;

                                  // Simple status-based logic
                                  if (article.status === STATUSES.SCHEDULED) {
                                    return (
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                          <Button variant="ghost" size="icon" className="size-8 shrink-0">
                                            <MoreHorizontal className="h-4 w-4" />
                                          </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                          <DropdownMenuItem
                                            onClick={() => {
                                              if (!isOperationLoading(parseInt(article.id), "publish")) {
                                                void handlePublishNow(article);
                                              }
                                            }}
                                            className={isOperationLoading(parseInt(article.id), "publish") ? "opacity-50 cursor-not-allowed" : ""}
                                          >
                                            <Send className="mr-2 h-4 w-4" />
                                            Publish now
                                          </DropdownMenuItem>
                                          <DropdownMenuItem
                                            onClick={() => {
                                              if (!isOperationLoading(parseInt(article.id), "edit")) {
                                                void handleRescheduleArticle(article);
                                              }
                                            }}
                                            className={isOperationLoading(parseInt(article.id), "edit") ? "opacity-50 cursor-not-allowed" : ""}
                                          >
                                            <Calendar className="mr-2 h-4 w-4" />
                                            Reschedule
                                          </DropdownMenuItem>
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    );
                                  }

                                  if (article.status === STATUSES.IDEA) {
                                    return (
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                          <Button variant="ghost" size="icon" className="size-8 shrink-0">
                                            <MoreHorizontal className="h-4 w-4" />
                                          </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                          <DropdownMenuItem
                                            onClick={() => {
                                              openEditModal(item);
                                            }}
                                          >
                                            <Edit3 className="mr-2 h-4 w-4" />
                                            Edit
                                          </DropdownMenuItem>
                                          <DropdownMenuItem
                                            onClick={() => {
                                              void handleGenerateNow(item);
                                            }}
                                          >
                                            <Play className="mr-2 h-4 w-4" />
                                            Generate now
                                          </DropdownMenuItem>
                                          <DropdownMenuItem
                                            onClick={() => {
                                              void handleDeleteArticle(item);
                                            }}
                                            className="text-destructive focus:text-destructive"
                                          >
                                            <Trash2 className="mr-2 h-4 w-4" />
                                            Delete article
                                          </DropdownMenuItem>
                                          <DropdownMenuItem
                                            onClick={() => {
                                              void handleRescheduleArticle(article);
                                            }}
                                          >
                                            <Calendar className="mr-2 h-4 w-4" />
                                            Reschedule
                                          </DropdownMenuItem>
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    );
                                  }

                                  // No actions for other statuses
                                  return null;
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
                                  
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="icon" className="size-8 shrink-0">
                                        <MoreHorizontal className="h-4 w-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem
                                        onClick={() => {
                                          void handleRetryGeneration(article);
                                        }}
                                      >
                                        <Play className="mr-2 h-4 w-4" />
                                        Retry generation
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        onClick={() => {
                                          void handleDeleteArticleDirectly(article);
                                        }}
                                        className="text-destructive focus:text-destructive"
                                      >
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        Delete article
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
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
                                  // Simple status-based logic
                                  if (article.status === STATUSES.SCHEDULED) {
                                    return (
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                          <Button variant="ghost" size="icon" className="size-8 shrink-0">
                                            <MoreHorizontal className="h-4 w-4" />
                                          </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                          <DropdownMenuItem
                                            onClick={() => {
                                              void handlePublishNow(article);
                                            }}
                                          >
                                            <Send className="mr-2 h-4 w-4" />
                                            Publish now
                                          </DropdownMenuItem>
                                          <DropdownMenuItem
                                            onClick={() => {
                                              void handleRescheduleArticle(article);
                                            }}
                                          >
                                            <Calendar className="mr-2 h-4 w-4" />
                                            Reschedule
                                          </DropdownMenuItem>
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    );
                                  }

                                  if (article.status === STATUSES.IDEA) {
                                    return (
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                          <Button variant="ghost" size="icon" className="size-8 shrink-0">
                                            <MoreHorizontal className="h-4 w-4" />
                                          </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                          <DropdownMenuItem
                                            onClick={() => {
                                              openEditModalForArticle(article);
                                            }}
                                          >
                                            <Edit3 className="mr-2 h-4 w-4" />
                                            Edit
                                          </DropdownMenuItem>
                                          <DropdownMenuItem
                                            onClick={() => {
                                              void handleGenerateArticle(article);
                                            }}
                                          >
                                            <Play className="mr-2 h-4 w-4" />
                                            Generate now
                                          </DropdownMenuItem>
                                          <DropdownMenuItem
                                            onClick={() => {
                                              void handleDeleteArticleDirectly(article);
                                            }}
                                            className="text-destructive focus:text-destructive"
                                          >
                                            <Trash2 className="mr-2 h-4 w-4" />
                                            Delete article
                                          </DropdownMenuItem>
                                          <DropdownMenuItem
                                            onClick={() => {
                                              void handleRescheduleArticle(article);
                                            }}
                                          >
                                            <Calendar className="mr-2 h-4 w-4" />
                                            Reschedule
                                          </DropdownMenuItem>
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    );
                                  }

                                  // No actions for other statuses
                                  return null;
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
