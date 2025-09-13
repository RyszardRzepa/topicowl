"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { format, startOfWeek, addWeeks, subWeeks, isSameDay } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { toast } from "sonner";
import { useCurrentProjectId } from "@/contexts/project-context";
import { useWorkflowArticles } from "@/components/workflow/use-workflow-articles";
import type { Article } from "@/types";
import { cn } from "@/lib/utils";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Play,
  Loader2,
  Edit3,
  Settings as SettingsIcon,
  Zap,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import {
  STATUSES,
  getBoardEventConfig,
  type BoardEventConfig,
} from "@/lib/article-status";

type QueueItem = {
  id: number;
  articleId: number;
  title: string;
  addedToQueueAt: string;
  scheduledForDate: string;
  queuePosition: number;
  schedulingType: "manual" | "automatic";
  status: "queued" | "processing" | "completed" | "failed";
  attempts: number;
  errorMessage?: string;
};

function getWeekDays(baseDate: Date) {
  const start = startOfWeek(baseDate, { weekStartsOn: 1 });
  return Array.from(
    { length: 7 },
    (_, i) => new Date(start.getTime() + i * 24 * 60 * 60 * 1000),
  );
}

function isWithinWeek(dateIso: string, weekStart: Date) {
  const d = new Date(dateIso);
  const start = startOfWeek(weekStart, { weekStartsOn: 1 });
  const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
  return d >= start && d < end;
}

// Type for generation status API response
interface GenerationStatusResponse {
  progress?: number;
  phase?: Article["generationPhase"];
  status?: string;
}

export function ArticlesBoard() {
  const projectId = useCurrentProjectId();

  const {
    state: { articles },
    refetch: refetchArticles,
    actions,
  } = useWorkflowArticles();

  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());
  const [loadingQueue, setLoadingQueue] = useState(false);
  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [creatingAt, setCreatingAt] = useState<{
    date: Date;
    hour: number;
    minute: number;
  } | null>(null);
  const [createForm, setCreateForm] = useState<{
    title: string;
    keywords: string;
    notes: string;
  }>({ title: "", keywords: "", notes: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [loadingOperations, setLoadingOperations] = useState<
    Map<number, Set<"generate" | "edit" | "delete">>
  >(new Map());
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<QueueItem | null>(null);
  const [editArticle, setEditArticle] = useState<Article | null>(null);
  const [editForm, setEditForm] = useState<{
    title: string;
    keywords: string;
    notes: string;
    scheduledAt: Date | null;
  }>({ title: "", keywords: "", notes: "", scheduledAt: null });

  const isPastDay = useCallback((d: Date) => {
    const day = new Date(d);
    day.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return day.getTime() < today.getTime();
  }, []);

  const setOperationLoading = useCallback(
    (
      itemId: number,
      operation: "generate" | "edit" | "delete",
      loading: boolean,
    ) => {
      setLoadingOperations((prev) => {
        const newMap = new Map(prev);
        const existing = newMap.get(itemId) ?? new Set();
        const newSet = new Set(existing);
        if (loading) {
          newSet.add(operation);
        } else {
          newSet.delete(operation);
        }
        if (newSet.size === 0) {
          newMap.delete(itemId);
        } else {
          newMap.set(itemId, newSet);
        }
        return newMap;
      });
    },
    [],
  );

  const isOperationLoading = useCallback(
    (itemId: number, operation: "generate" | "edit" | "delete") => {
      return loadingOperations.get(itemId)?.has(operation) ?? false;
    },
    [loadingOperations],
  );

  const weekDays = useMemo(() => getWeekDays(currentDate), [currentDate]);

  const articleById = useMemo(() => {
    const map = new Map<number, Article>();
    for (const a of articles) map.set(parseInt(a.id), a);
    return map;
  }, [articles]);

  const scheduledItems = useMemo(() => {
    return queueItems.filter((q) => {
      const a = articleById.get(q.articleId);
      if (!a) return false;
      if (projectId && a.projectId !== projectId) return false;
      if (!q.scheduledForDate) return false;
      if (!isWithinWeek(q.scheduledForDate, weekDays[0]!)) return false;
      if (a.status === "generating") return false;
      return true;
    });
  }, [queueItems, articleById, projectId, weekDays]);

  const overdueQueueItemIds = useMemo(() => {
    const now = Date.now();
    return new Set(
      scheduledItems
        .filter((q) => new Date(q.scheduledForDate).getTime() < now)
        .map((q) => q.id),
    );
  }, [scheduledItems]);

  const generatingArticles = useMemo(() => {
    return articles.filter(
      (a) =>
        a.status === STATUSES.GENERATING &&
        (!projectId || a.projectId === projectId),
    );
  }, [articles, projectId]);

  const allBoardArticles = useMemo(() => {
    return articles.filter(
      (a) =>
        (!projectId || a.projectId === projectId) &&
        a.status !== STATUSES.DELETED,
    );
  }, [articles, projectId]);

  // Generate comprehensive board events using the status management system
  const allBoardEvents = useMemo<ArticleEvent[]>(() => {
    const events: ArticleEvent[] = [];

    // Create a map of queue items by article ID for easy lookup
    const queueItemsByArticleId = new Map(
      queueItems.map((q) => [q.articleId, q]),
    );

    // Process all visible articles
    for (const article of allBoardArticles) {
      const articleId = parseInt(article.id);
      const queueItem = queueItemsByArticleId.get(articleId);

      // Skip articles that are currently in the queue AND have idea/scheduled status
      // They'll be handled as queued items instead
      if (
        queueItem &&
        (article.status === STATUSES.IDEA ||
          article.status === STATUSES.SCHEDULED)
      ) {
        continue;
      }

      const eventConfig = getBoardEventConfig(
        article.status,
        !!article.publishScheduledAt,
      );

      // Determine the display date based on article status and scheduling
      let displayDate: string | null = null;

      switch (article.status) {
        case STATUSES.GENERATING:
          // For generating articles, prefer the original queue scheduled date if available
          displayDate =
            queueItem?.scheduledForDate ??
            article.publishScheduledAt ??
            article.generationStartedAt ??
            null;
          break;

        case STATUSES.WAIT_FOR_PUBLISH:
          // Show on scheduled publish date, fallback to generation completion date
          displayDate =
            article.publishScheduledAt ?? article.generationCompletedAt ?? null;
          break;

        case STATUSES.PUBLISHED:
          // Show on actual publish date, fallback to generation completion date
          displayDate =
            article.publishedAt ?? article.generationCompletedAt ?? null;
          break;

        case STATUSES.FAILED:
          // For failed articles, try to show on originally scheduled date
          displayDate =
            queueItem?.scheduledForDate ??
            article.publishScheduledAt ??
            article.generationCompletedAt ??
            article.generationStartedAt ??
            null;
          break;

        default:
          // For other statuses, use publish scheduled date or generation scheduled date
          displayDate =
            article.publishScheduledAt ?? article.generationScheduledAt ?? null;
          break;
      }

      // Only show articles with a valid display date that falls within the current week
      if (displayDate && isWithinWeek(displayDate, weekDays[0]!)) {
        events.push({
          id: article.id,
          dateIso: displayDate,
          title: article.title,
          article,
          eventConfig,
        });
      }
    }

    return events;
  }, [allBoardArticles, weekDays, queueItems]);

  type ArticleEvent = {
    id: string;
    dateIso: string;
    title: string;
    article: Article;
    eventConfig?: BoardEventConfig;
  };

  // Removed unused publishScheduledEvents and readyToPublishEvents
  // Now using getBoardEventConfig for comprehensive board event generation

  // Poll generation progress for generating articles
  useEffect(() => {
    if (generatingArticles.length === 0) return;
    const interval = setInterval(() => {
      void (async () => {
        try {
          const results = await Promise.all(
            generatingArticles.map(async (a) => {
              const res = await fetch(
                `/api/articles/${a.id}/generation-status`,
              );
              if (!res.ok) return null;
              const data = (await res.json()) as GenerationStatusResponse;
              return { id: a.id, data };
            }),
          );
          let needsRefresh = false;
          for (const r of results) {
            if (!r) continue;
            const { id, data } = r;
            const progress = Math.max(0, Math.min(100, data?.progress ?? 0));
            const phase = data?.phase;
            const status = data?.status;
            if (status === "completed" || status === "failed") {
              needsRefresh = true;
            } else {
              actions.setArticles((prev) =>
                prev.map((x) =>
                  x.id === id
                    ? {
                        ...x,
                        generationProgress: progress,
                        generationPhase: phase,
                      }
                    : x,
                ),
              );
            }
          }
          if (needsRefresh) await refetchArticles();
        } catch (e) {
          console.error("Polling error", e);
        }
      })();
    }, 5000);
    return () => clearInterval(interval);
  }, [generatingArticles, actions, refetchArticles]);

  const fetchQueue = useCallback(async () => {
    try {
      setLoadingQueue(true);
      const res = await fetch("/api/articles/generation-queue");
      if (!res.ok) throw new Error("Failed to load generation queue");
      const data = (await res.json()) as {
        success: boolean;
        data?: { articles: QueueItem[] };
      };
      if (data.success && data.data) {
        setQueueItems(data.data.articles);
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to load scheduled items");
    } finally {
      setLoadingQueue(false);
    }
  }, []);

  useEffect(() => {
    void fetchQueue();
  }, [fetchQueue]);

  const navigateWeek = (direction: "prev" | "next") => {
    setCurrentDate((prev) =>
      direction === "prev" ? subWeeks(prev, 1) : addWeeks(prev, 1),
    );
  };

  const goToToday = () => setCurrentDate(new Date());

  const openCreateForDay = (day: Date, defaultHour = 9, defaultMinute = 0) => {
    setCreatingAt({ date: day, hour: defaultHour, minute: defaultMinute });
    setIsCreating(true);
  };

  const createScheduledIdea = async () => {
    if (!projectId) return;
    if (!creatingAt) return;
    if (!createForm.title.trim()) return;

    try {
      setIsSubmitting(true);
      const createRes = await fetch("/api/articles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: createForm.title.trim(),
          keywords: createForm.keywords
            .split(",")
            .map((k) => k.trim())
            .filter((k) => k.length > 0),
          notes: createForm.notes.trim() ?? undefined,
          projectId,
        }),
      });
      if (!createRes.ok) throw new Error("Failed to create article");
      const created = (await createRes.json()) as { id: number; title: string };

      const localDateTime = new Date(creatingAt.date);
      localDateTime.setHours(creatingAt.hour, creatingAt.minute, 0, 0);
      if (localDateTime.getTime() < Date.now()) {
        toast.error("Cannot schedule in the past");
        setIsSubmitting(false);
        return;
      }
      const scheduledIso = localDateTime.toISOString();

      const queueRes = await fetch("/api/articles/generation-queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          articleId: created.id,
          scheduledForDate: scheduledIso,
        }),
      });
      if (!queueRes.ok) throw new Error("Failed to schedule article");

      try {
        const upd = await fetch(`/api/articles/${created.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ publishScheduledAt: scheduledIso }),
        });
        if (!upd.ok) throw new Error("Failed to update publish schedule");
      } catch (err) {
        console.error(err);
        toast.error("Scheduled generation, but failed to set publish time");
      }

      toast.success("Article scheduled for generation");
      setIsCreating(false);
      setCreateForm({ title: "", keywords: "", notes: "" });
      setCreatingAt(null);
      await Promise.all([refetchArticles(), fetchQueue()]);
    } catch (e) {
      console.error(e);
      toast.error("Failed to create and schedule article");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGenerateNow = async (item: QueueItem) => {
    try {
      setOperationLoading(item.id, "generate", true);
      await fetch(`/api/articles/generation-queue?queueItemId=${item.id}`, {
        method: "DELETE",
      });
      const res = await fetch(`/api/articles/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleId: String(item.articleId) }),
      });
      if (!res.ok) throw new Error("Failed to start generation");
      actions.setArticles((prev) =>
        prev.map((x) =>
          x.id === String(item.articleId)
            ? { ...x, status: "generating", generationProgress: 0 }
            : x,
        ),
      );
      toast.success("Generation started");
      await Promise.all([refetchArticles(), fetchQueue()]);
    } catch (e) {
      console.error(e);
      toast.error("Failed to start generation");
    } finally {
      setOperationLoading(item.id, "generate", false);
    }
  };

  const handleGenerateArticle = async (article: Article) => {
    try {
      setOperationLoading(parseInt(article.id), "generate", true);
      const res = await fetch(`/api/articles/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleId: article.id }),
      });
      if (!res.ok) throw new Error("Failed to start generation");
      actions.setArticles((prev) =>
        prev.map((x) =>
          x.id === article.id
            ? { ...x, status: "generating", generationProgress: 0 }
            : x,
        ),
      );
      toast.success("Generation started");
      await Promise.all([refetchArticles(), fetchQueue()]);
    } catch (e) {
      console.error(e);
      toast.error("Failed to start generation");
    } finally {
      setOperationLoading(parseInt(article.id), "generate", false);
    }
  };

  const handleDeleteArticle = async (item: QueueItem) => {
    try {
      setOperationLoading(item.id, "delete", true);
      const res = await fetch(`/api/articles/${item.articleId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete article");
      toast.success("Article deleted");
      await Promise.all([refetchArticles(), fetchQueue()]);
    } catch (e) {
      console.error(e);
      toast.error("Failed to delete article");
    } finally {
      setOperationLoading(item.id, "delete", false);
    }
  };

  const handleDeleteArticleDirectly = async (article: Article) => {
    try {
      setOperationLoading(parseInt(article.id), "delete", true);
      const res = await fetch(`/api/articles/${article.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete article");
      toast.success("Article deleted");
      await Promise.all([refetchArticles(), fetchQueue()]);
    } catch (e) {
      console.error(e);
      toast.error("Failed to delete article");
    } finally {
      setOperationLoading(parseInt(article.id), "delete", false);
    }
  };

  const openEditModal = (item: QueueItem) => {
    const article = articleById.get(item.articleId);
    setEditTarget(item);
    setEditForm({
      title: article?.title ?? item.title,
      keywords: (article?.keywords ?? []).join(", "),
      notes: article?.notes ?? "",
      scheduledAt: new Date(item.scheduledForDate),
    });
    setIsEditOpen(true);
  };

  const openEditModalForArticle = (article: Article) => {
    setEditTarget(null); // Clear queue item target
    setEditArticle(article); // Set article target
    setEditForm({
      title: article.title,
      keywords: (article.keywords ?? []).join(", "),
      notes: article.notes ?? "",
      scheduledAt: new Date(article.publishScheduledAt ?? article.generationScheduledAt ?? new Date()),
    });
    setIsEditOpen(true);
  };

  const handleEditSave = async () => {
    if (!editTarget && !editArticle) return;
    
    const article = editTarget 
      ? articleById.get(editTarget.articleId)
      : editArticle;
    
    if (!article) return;
    
    try {
      setIsUpdating(true);
      
      // Update article fields
      const updates: Partial<Article> = {};
      if (editForm.title.trim() !== article.title)
        updates.title = editForm.title.trim();
      const newKeywords = editForm.keywords
        .split(",")
        .map((k) => k.trim())
        .filter((k) => k.length > 0);
      if (
        JSON.stringify(newKeywords) !== JSON.stringify(article.keywords ?? [])
      )
        updates.keywords = newKeywords;
      if ((editForm.notes ?? "") !== (article.notes ?? ""))
        updates.notes = editForm.notes || undefined;
      
      // Update scheduling
      const newDt = editForm.scheduledAt;
      if (!newDt) throw new Error("Invalid schedule date");
      if (newDt.getTime() < Date.now())
        throw new Error("Cannot schedule in the past");
      const newIso = newDt.toISOString();
      
      // If editing via queue item, handle queue rescheduling
      if (editTarget) {
        const currentIso = new Date(editTarget.scheduledForDate).toISOString();
        
        // Update article fields if needed
        if (Object.keys(updates).length > 0) {
          const res = await fetch(`/api/articles/${article.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updates),
          });
          if (!res.ok) throw new Error("Failed to update article");
        }
        
        // Handle queue rescheduling if date changed
        if (newIso !== currentIso) {
          const del = await fetch(
            `/api/articles/generation-queue?queueItemId=${editTarget.id}`,
            { method: "DELETE" },
          );
          if (!del.ok) throw new Error("Failed to remove from queue");
          const add = await fetch("/api/articles/generation-queue", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              articleId: editTarget.articleId,
              scheduledForDate: newIso,
            }),
          });
          if (!add.ok) {
            await fetch("/api/articles/generation-queue", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                articleId: editTarget.articleId,
                scheduledForDate: currentIso,
              }),
            }).catch(() => {
              // Ignore restore errors
            });
            throw new Error("Failed to reschedule");
          }
          try {
            const upd = await fetch(`/api/articles/${editTarget.articleId}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ publishScheduledAt: newIso }),
            });
            if (!upd.ok) throw new Error("Failed to update publish schedule");
          } catch (err) {
            console.error(err);
            toast.error("Saved, but failed to set publish time");
          }
        }
      } else {
        // Editing article directly - update both article and schedule
        updates.publishScheduledAt = newIso;
        
        const res = await fetch(`/api/articles/${article.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });
        if (!res.ok) throw new Error("Failed to update article");
      }

      toast.success("Saved changes");
      setIsEditOpen(false);
      setEditTarget(null);
      setEditArticle(null);
      await Promise.all([refetchArticles(), fetchQueue()]);
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Failed to save changes");
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <TooltipProvider>
      <div className="bg-background flex h-full flex-col rounded-lg border">
        {/* Header */}
        <header className="border-border bg-card flex items-center justify-between rounded-t-lg border-b p-4">
          <div className="flex items-center gap-4">
            <h2 className="text-foreground text-xl font-bold">
              Articles Board
            </h2>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={goToToday}>
                Today
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigateWeek("prev")}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigateWeek("next")}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <div className="ml-2 flex items-center gap-2">
                <span className="text-foreground text-lg font-medium">
                  {format(weekDays[0]!, "MMMM yyyy")}
                </span>
                {(loadingQueue || isUpdating) && (
                  <div className="border-primary h-4 w-4 animate-spin rounded-full border-2 border-t-transparent" />
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Legend */}
            <div className="hidden items-center gap-3 text-xs md:flex">
              <div className="flex items-center gap-1">
                <span className="bg-chart-4 inline-block size-2.5 rounded-full" />
                <span className="text-muted-foreground">Idea</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="bg-chart-3 inline-block size-2.5 rounded-full" />
                <span className="text-muted-foreground">Generated</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="bg-chart-1 inline-block size-2.5 rounded-full" />
                <span className="text-muted-foreground">Published</span>
              </div>
            </div>

            {/* Settings */}
            <Button asChild variant="ghost" size="icon" aria-label="Settings">
              <a href="/dashboard/settings">
                <SettingsIcon className="h-4 w-4" />
              </a>
            </Button>

            {/* Overdue quick actions */}
            {Array.from(overdueQueueItemIds).length > 0 && (
              <div className="flex items-center gap-2">
                <div className="text-destructive text-sm font-medium">
                  Overdue: {overdueQueueItemIds.size}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    const overdue = scheduledItems.filter((s) =>
                      overdueQueueItemIds.has(s.id),
                    );
                    if (overdue.length === 0) return;
                    setIsUpdating(true);
                    try {
                      for (const item of overdue) {
                        const cur = new Date(item.scheduledForDate);
                        const next = new Date(cur);
                        next.setDate(cur.getDate() + 1);
                        if (next.getTime() < Date.now()) {
                          const now = new Date();
                          next.setFullYear(
                            now.getFullYear(),
                            now.getMonth(),
                            now.getDate() + 1,
                          );
                        }
                        await fetch(
                          `/api/articles/generation-queue?queueItemId=${item.id}`,
                          { method: "DELETE" },
                        );
                        await fetch("/api/articles/generation-queue", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            articleId: item.articleId,
                            scheduledForDate: next.toISOString(),
                          }),
                        });
                      }
                      toast.success("Rescheduled overdue items to tomorrow");
                    } catch (e) {
                      console.error(e);
                      toast.error("Failed to reschedule overdue items");
                    } finally {
                      setIsUpdating(false);
                      await fetchQueue();
                    }
                  }}
                >
                  Reschedule All Overdue
                </Button>
              </div>
            )}
          </div>
        </header>

        {/* Board Content */}
        <div className="flex-1 overflow-hidden">
          <div className="h-full overflow-auto overscroll-contain p-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-7 md:gap-3">
              {weekDays.map((day) => {
                // Get all events for this day using the new comprehensive system
                const dayEvents = allBoardEvents.filter((e) =>
                  isSameDay(new Date(e.dateIso), day),
                );

                // Also include queued items (they have a different data structure)
                const queuedForDay = scheduledItems.filter((s) =>
                  isSameDay(new Date(s.scheduledForDate), day),
                );

                // Combine all events with proper typing
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

                const allEventsForDay: Array<
                  BoardEvent & { priority: number; articleId: string }
                > = [
                  // Queue items (ideas, scheduled items not yet in generation)
                  ...queuedForDay.map((q) => ({
                    kind: "queued" as const,
                    key: `q-${q.id}`,
                    dateIso: q.scheduledForDate,
                    item: q,
                    title: articleById.get(q.articleId)?.title ?? q.title,
                    overdue: overdueQueueItemIds.has(q.id),
                    priority: 1,
                    articleId: String(q.articleId),
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
                                ev.overdue ? "bg-destructive/80" : "bg-chart-4",
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
                                      Idea
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
                                          article.status === STATUSES.FAILED);

                                      if (!shouldShowActions) return null;

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
                                                      void handleGenerateArticle(article);
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
                                                      void handleDeleteArticleDirectly(article);
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
                                                    void handleGenerateNow(
                                                      queueItem,
                                                    );
                                                  }}
                                                  disabled={isOperationLoading(
                                                    queueItem.id,
                                                    "generate",
                                                  )}
                                                  aria-label="Retry generation"
                                                >
                                                  {isOperationLoading(
                                                    queueItem.id,
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
                                      const scheduledDate = new Date(ev.dateIso);
                                      const isInPast = scheduledDate.getTime() < Date.now();
                                      const shouldShowActions = (
                                        // Show for idea and scheduled statuses that are not in the past
                                        !isInPast && (article.status === STATUSES.IDEA || 
                                                      article.status === STATUSES.SCHEDULED)
                                      );
                                      
                                      if (!shouldShowActions) return null;
                                      
                                      return (
                                        <div className="flex items-center gap-1">
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <button
                                                className="hover:bg-accent/40 text-foreground flex size-8 items-center justify-center rounded-full transition-colors"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  openEditModalForArticle(article);
                                                }}
                                                disabled={isOperationLoading(parseInt(article.id), "edit")}
                                                aria-label="Edit"
                                              >
                                                {isOperationLoading(parseInt(article.id), "edit") ? (
                                                  <Loader2 className="h-4 w-4 animate-spin" />
                                                ) : (
                                                  <Edit3 className="h-4 w-4" />
                                                )}
                                              </button>
                                            </TooltipTrigger>
                                            <TooltipContent side="top">Edit</TooltipContent>
                                          </Tooltip>
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <button
                                                className="hover:bg-accent/40 text-foreground flex size-8 items-center justify-center rounded-full transition-colors"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  void handleGenerateArticle(article);
                                                }}
                                                disabled={isOperationLoading(parseInt(article.id), "generate")}
                                                aria-label="Generate now"
                                              >
                                                {isOperationLoading(parseInt(article.id), "generate") ? (
                                                  <Loader2 className="h-4 w-4 animate-spin" />
                                                ) : (
                                                  <Play className="h-4 w-4" />
                                                )}
                                              </button>
                                            </TooltipTrigger>
                                            <TooltipContent side="top">Generate now</TooltipContent>
                                          </Tooltip>
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <button
                                                className="hover:bg-accent/40 text-destructive flex size-8 items-center justify-center rounded-full transition-colors"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  void handleDeleteArticleDirectly(article);
                                                }}
                                                disabled={isOperationLoading(parseInt(article.id), "delete")}
                                                aria-label="Delete article"
                                              >
                                                {isOperationLoading(parseInt(article.id), "delete") ? (
                                                  <Loader2 className="h-4 w-4 animate-spin" />
                                                ) : (
                                                  <Trash2 className="h-4 w-4" />
                                                )}
                                              </button>
                                            </TooltipTrigger>
                                            <TooltipContent side="top">Delete article</TooltipContent>
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

        {/* Create Modal */}
        <Dialog open={isCreating} onOpenChange={setIsCreating}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Schedule New Article</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-foreground mb-2 block text-sm font-medium">
                  Title
                </label>
                <Input
                  value={createForm.title}
                  onChange={(e) =>
                    setCreateForm((p) => ({ ...p, title: e.target.value }))
                  }
                  placeholder="Enter article title..."
                  autoFocus
                  disabled={isSubmitting}
                />
              </div>
              <div>
                <label className="text-foreground mb-2 block text-sm font-medium">
                  Keywords (optional)
                </label>
                <Input
                  value={createForm.keywords}
                  onChange={(e) =>
                    setCreateForm((p) => ({ ...p, keywords: e.target.value }))
                  }
                  placeholder="keyword1, keyword2"
                  disabled={isSubmitting}
                />
              </div>
              <div>
                <label className="text-foreground mb-2 block text-sm font-medium">
                  Notes (optional)
                </label>
                <Textarea
                  value={createForm.notes}
                  onChange={(e) =>
                    setCreateForm((p) => ({ ...p, notes: e.target.value }))
                  }
                  placeholder="Add notes or requirements..."
                  className="min-h-[80px] resize-none"
                  disabled={isSubmitting}
                />
              </div>
              <div>
                <label className="text-foreground mb-2 block text-sm font-medium">
                  Scheduled Time
                </label>
                <DateTimePicker
                  value={
                    creatingAt
                      ? new Date(
                          new Date(creatingAt.date).setHours(
                            creatingAt.hour,
                            creatingAt.minute,
                            0,
                            0,
                          ),
                        )
                      : undefined
                  }
                  onChange={(d) => {
                    if (!d) return;
                    setCreatingAt({
                      date: d,
                      hour: d.getHours(),
                      minute: d.getMinutes(),
                    });
                  }}
                  minDate={new Date(Date.now() + 60000)}
                />
              </div>
              {creatingAt && (
                <div className="text-muted-foreground text-xs">
                  Scheduled for{" "}
                  {format(
                    new Date(
                      new Date(creatingAt.date).setHours(
                        creatingAt.hour,
                        creatingAt.minute,
                        0,
                        0,
                      ),
                    ),
                    "EEE, MMM d @ h:mma",
                  )}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsCreating(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                onClick={createScheduledIdea}
                disabled={!createForm.title.trim() || isSubmitting}
              >
                {isSubmitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="mr-2 h-4 w-4" />
                )}
                {isSubmitting ? "Scheduling..." : "Schedule"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Modal */}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Scheduled Article</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-foreground mb-2 block text-sm font-medium">
                  Title
                </label>
                <Input
                  value={editForm.title}
                  onChange={(e) =>
                    setEditForm((p) => ({ ...p, title: e.target.value }))
                  }
                  placeholder="Article title"
                  disabled={isUpdating}
                />
              </div>
              <div>
                <label className="text-foreground mb-2 block text-sm font-medium">
                  Keywords (optional)
                </label>
                <Input
                  value={editForm.keywords}
                  onChange={(e) =>
                    setEditForm((p) => ({ ...p, keywords: e.target.value }))
                  }
                  placeholder="keyword1, keyword2"
                  disabled={isUpdating}
                />
              </div>
              <div>
                <label className="text-foreground mb-2 block text-sm font-medium">
                  Notes (optional)
                </label>
                <Textarea
                  value={editForm.notes}
                  onChange={(e) =>
                    setEditForm((p) => ({ ...p, notes: e.target.value }))
                  }
                  className="min-h-[80px] resize-none"
                  disabled={isUpdating}
                />
              </div>
              <div>
                <label className="text-foreground mb-2 block text-sm font-medium">
                  Scheduled Time
                </label>
                <DateTimePicker
                  value={editForm.scheduledAt ?? undefined}
                  onChange={(d) =>
                    setEditForm((p) => ({ ...p, scheduledAt: d ?? null }))
                  }
                  minDate={new Date(Date.now() + 60000)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsEditOpen(false)}
                disabled={isUpdating}
              >
                Cancel
              </Button>
              <Button
                onClick={handleEditSave}
                disabled={
                  isUpdating || !editForm.title.trim() || !editForm.scheduledAt
                }
              >
                {isUpdating ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                {isUpdating ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
