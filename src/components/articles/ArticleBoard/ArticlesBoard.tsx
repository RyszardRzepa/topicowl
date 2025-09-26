"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { addWeeks, startOfWeek, subWeeks } from "date-fns";
import { toast } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { useCurrentProjectId } from "@/contexts/project-context";
import { useWorkflowArticles } from "@/components/workflow/use-workflow-articles";
import { useTopicGenerationPolling } from "@/hooks/use-topic-generation-polling";
import type { Article } from "@/types";
import { STATUSES, getBoardEventConfig } from "@/lib/article-status";
import { BoardHeader } from "./BoardHeader";
import { WeekGrid } from "./WeekGrid";
import { CreateArticleDialog } from "./CreateArticleDialog";
import { EditArticleDialog } from "./EditArticleDialog";
import type {
  ArticleEvent,
  CreateFormState,
  EditFormState,
  GenerationStatusResponse,
  OperationType,
  QueueItem,
  ScheduleSelection,
} from "./types";

function getWeekDays(baseDate: Date) {
  const start = startOfWeek(baseDate, { weekStartsOn: 1 });
  return Array.from(
    { length: 7 },
    (_, i) => new Date(start.getTime() + i * 24 * 60 * 60 * 1000),
  );
}



function deriveGenerationPhase(status?: string): Article["generationPhase"] {
  switch (status) {
    case "research":
      return "research";
    case "writing":
      return "writing";
    case "quality-control":
      return "quality-control";
    case "validating":
      return "validation";
    case "updating":
    case "image":
      return "optimization";
    default:
      return undefined;
  }
}

export function ArticlesBoard() {
  const projectId = useCurrentProjectId();

  const {
    state: { articles },
    refetch: refetchArticles,
    actions,
  } = useWorkflowArticles();

  // Use the new topic generation hook
  const {
    isGenerating: isGeneratingTopics,
    taskStatus,
    startTopicGeneration,
  } = useTopicGenerationPolling();

  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());
  const [loadingQueue, setLoadingQueue] = useState(false);
  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [creatingAt, setCreatingAt] = useState<ScheduleSelection | null>(null);
  const [createForm, setCreateForm] = useState<CreateFormState>({
    title: "",
    keywords: "",
    notes: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [loadingOperations, setLoadingOperations] = useState<
    Map<number, Set<OperationType>>
  >(new Map());
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<QueueItem | null>(null);
  const [editArticle, setEditArticle] = useState<Article | null>(null);
  const [editForm, setEditForm] = useState<EditFormState>({
    title: "",
    keywords: "",
    notes: "",
    scheduledAt: null,
  });
  const [isRescheduleOpen, setIsRescheduleOpen] = useState(false);
  const [rescheduleArticle, setRescheduleArticle] = useState<Article | null>(
    null,
  );
  const [rescheduleDate, setRescheduleDate] = useState<Date | null>(null);

  const isPastDay = useCallback((d: Date) => {
    const day = new Date(d);
    day.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return day.getTime() < today.getTime();
  }, []);

  const setOperationLoading = useCallback(
    (itemId: number, operation: OperationType, loading: boolean) => {
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
    (itemId: number, operation: OperationType) => {
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
    const filtered = queueItems.filter((q) => {
      const a = articleById.get(q.articleId);

      if (!a) {
        return false;
      }

      if (projectId && a.projectId !== projectId) {
        return false;
      }

      // Only show items that are still queued; hide processing/completed/failed
      if (q.status !== "queued") {
        return false;
      }
      return true;
    });

    return filtered;
  }, [queueItems, articleById, projectId]);

  const overdueQueueItemIds = useMemo(() => {
    const now = Date.now();
    const overdue = new Set<number>();
    for (const item of scheduledItems) {
      const article = articleById.get(item.articleId);
      if (!article) {
        continue;
      }
      const columnDate =
        article.publishScheduledAt ??
        article.publishedAt ??
        item.scheduledForDate ??
        article.createdAt;
      if (!columnDate) {
        continue;
      }
      if (new Date(columnDate).getTime() < now) {
        overdue.add(item.id);
      }
    }
    return overdue;
  }, [scheduledItems, articleById]);

  const generatingArticles = useMemo(() => {
    return articles.filter(
      (a) =>
        a.status === STATUSES.GENERATING &&
        (!projectId || a.projectId === projectId),
    );
  }, [articles, projectId]);

  const allBoardArticles = useMemo(() => {
    const filtered = articles.filter(
      (a) => !projectId || a.projectId === projectId,
    );

    return filtered;
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
      // Don't skip failed articles - they need special failed article rendering
      // Exception: If queue item is completed/failed, show the article as a regular board event
      if (
        queueItem &&
        queueItem.status === "queued" &&
        (article.status === STATUSES.IDEA ||
          article.status === STATUSES.SCHEDULED)
      ) {
        continue;
      }

      const eventConfig = getBoardEventConfig(
        article.status,
        !!article.publishScheduledAt,
      );

      // Determine the display date:
      // Priority 1: publish_scheduled_at
      // Priority 2: published_at
      // Fallback: queue scheduled date, then creation date, so every article renders
      const displayDate =
        article.publishScheduledAt ??
        article.publishedAt ??
        queueItem?.scheduledForDate ??
        article.createdAt;

      if (!displayDate) {
        continue;
      }

      events.push({
        id: article.id,
        dateIso: displayDate,
        title: article.title,
        article,
        eventConfig,
      });
    }
    return events;
  }, [allBoardArticles, queueItems]);

  // Removed unused publishScheduledEvents and readyToPublishEvents
  // Now using getBoardEventConfig for comprehensive board event generation

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
            const phase = deriveGenerationPhase(data?.status);
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
          if (needsRefresh) {
            await Promise.all([refetchArticles(), fetchQueue()]);
          }
        } catch (e) {
          console.error("Polling error", e);
        }
      })();
    }, 5000);
    return () => clearInterval(interval);
  }, [generatingArticles, actions, refetchArticles, fetchQueue]);

  // Fallback: if queue reports an item is processing but the article status
  // hasn't updated yet, promote it to generating locally so UI reflects reality
  useEffect(() => {
    const processingItems = queueItems.filter(
      (item) => item.status === "processing",
    );
    if (processingItems.length === 0) return;
    const processingIds = new Set(
      processingItems.map((item) => String(item.articleId)),
    );
    actions.setArticles((prev) => {
      let changed = false;
      const updated = prev.map((article) => {
        if (
          !processingIds.has(article.id) ||
          article.status === STATUSES.GENERATING
        ) {
          return article;
        }
        changed = true;
        return {
          ...article,
          status: STATUSES.GENERATING,
          generationProgress: article.generationProgress ?? 0,
        };
      });
      return changed ? updated : prev;
    });
  }, [queueItems, actions]);

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
      const trimmedNotes = createForm.notes.trim();
      const createRes = await fetch("/api/articles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: createForm.title.trim(),
          keywords: createForm.keywords
            .split(",")
            .map((k) => k.trim())
            .filter((k) => k.length > 0),
          notes: trimmedNotes.length > 0 ? trimmedNotes : undefined,
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
      actions.setArticles((prev) =>
        prev.map((x) =>
          x.id === String(item.articleId)
            ? { ...x, status: "generating", generationProgress: 0 }
            : x,
        ),
      );
      await fetch(`/api/articles/generation-queue?queueItemId=${item.id}`, {
        method: "DELETE",
      });
      const res = await fetch(`/api/articles/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleId: String(item.articleId) }),
      });
      if (!res.ok) throw new Error("Failed to start generation");
      toast.success("Generation started");
      await fetchQueue();
    } catch (e) {
      console.error(e);
      toast.error("Failed to start generation");
      // Revert on error
      await Promise.all([refetchArticles(), fetchQueue()]);
    } finally {
      setOperationLoading(item.id, "generate", false);
    }
  };

  const handleGenerateArticle = async (article: Article) => {
    try {
      setOperationLoading(parseInt(article.id), "generate", true);
      actions.setArticles((prev) =>
        prev.map((x) =>
          x.id === article.id
            ? { ...x, status: "generating", generationProgress: 0 }
            : x,
        ),
      );
      const res = await fetch(`/api/articles/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleId: article.id }),
      });
      if (!res.ok) throw new Error("Failed to start generation");
      toast.success("Generation started");
      await fetchQueue();
    } catch (e) {
      console.error(e);
      toast.error("Failed to start generation");
      // Revert on error
      await Promise.all([refetchArticles(), fetchQueue()]);
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

  const handleRetryGeneration = async (article: Article) => {
    try {
      setOperationLoading(parseInt(article.id), "generate", true);
      actions.setArticles((prev) =>
        prev.map((x) =>
          x.id === article.id
            ? { ...x, status: "generating", generationProgress: 0 }
            : x,
        ),
      );
      const res = await fetch(`/api/articles/${article.id}/retry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error("Failed to retry generation");
      toast.success("Generation retry started");
      await fetchQueue();
    } catch (e) {
      console.error(e);
      toast.error("Failed to retry generation");
      // Revert on error
      await Promise.all([refetchArticles(), fetchQueue()]);
    } finally {
      setOperationLoading(parseInt(article.id), "generate", false);
    }
  };

  const handlePublishNow = async (article: Article) => {
    try {
      setOperationLoading(parseInt(article.id), "publish", true);
      const res = await fetch(`/api/articles/${article.id}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          articleId: parseInt(article.id),
          projectId: article.projectId,
        }),
      });
      if (!res.ok) throw new Error("Failed to publish article");
      toast.success("Article published");
      await refetchArticles();
    } catch (e) {
      console.error(e);
      toast.error("Failed to publish article");
    } finally {
      setOperationLoading(parseInt(article.id), "publish", false);
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
      scheduledAt: new Date(
        article.publishScheduledAt ??
          article.generationScheduledAt ??
          new Date(),
      ),
    });
    setIsEditOpen(true);
  };

  const handleRescheduleArticle = async (article: Article) => {
    setRescheduleArticle(article);
    setRescheduleDate(
      new Date(
        article.publishScheduledAt ??
          article.generationScheduledAt ??
          new Date(),
      ),
    );
    setIsRescheduleOpen(true);
  };

  const handleRescheduleSave = async () => {
    if (!rescheduleArticle || !rescheduleDate) return;

    try {
      setIsUpdating(true);
      const newIso = rescheduleDate.toISOString();

      const res = await fetch(`/api/articles/${rescheduleArticle.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publishScheduledAt: newIso }),
      });

      if (!res.ok) throw new Error("Failed to reschedule article");

      toast.success("Article rescheduled successfully");
      setIsRescheduleOpen(false);
      setRescheduleArticle(null);
      setRescheduleDate(null);
      await refetchArticles();
    } catch (e) {
      console.error(e);
      toast.error("Failed to reschedule article");
    } finally {
      setIsUpdating(false);
    }
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
      if ((editForm.notes ?? "") !== (article.notes ?? "")) {
        const nextNotes = editForm.notes ?? "";
        updates.notes = nextNotes.length > 0 ? nextNotes : undefined;
      }

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

  const weekStart = weekDays[0] ?? new Date();
  const isBusy = loadingQueue || isUpdating;

  return (
    <TooltipProvider>
      <div className="bg-background flex h-full flex-col rounded-lg border">
        <BoardHeader
          weekStart={weekStart}
          isBusy={isBusy}
          isGeneratingIdeas={isGeneratingTopics}
          onToday={goToToday}
          onPrevWeek={() => navigateWeek("prev")}
          onNextWeek={() => navigateWeek("next")}
          onGenerateIdeas={startTopicGeneration}
        />
        <WeekGrid
          weekDays={weekDays}
          scheduledItems={scheduledItems}
          queueItems={queueItems}
          allBoardEvents={allBoardEvents}
          articleById={articleById}
          overdueQueueItemIds={overdueQueueItemIds}
          isPastDay={isPastDay}
          isUpdating={isUpdating}
          loadingOperations={loadingOperations}
          isOperationLoading={isOperationLoading}
          openCreateForDay={openCreateForDay}
          openEditModal={openEditModal}
          openEditModalForArticle={openEditModalForArticle}
          handleGenerateNow={handleGenerateNow}
          handleGenerateArticle={handleGenerateArticle}
          handleDeleteArticle={handleDeleteArticle}
          handleDeleteArticleDirectly={handleDeleteArticleDirectly}
          handleRetryGeneration={handleRetryGeneration}
          handleRescheduleArticle={handleRescheduleArticle}
          handlePublishNow={handlePublishNow}
        />
        <CreateArticleDialog
          open={isCreating}
          onOpenChange={setIsCreating}
          form={createForm}
          onFormChange={setCreateForm}
          schedule={creatingAt}
          onScheduleChange={setCreatingAt}
          isSubmitting={isSubmitting}
          onSubmit={createScheduledIdea}
        />
        <EditArticleDialog
          open={isEditOpen}
          onOpenChange={setIsEditOpen}
          form={editForm}
          onFormChange={setEditForm}
          isUpdating={isUpdating}
          onSubmit={handleEditSave}
        />

        {/* Reschedule Date Dialog */}
        <Dialog open={isRescheduleOpen} onOpenChange={setIsRescheduleOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Reschedule Article</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-4">
              <div className="text-muted-foreground text-sm">
                {rescheduleArticle?.title && (
                  <div className="mb-2 font-medium">
                    {rescheduleArticle.title}
                  </div>
                )}
                Select a new date and time for this article:
              </div>
              <DateTimePicker
                value={rescheduleDate ?? undefined}
                onChange={(date) => setRescheduleDate(date ?? null)}
                minDate={new Date()}
                placeholder="Select date and time..."
              />
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsRescheduleOpen(false)}
                disabled={isUpdating}
              >
                Cancel
              </Button>
              <Button
                onClick={handleRescheduleSave}
                disabled={!rescheduleDate || isUpdating}
              >
                {isUpdating ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Topic Generation Banner */}
        {isGeneratingTopics && (
          <div className="bg-primary/10 border-primary/20 border-t p-3">
            <div className="flex items-center justify-center gap-3">
              <div className="border-primary h-4 w-4 animate-spin rounded-full border-2 border-t-transparent" />
              <span className="text-primary text-sm font-medium">
                {taskStatus?.status === "running"
                  ? `Researching topics for your project...`
                  : "Generating article ideas..."}
              </span>
              <span className="text-primary/70 text-xs">
                This may take a few minutes
              </span>
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
