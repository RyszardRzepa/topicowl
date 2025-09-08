"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
// StatusIndicator no longer used in header; progress shown inside cards
import { Progress } from "@/components/ui/progress";

type QueueItem = {
  id: number; // queue item id
  articleId: number;
  title: string;
  addedToQueueAt: string; // ISO
  scheduledForDate: string; // ISO
  queuePosition: number;
  schedulingType: "manual" | "automatic";
  status: "queued" | "processing" | "completed" | "failed";
  attempts: number;
  errorMessage?: string;
};

// Overlap layout for queue items (Google Calendar style)
type TaskLayout = { left: string; width: string; zIndex: number };

function calculateQueueItemLayout(
  itemsForDay: QueueItem[],
): Map<number, TaskLayout> {
  const layoutMap = new Map<number, TaskLayout>();
  if (itemsForDay.length === 0) return layoutMap;

  const DURATION_MS = 60 * 60 * 1000; // 60 minutes per block

  const sorted = [...itemsForDay].sort((a, b) => {
    const aStart = new Date(a.scheduledForDate).getTime();
    const bStart = new Date(b.scheduledForDate).getTime();
    if (aStart !== bStart) return aStart - bStart;
    return a.id - b.id;
  });

  const groups: QueueItem[][] = [];
  let group: QueueItem[] = [sorted[0]!];
  let groupEnd = new Date(sorted[0]!.scheduledForDate).getTime() + DURATION_MS;

  for (let i = 1; i < sorted.length; i++) {
    const item = sorted[i]!;
    const start = new Date(item.scheduledForDate).getTime();
    if (start >= groupEnd) {
      groups.push(group);
      group = [item];
    } else {
      group.push(item);
    }
    groupEnd = Math.max(groupEnd, start + DURATION_MS);
  }
  groups.push(group);

  for (const g of groups) {
    const cols: QueueItem[][] = [];
    for (const item of g) {
      const start = new Date(item.scheduledForDate).getTime();
      let placed = false;
      for (const col of cols) {
        const last = col[col.length - 1]!;
        const lastEnd = new Date(last.scheduledForDate).getTime() + DURATION_MS;
        if (start >= lastEnd) {
          col.push(item);
          placed = true;
          break;
        }
      }
      if (!placed) cols.push([item]);
    }

    const total = cols.length;
    const groupMax = 90; // Keep a 10% margin for clicking empty area
    for (let c = 0; c < cols.length; c++) {
      for (const item of cols[c]!) {
        const base = groupMax / total;
        let width = base;
        let left = c * base;
        if (total === 1) {
          width = groupMax;
          left = 0;
        } else {
          const overlap = Math.min(2, base * 0.1);
          width = base + overlap;
          const adjust = Math.min(1, overlap * 0.5);
          left = c * base - adjust * c;
          if (left + width > groupMax) width = groupMax - left;
          left = Math.max(0, left);
        }
        layoutMap.set(item.id, {
          width: `${width}%`,
          left: `${left}%`,
          zIndex: 10 + c,
        });
      }
    }
  }

  return layoutMap;
}

// Visible time range
const VISIBLE_START_HOUR = 0;
const VISIBLE_END_HOUR = 24;
const VISIBLE_HOURS = VISIBLE_END_HOUR - VISIBLE_START_HOUR;
const DEFAULT_SCROLL_TO_HOUR = 7; // Start at 7 AM on initial view
const TASK_BLOCK_MINUTES = 60; // 1-hour blocks

const timeSlots = Array.from({ length: VISIBLE_HOURS }, (_, i) => ({
  hour: VISIBLE_START_HOUR + i,
  minute: 0,
  index: i,
}));

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

function getTaskPosition(dateIso: string) {
  const dt = new Date(dateIso);
  const hour = dt.getHours();
  const minute = dt.getMinutes();
  const minutesFromStart = (hour - VISIBLE_START_HOUR) * 60 + minute;
  const totalVisibleMinutes = VISIBLE_HOURS * 60;
  const heightPercent = (TASK_BLOCK_MINUTES / totalVisibleMinutes) * 100;
  const clampedMinutes = Math.max(
    0,
    Math.min(minutesFromStart, totalVisibleMinutes - TASK_BLOCK_MINUTES),
  );
  const topPercent = (clampedMinutes / totalVisibleMinutes) * 100;
  return { top: `${topPercent}%`, height: `${heightPercent}%` };
}

// Type for generation status API response
interface GenerationStatusResponse {
  progress?: number;
  phase?: Article["generationPhase"];
  status?: string;
}

export function ArticlesCalendar() {
  const projectId = useCurrentProjectId();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

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
  const [dragOverSlot, setDragOverSlot] = useState<{
    day: Date;
    hour: number;
    minute: number;
  } | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<QueueItem | null>(null);
  const [editForm, setEditForm] = useState<{
    title: string;
    keywords: string;
    notes: string;
    scheduledAt: Date | null;
  }>({ title: "", keywords: "", notes: "", scheduledAt: null });
  // In-place anchors for generating articles (keeps them visible in their original slot)
  const [generatingSlots, setGeneratingSlots] = useState<Map<number, string>>(new Map());

  // View mode: timeline (current) or board (kanban-style by day)
  const [viewMode, setViewMode] = useState<"timeline" | "board">("board");

  const isPastDay = useCallback((d: Date) => {
    const day = new Date(d);
    day.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return day.getTime() < today.getTime();
  }, []);

  // Auto-scroll to morning
  useEffect(() => {
    if (scrollContainerRef.current) {
      const hourHeight = 64; // h-16
      scrollContainerRef.current.scrollTop =
        DEFAULT_SCROLL_TO_HOUR * hourHeight;
    }
  }, [currentDate]);

  const weekDays = useMemo(() => getWeekDays(currentDate), [currentDate]);

  const articleById = useMemo(() => {
    const map = new Map<number, Article>();
    for (const a of articles) map.set(parseInt(a.id), a);
    return map;
  }, [articles]);

  const scheduledItems = useMemo(() => {
    // Show all queued items for the displayed week (future + overdue), but hide ones already generating
    return queueItems.filter((q) => {
      const a = articleById.get(q.articleId);
      if (!a) return false;
      if (projectId && a.projectId !== projectId) return false;
      if (!q.scheduledForDate) return false;
      if (!isWithinWeek(q.scheduledForDate, weekDays[0]!)) return false;
      // If article is already generating, don't show the queued block to avoid duplicates
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
        a.status === "generating" && (!projectId || a.projectId === projectId),
    );
  }, [articles, projectId]);

  // Remove anchors when generation finishes
  useEffect(() => {
    setGeneratingSlots((prev) => {
      const next = new Map(prev);
      for (const [aid] of next) {
        const a = articleById.get(aid);
        if (!a || a.status !== "generating") next.delete(aid);
      }
      return next;
    });
  }, [articles, articleById]);

  type ArticleEvent = {
    id: string;
    dateIso: string;
    title: string;
    article: Article;
  };

  const publishScheduledEvents = useMemo<ArticleEvent[]>(() => {
    return articles
      .filter(
        (a) =>
          (!projectId || a.projectId === projectId) &&
          !!a.publishScheduledAt &&
          isWithinWeek(a.publishScheduledAt, weekDays[0]!),
      )
      .map((a) => ({
        id: a.id,
        dateIso: a.publishScheduledAt!,
        title: a.title,
        article: a,
      }));
  }, [articles, projectId, weekDays]);

  const publishedEvents = useMemo<ArticleEvent[]>(() => {
    return articles
      .filter(
        (a) =>
          (!projectId || a.projectId === projectId) &&
          !!a.publishedAt &&
          isWithinWeek(a.publishedAt, weekDays[0]!),
      )
      .map((a) => ({
        id: a.id,
        dateIso: a.publishedAt!,
        title: a.title,
        article: a,
      }));
  }, [articles, projectId, weekDays]);

  const generationScheduledEvents = useMemo<ArticleEvent[]>(() => {
    // Use generationScheduledAt from board for legacy/previously scheduled items
    const events = articles
      .filter(
        (a) =>
          (!projectId || a.projectId === projectId) &&
          !!a.generationScheduledAt &&
          isWithinWeek(a.generationScheduledAt, weekDays[0]!),
      )
      .map((a) => ({
        id: a.id,
        dateIso: a.generationScheduledAt!,
        title: a.title,
        article: a,
      }));
    // Remove ones that already exist in queue to avoid duplicates
    const queuedIds = new Set(scheduledItems.map((q) => String(q.articleId)));
    return events.filter((e) => !queuedIds.has(e.id));
  }, [articles, projectId, weekDays, scheduledItems]);

  // Generating items placed on the calendar grid
  const generatingCalendarEvents = useMemo<ArticleEvent[]>(() => {
    const evs: ArticleEvent[] = [];
    for (const a of generatingArticles) {
      const anchorIso = generatingSlots.get(parseInt(a.id)) ?? a.generationScheduledAt;
      if (!anchorIso) continue;
      if (!isWithinWeek(anchorIso, weekDays[0]!)) continue;
      evs.push({ id: a.id, dateIso: anchorIso, title: a.title, article: a });
    }
    return evs;
  }, [generatingArticles, generatingSlots, weekDays]);

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

  const openCreateAtSlot = (day: Date, hour: number, minute: number) => {
    const now = new Date();
    const slot = new Date(day);
    slot.setHours(hour, minute, 0, 0);
    if (slot.getTime() < now.getTime()) {
      toast.error("Cannot schedule in the past");
      return;
    }
    setCreatingAt({ date: day, hour, minute });
    setIsCreating(true);
  };

  const openCreateForDay = (day: Date, defaultHour = 9, defaultMinute = 0) => {
    // For board view quick-add. Allow past times here; user can adjust in picker, but clamp to future on save
    setCreatingAt({ date: day, hour: defaultHour, minute: defaultMinute });
    setIsCreating(true);
  };

  const createScheduledIdea = async () => {
    if (!projectId) return;
    if (!creatingAt) return;
    if (!createForm.title.trim()) return;

    try {
      setIsSubmitting(true);
      // 1) Create idea
      const createRes = await fetch("/api/articles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: createForm.title.trim(),
          keywords: createForm.keywords
            .split(",")
            .map((k) => k.trim())
            .filter((k) => k.length > 0),
          notes: createForm.notes.trim() || undefined,
          projectId,
        }),
      });
      if (!createRes.ok) throw new Error("Failed to create article");
      const created = (await createRes.json()) as { id: number; title: string };

      // 2) Schedule via generation queue
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

  const onDragStart = (e: React.DragEvent, articleId: number) => {
    if (isUpdating) return;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(articleId));
  };

  const onDragEnd = () => {
    setDragOverSlot(null);
  };

  const onDragOver = (
    e: React.DragEvent,
    day: Date,
    hour: number,
    minute: number,
  ) => {
    e.preventDefault();
    if (
      !dragOverSlot ||
      dragOverSlot.day.getTime() !== day.getTime() ||
      dragOverSlot.hour !== hour ||
      dragOverSlot.minute !== minute
    ) {
      setDragOverSlot({ day, hour, minute });
    }
  };

  const onDrop = async (
    e: React.DragEvent,
    day: Date,
    hour: number,
    minute: number,
  ) => {
    e.preventDefault();
    const idStr = e.dataTransfer.getData("text/plain");
    const aId = parseInt(idStr, 10);
    if (!aId || isNaN(aId)) return;

    const item = scheduledItems.find((s) => s.articleId === aId);
    if (!item) return;

    // Build new date and guard against past
    const newDate = new Date(day);
    newDate.setHours(hour, minute, 0, 0);
    if (newDate.getTime() < Date.now()) {
      toast.error("Cannot move to the past");
      return;
    }

    const current = new Date(item.scheduledForDate);
    if (current.getTime() === newDate.getTime()) return; // no change

    try {
      setIsUpdating(true);
      // DELETE old queue item, then POST new one
      const del = await fetch(
        `/api/articles/generation-queue?queueItemId=${item.id}`,
        { method: "DELETE" },
      );
      if (!del.ok) throw new Error("Failed to remove from queue");
      const add = await fetch("/api/articles/generation-queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          articleId: item.articleId,
          scheduledForDate: newDate.toISOString(),
        }),
      });
      if (!add.ok) throw new Error("Failed to reschedule");
      toast.success("Rescheduled successfully");
      await fetchQueue();
    } catch (err) {
      console.error(err);
      toast.error("Failed to reschedule");
    } finally {
      setIsUpdating(false);
      setDragOverSlot(null);
    }
  };

  // Board drop handler: drop onto a day keeps the item's existing time
  const onDropToDay = async (e: React.DragEvent, day: Date) => {
    e.preventDefault();
    const idStr = e.dataTransfer.getData("text/plain");
    const aId = parseInt(idStr, 10);
    if (!aId || isNaN(aId)) return;

    const item = scheduledItems.find((s) => s.articleId === aId);
    if (!item) return;

    const original = new Date(item.scheduledForDate);
    const newDate = new Date(day);
    newDate.setHours(original.getHours(), original.getMinutes(), 0, 0);
    if (newDate.getTime() < Date.now()) {
      toast.error("Cannot move to the past");
      return;
    }
    if (newDate.getTime() === original.getTime()) return;

    try {
      setIsUpdating(true);
      const del = await fetch(`/api/articles/generation-queue?queueItemId=${item.id}`, {
        method: "DELETE",
      });
      if (!del.ok) throw new Error("Failed to remove from queue");
      const add = await fetch("/api/articles/generation-queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          articleId: item.articleId,
          scheduledForDate: newDate.toISOString(),
        }),
      });
      if (!add.ok) throw new Error("Failed to reschedule");
      toast.success("Rescheduled successfully");
      await fetchQueue();
    } catch (err) {
      console.error(err);
      toast.error("Failed to reschedule");
    } finally {
      setIsUpdating(false);
      setDragOverSlot(null);
    }
  };

  const handleGenerateNow = async (item: QueueItem) => {
    try {
      setIsUpdating(true);
      // Keep this item's slot visible while generating
      setGeneratingSlots((prev) => {
        const next = new Map(prev);
        next.set(item.articleId, item.scheduledForDate);
        return next;
      });
      // optional cleanup
      await fetch(`/api/articles/generation-queue?queueItemId=${item.id}`, {
        method: "DELETE",
      });
      const res = await fetch(`/api/articles/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleId: String(item.articleId) }),
      });
      if (!res.ok) throw new Error("Failed to start generation");
      // Optimistically mark as generating so the in-place card appears immediately
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
      setIsUpdating(false);
    }
  };

  const handleDeleteArticle = async (item: QueueItem) => {
    try {
      setIsUpdating(true);
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
      setIsUpdating(false);
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

  const handleEditSave = async () => {
    if (!editTarget) return;
    const article = articleById.get(editTarget.articleId);
    if (!article) return;
    try {
      setIsUpdating(true);
      // Update article fields if changed
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
      if (Object.keys(updates).length > 0) {
        const res = await fetch(`/api/articles/${article.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });
        if (!res.ok) throw new Error("Failed to update article");
      }

      // Reschedule if changed
      const currentIso = new Date(editTarget.scheduledForDate).toISOString();
      const newDt = editForm.scheduledAt;
      if (!newDt) throw new Error("Invalid schedule date");
      if (newDt.getTime() < Date.now())
        throw new Error("Cannot schedule in the past");
      const newIso = newDt.toISOString();
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
          // try to restore original
          await fetch("/api/articles/generation-queue", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              articleId: editTarget.articleId,
              scheduledForDate: currentIso,
            }),
          }).catch(() => {
            // Ignore restore errors - already handled
          });
          throw new Error("Failed to reschedule");
        }
      }

      toast.success("Saved changes");
      setIsEditOpen(false);
      setEditTarget(null);
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
              Articles Calendar
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
              {/* View toggle */}
              <div className="ml-2 hidden items-center gap-1 sm:flex">
                <Button
                  size="sm"
                  variant={viewMode === "board" ? "default" : "outline"}
                  onClick={() => setViewMode("board")}
                >
                  Board
                </Button>
                <Button
                  size="sm"
                  variant={viewMode === "timeline" ? "default" : "outline"}
                  onClick={() => setViewMode("timeline")}
                >
                  Timeline
                </Button>
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
            <Button asChild variant="ghost" size="icon" aria-label="Calendar settings">
              <a href="/dashboard/settings">
                <SettingsIcon className="h-4 w-4" />
              </a>
            </Button>

            {/* Generating summary removed */}
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
                    // Reschedule all overdue to tomorrow at same time
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
                        // Keep same hour/min; ensure future
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

        {/* Generating banner removed: show progress inside calendar cards */}

        {/* Calendar Content */}
        <div className="flex-1 overflow-hidden">
          {viewMode === "timeline" ? (
            <div ref={scrollContainerRef} className="h-full overflow-auto overscroll-contain">
              <div className="grid h-full grid-cols-8">
              {/* Time column */}
              <div className="border-border bg-muted/30 border-r">
                <div className="border-border bg-card sticky top-0 z-20 h-16 border-b"></div>
                {timeSlots.map((slot) => (
                  <div
                    key={slot.index}
                    className="border-border flex h-16 items-start justify-end border-b pt-1 pr-2"
                  >
                    <span className="text-muted-foreground text-xs">
                      {slot.hour === 0
                        ? "12 AM"
                        : slot.hour < 12
                          ? `${slot.hour} AM`
                          : slot.hour === 12
                            ? "12 PM"
                            : `${slot.hour - 12} PM`}
                    </span>
                  </div>
                ))}
              </div>

              {/* Day columns */}
              {weekDays.map((day) => {
                const itemsForDay = scheduledItems.filter((s) =>
                  isSameDay(new Date(s.scheduledForDate), day),
                );
                const queueLayouts = calculateQueueItemLayout(itemsForDay);
                const publishScheduledForDay = publishScheduledEvents.filter(
                  (e) => isSameDay(new Date(e.dateIso), day),
                );
                const publishedForDay = publishedEvents.filter((e) =>
                  isSameDay(new Date(e.dateIso), day),
                );
                const generationScheduledForDay =
                  generationScheduledEvents.filter((e) =>
                    isSameDay(new Date(e.dateIso), day),
                  );
                return (
                  <div
                    key={day.toISOString()}
                    className="border-border relative border-r"
                  >
                    {/* Sticky Day header */}
                    <div className="border-border bg-card sticky top-0 z-10 flex h-16 flex-col items-center justify-center border-b">
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

                    {/* Time slots */}
                    <div className="relative">
                      {timeSlots.map((slot) => (
                        <div
                          key={slot.index}
                          className={cn(
                            "border-border relative h-16 cursor-pointer border-b transition-colors",
                            "hover:bg-accent/20",
                            dragOverSlot?.day.getTime() === day.getTime() &&
                              dragOverSlot?.hour === slot.hour &&
                              "bg-primary/20 border-primary/50",
                          )}
                          onClick={() => openCreateAtSlot(day, slot.hour, 0)}
                          onDragOver={(e) => onDragOver(e, day, slot.hour, 0)}
                          onDrop={(e) => onDrop(e, day, slot.hour, 0)}
                        />
                      ))}

                      {/* Scheduled Items */}
                      {itemsForDay.map((item) => {
                        const pos = getTaskPosition(item.scheduledForDate);
                        const a = articleById.get(item.articleId);
                        const title = a?.title ?? item.title;
                        const isOverdue = overdueQueueItemIds.has(item.id);
                        const layout = queueLayouts.get(item.id);
                        return (
                          <div
                            key={item.id}
                            className={cn(
                              "task-card-interactive absolute cursor-pointer rounded-md border p-2 text-white select-none",
                              isOverdue ? "bg-destructive/80" : "bg-chart-4",
                              "border-white/30",
                              isUpdating && "pointer-events-none opacity-75",
                            )}
                            style={{
                              ...pos,
                              left: layout ? layout.left : "2px",
                              width: layout ? layout.width : "calc(90% - 4px)",
                              zIndex: layout ? layout.zIndex : 1,
                            }}
                            draggable={!isUpdating && !isOverdue}
                            onDragStart={(e) => onDragStart(e, item.articleId)}
                            onDragEnd={onDragEnd}
                            onDragOver={(e) => {
                              e.preventDefault();
                              const h = new Date(
                                item.scheduledForDate,
                              ).getHours();
                              if (
                                !dragOverSlot ||
                                dragOverSlot.day.getTime() !== day.getTime() ||
                                dragOverSlot.hour !== h ||
                                dragOverSlot.minute !== 0
                              ) {
                                setDragOverSlot({ day, hour: h, minute: 0 });
                              }
                            }}
                            onDrop={(e) =>
                              onDrop(
                                e,
                                day,
                                new Date(item.scheduledForDate).getHours(),
                                0,
                              )
                            }
                          >
                            <Popover>
                              <PopoverTrigger asChild>
                                <div className="relative h-full">
                                  <div className="min-w-0">
                                    <div className="text-xs leading-tight font-medium break-words whitespace-normal">
                                      {title}
                                    </div>
                                    <div className="mt-1 text-[10px] opacity-90">
                                      {format(
                                        new Date(item.scheduledForDate),
                                        "h:mma",
                                      )}{" "}
                                      {isOverdue && (
                                        <span className="ml-1 font-semibold">
                                          • Overdue
                                        </span>
                                      )}
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
                                <div className="flex items-start justify-between">
                                  <div className="min-w-0 pr-3">
                                    {(() => {
                                      const href = a?.slug
                                        ? `/articles/${a.slug}`
                                        : `/dashboard/articles/${a?.id ?? item.articleId}`;
                                      return (
                                        <a
                                          href={href}
                                          className="text-base font-semibold leading-tight break-words underline-offset-2 hover:underline"
                                        >
                                          {title}
                                        </a>
                                      );
                                    })()}
                                    <div className="text-muted-foreground mt-1 text-sm">
                                      {format(
                                        new Date(item.scheduledForDate),
                                        "EEEE, MMMM d • h:mma",
                                      )}
                                      {isOverdue && (
                                        <span className="text-destructive ml-2 font-medium">
                                          Overdue
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <button
                                          className="hover:bg-accent/40 text-foreground flex size-8 items-center justify-center rounded-full transition-colors"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            openEditModal(item);
                                          }}
                                          aria-label="Edit"
                                        >
                                          <Edit3 className="h-4 w-4" />
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
                                          aria-label="Generate now"
                                        >
                                          <Play className="h-4 w-4" />
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
                                            void handleDeleteArticle(item);
                                          }}
                                          aria-label="Delete article"
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </button>
                                      </TooltipTrigger>
                                      <TooltipContent side="top">
                                        Delete article
                                      </TooltipContent>
                                    </Tooltip>
                                  </div>
                                </div>
                                {/* Extra details */}
                                {a && (
                                  <div className="mt-3 space-y-2 text-sm">
                                    {a.keywords && a.keywords.length > 0 && (
                                      <div className="text-muted-foreground truncate">
                                        Keywords:{" "}
                                        {a.keywords.slice(0, 6).join(", ")}
                                      </div>
                                    )}
                                    {a.notes && (
                                      <div className="text-muted-foreground line-clamp-3">
                                        {a.notes}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </PopoverContent>
                            </Popover>
                          </div>
                        );
                      })}

                      {/* Generating Items (in-place) */}
                      {generatingCalendarEvents
                        .filter((ev) => isSameDay(new Date(ev.dateIso), day))
                        .map((ev) => {
                          const pos = getTaskPosition(ev.dateIso);
                          const a = ev.article;
                          const progress = Math.max(0, Math.min(100, a.generationProgress ?? 0));
                          const hour = new Date(ev.dateIso).getHours();
                          return (
                            <div
                              key={`gen-${ev.id}`}
                              className={cn(
                                "task-card-interactive absolute cursor-pointer rounded-md border p-2 select-none",
                                "bg-card text-foreground border-white/30",
                                isUpdating && "pointer-events-none opacity-75",
                              )}
                              style={{ left: "2px", width: "calc(90% - 4px)", zIndex: 2, ...pos }}
                              onDragOver={(e) => {
                                e.preventDefault();
                                if (
                                  !dragOverSlot ||
                                  dragOverSlot.day.getTime() !== day.getTime() ||
                                  dragOverSlot.hour !== hour ||
                                  dragOverSlot.minute !== 0
                                ) {
                                  setDragOverSlot({ day, hour, minute: 0 });
                                }
                              }}
                              onDrop={(e) => onDrop(e, day, hour, 0)}
                            >
                              <Popover>
                                <PopoverTrigger asChild>
                                  <div className="relative h-full">
                                    <div className="min-w-0">
                                      <div className="text-xs font-medium leading-tight whitespace-normal break-words">
                                        {ev.title}
                                      </div>
                                      <div className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                                        <span className="inline-flex items-center gap-1 rounded bg-secondary px-1.5 py-0.5 text-[10px] font-medium">
                                          <Zap className="h-3 w-3" />
                                          {a.generationPhase
                                            ? a.generationPhase.charAt(0).toUpperCase() + a.generationPhase.slice(1)
                                            : "Processing"}
                                        </span>
                                      </div>
                                      <div className="mt-1">
                                        <div className="h-[6px] rounded bg-muted">
                                          <div
                                            className="h-[6px] rounded bg-chart-3"
                                            style={{ width: `${progress}%` }}
                                          />
                                        </div>
                                        <div className="mt-1 text-[10px] text-muted-foreground">
                                          {progress}% complete
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </PopoverTrigger>
                                <PopoverContent className="w-[360px] rounded-xl p-3" align="start" sideOffset={8} onOpenAutoFocus={(e) => e.preventDefault()}>
                                  <div className="min-w-0 pr-3">
                                    <div className="text-base font-semibold leading-tight break-words">{ev.title}</div>
                                    <div className="text-muted-foreground mt-1 flex items-center gap-2 text-sm">
                                      <span className="inline-flex items-center gap-1 rounded bg-secondary px-1.5 py-0.5 text-xs font-medium">
                                        <Zap className="h-3 w-3" />
                                        {a.generationPhase
                                          ? a.generationPhase.charAt(0).toUpperCase() + a.generationPhase.slice(1)
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
                        })}

                      {/* Publish Scheduled Items */}
                      {publishScheduledForDay.map((ev) => {
                        const pos = getTaskPosition(ev.dateIso);
                        const href = ev.article.slug
                          ? `/articles/${ev.article.slug}`
                          : `/dashboard/articles/${ev.id}`;
                        return (
                          <div
                            key={`pubsch-${ev.id}`}
                            className={cn(
                              "task-card-interactive absolute cursor-pointer rounded-md border p-2 text-white select-none",
                              "bg-chart-3 border-white/30",
                              isUpdating && "pointer-events-none opacity-75",
                            )}
                            style={{
                              left: "2px",
                              width: "80%",
                              zIndex: 1,
                              ...pos,
                            }}
                            onDragOver={(e) => {
                              e.preventDefault();
                              const h = new Date(ev.dateIso).getHours();
                              if (
                                !dragOverSlot ||
                                dragOverSlot.day.getTime() !== day.getTime() ||
                                dragOverSlot.hour !== h ||
                                dragOverSlot.minute !== 0
                              ) {
                                setDragOverSlot({ day, hour: h, minute: 0 });
                              }
                            }}
                            onDrop={(e) =>
                              onDrop(e, day, new Date(ev.dateIso).getHours(), 0)
                            }
                          >
                            <Popover>
                              <PopoverTrigger asChild>
                                <div className="relative h-full">
                                  <div className="min-w-0">
                                    <div className="text-xs leading-tight font-medium break-words whitespace-normal">
                                      {ev.title}
                                    </div>
                                    <div className="text-[10px] opacity-90">Publish scheduled</div>
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
                                  <a href={href} className="text-base font-semibold leading-tight break-words underline-offset-2 hover:underline">
                                    {ev.title}
                                  </a>
                                  <div className="text-muted-foreground mt-1 text-sm">
                                    {format(new Date(ev.dateIso), "EEEE, MMMM d • h:mma")} — publish scheduled
                                  </div>
                                </div>
                              </PopoverContent>
                            </Popover>
                          </div>
                        );
                      })}

                      {/* Published Items */}
                      {publishedForDay.map((ev) => {
                        const pos = getTaskPosition(ev.dateIso);
                        const href = ev.article.slug
                          ? `/articles/${ev.article.slug}`
                          : `/dashboard/articles/${ev.id}`;
                        return (
                          <div
                            key={`published-${ev.id}`}
                            className={cn(
                              "task-card-interactive absolute cursor-pointer rounded-md border p-2 text-white select-none",
                              "bg-chart-1 border-white/30",
                              isUpdating && "pointer-events-none opacity-75",
                            )}
                            style={{
                              left: "2px",
                              width: "80%",
                              zIndex: 1,
                              ...pos,
                            }}
                            onDragOver={(e) => {
                              e.preventDefault();
                              const h = new Date(ev.dateIso).getHours();
                              if (
                                !dragOverSlot ||
                                dragOverSlot.day.getTime() !== day.getTime() ||
                                dragOverSlot.hour !== h ||
                                dragOverSlot.minute !== 0
                              ) {
                                setDragOverSlot({ day, hour: h, minute: 0 });
                              }
                            }}
                            onDrop={(e) =>
                              onDrop(e, day, new Date(ev.dateIso).getHours(), 0)
                            }
                          >
                            <Popover>
                              <PopoverTrigger asChild>
                                <div className="relative h-full">
                                  <div className="min-w-0">
                                    <div className="text-xs leading-tight font-medium break-words whitespace-normal">
                                      {ev.title}
                                    </div>
                                    <div className="text-[10px] opacity-90">Published</div>
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
                                  <a href={href} className="text-base font-semibold leading-tight break-words underline-offset-2 hover:underline">
                                    {ev.title}
                                  </a>
                                  <div className="text-muted-foreground mt-1 text-sm">
                                    {format(new Date(ev.dateIso), "EEEE, MMMM d • h:mma")} — published
                                  </div>
                                </div>
                              </PopoverContent>
                            </Popover>
                          </div>
                        );
                      })}

                      {/* Generation Scheduled Items (legacy) */}
                      {generationScheduledForDay.map((ev) => {
                        const pos = getTaskPosition(ev.dateIso);
                        return (
                          <div
                            key={`gensch-${ev.id}`}
                            className={cn(
                              "task-card-interactive absolute cursor-pointer rounded-md border p-2 text-white select-none",
                              "bg-chart-4 border-white/30",
                              isUpdating && "pointer-events-none opacity-75",
                            )}
                            style={{
                              left: "2px",
                              width: "80%",
                              zIndex: 1,
                              ...pos,
                            }}
                            onDragOver={(e) => {
                              e.preventDefault();
                              const h = new Date(ev.dateIso).getHours();
                              if (
                                !dragOverSlot ||
                                dragOverSlot.day.getTime() !== day.getTime() ||
                                dragOverSlot.hour !== h ||
                                dragOverSlot.minute !== 0
                              ) {
                                setDragOverSlot({ day, hour: h, minute: 0 });
                              }
                            }}
                            onDrop={(e) =>
                              onDrop(e, day, new Date(ev.dateIso).getHours(), 0)
                            }
                          >
                            <div className="min-w-0">
                              <div className="text-xs leading-tight font-medium break-words whitespace-normal">
                                {ev.title}
                              </div>
                              <div className="text-[10px] opacity-90">
                                Generation scheduled
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              </div>
            </div>
          ) : (
            // Board view: 7 columns with stacked, time-sorted cards
            <div className="h-full overflow-auto overscroll-contain p-3">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-7 md:gap-3">
                {weekDays.map((day) => {
                  // Build a combined list of events for the day
                  const queuedForDay = scheduledItems.filter((s) =>
                    isSameDay(new Date(s.scheduledForDate), day),
                  );
                  const generatingForDay = generatingCalendarEvents.filter((e) =>
                    isSameDay(new Date(e.dateIso), day),
                  );
                  const publishScheduledForDay = publishScheduledEvents.filter((e) =>
                    isSameDay(new Date(e.dateIso), day),
                  );
                  const publishedForDay = publishedEvents.filter((e) =>
                    isSameDay(new Date(e.dateIso), day),
                  );
                  const generationScheduledForDay = generationScheduledEvents.filter((e) =>
                    isSameDay(new Date(e.dateIso), day),
                  );

                  type BoardEvent =
                    | { kind: "queued"; key: string; dateIso: string; item: QueueItem; title: string; overdue: boolean }
                    | { kind: "generating"; key: string; dateIso: string; article: Article; title: string }
                    | { kind: "publishScheduled"; key: string; dateIso: string; article: Article; title: string }
                    | { kind: "published"; key: string; dateIso: string; article: Article; title: string }
                    | { kind: "generationScheduled"; key: string; dateIso: string; article: Article; title: string };

                  const events: BoardEvent[] = [
                    ...queuedForDay.map((q) => ({
                      kind: "queued" as const,
                      key: `q-${q.id}`,
                      dateIso: q.scheduledForDate,
                      item: q,
                      title: articleById.get(q.articleId)?.title ?? q.title,
                      overdue: overdueQueueItemIds.has(q.id),
                    })),
                    ...generatingForDay.map((e) => ({
                      kind: "generating" as const,
                      key: `gen-${e.id}`,
                      dateIso: e.dateIso,
                      article: e.article,
                      title: e.title,
                    })),
                    ...publishScheduledForDay.map((e) => ({
                      kind: "publishScheduled" as const,
                      key: `pubsch-${e.id}`,
                      dateIso: e.dateIso,
                      article: e.article,
                      title: e.title,
                    })),
                    ...publishedForDay.map((e) => ({
                      kind: "published" as const,
                      key: `pub-${e.id}`,
                      dateIso: e.dateIso,
                      article: e.article,
                      title: e.title,
                    })),
                    ...generationScheduledForDay.map((e) => ({
                      kind: "generationScheduled" as const,
                      key: `gensch-${e.id}`,
                      dateIso: e.dateIso,
                      article: e.article,
                      title: e.title,
                    })),
                  ].sort((a, b) => new Date(a.dateIso).getTime() - new Date(b.dateIso).getTime());

                  return (
                    <div key={day.toISOString()} className="flex min-h-0 flex-col overflow-hidden rounded-md border">
                      {/* Day header */}
                      <div className="border-border bg-card flex items-center justify-between gap-2 border-b p-2 rounded-t-md">
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
                          <Button size="icon" variant="ghost" onClick={() => openCreateForDay(day)} aria-label="Add idea">
                            <Plus className="h-4 w-4" />
                          </Button>
                        )}
                      </div>

                      {/* Events list */}
                      <div
                        className={cn(
                          "flex-1 space-y-2 p-2",
                          isUpdating && "pointer-events-none opacity-75",
                        )}
                        onDragOver={(e) => {
                          e.preventDefault();
                          if (!dragOverSlot || dragOverSlot.day.getTime() !== day.getTime()) {
                            setDragOverSlot({ day, hour: -1, minute: 0 });
                          }
                        }}
                        onDrop={(e) => onDropToDay(e, day)}
                      >
                        {events.length === 0 ? (
                          <div className="text-muted-foreground text-xs">No items</div>
                        ) : null}

                        {events.map((ev) => {
                          const time = format(new Date(ev.dateIso), "HH:mm");
                          if (ev.kind === "queued") {
                            const item = ev.item;
                            return (
                              <div
                                key={ev.key}
                                className={cn(
                                  "task-card-interactive cursor-pointer rounded-md border p-2 text-white select-none",
                                  ev.overdue ? "bg-destructive/80" : "bg-chart-4",
                                  "border-white/30",
                                )}
                                draggable={!isUpdating && !ev.overdue}
                                onDragStart={(e) => onDragStart(e, item.articleId)}
                                onDragEnd={onDragEnd}
                              >
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <div className="min-w-0">
                                      <div className="text-xs leading-tight font-medium break-words whitespace-normal">
                                        {time} — {ev.title}
                                      </div>
                                      <div className="text-[10px] opacity-90">Idea</div>
                                    </div>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-[360px] rounded-xl p-3" align="start" sideOffset={8} onOpenAutoFocus={(e) => e.preventDefault()}>
                                    <div className="flex items-start justify-between">
                                      <div className="min-w-0 pr-3">
                                        {(() => {
                                          const a = articleById.get(item.articleId);
                                          const href = a?.slug ? `/articles/${a.slug}` : `/dashboard/articles/${a?.id ?? item.articleId}`;
                                          return (
                                            <a href={href} className="text-base font-semibold leading-tight break-words underline-offset-2 hover:underline">{ev.title}</a>
                                          );
                                        })()}
                                        <div className="text-muted-foreground mt-1 text-sm">
                                          {format(new Date(item.scheduledForDate), "EEEE, MMMM d • h:mma")} {ev.overdue && <span className="text-destructive ml-2 font-medium">Overdue</span>}
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <button
                                              className="hover:bg-accent/40 text-foreground flex size-8 items-center justify-center rounded-full transition-colors"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                openEditModal(item);
                                              }}
                                              aria-label="Edit"
                                            >
                                              <Edit3 className="h-4 w-4" />
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
                                                void handleGenerateNow(item);
                                              }}
                                              aria-label="Generate now"
                                            >
                                              <Play className="h-4 w-4" />
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
                                                void handleDeleteArticle(item);
                                              }}
                                              aria-label="Delete article"
                                            >
                                              <Trash2 className="h-4 w-4" />
                                            </button>
                                          </TooltipTrigger>
                                          <TooltipContent side="top">Delete article</TooltipContent>
                                        </Tooltip>
                                      </div>
                                    </div>
                                  </PopoverContent>
                                </Popover>
                              </div>
                            );
                          }
                          if (ev.kind === "generating") {
                            const a = ev.article;
                            const progress = Math.max(0, Math.min(100, a.generationProgress ?? 0));
                            return (
                              <div key={ev.key} className={cn("task-card-interactive cursor-pointer rounded-md border p-2 select-none", "bg-card text-foreground border-white/30")}
                              >
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <div className="min-w-0">
                                      <div className="text-xs font-medium leading-tight whitespace-normal break-words">{time} — {ev.title}</div>
                                      <div className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                                        <span className="inline-flex items-center gap-1 rounded bg-secondary px-1.5 py-0.5 text-[10px] font-medium">
                                          <Zap className="h-3 w-3" />
                                          {a.generationPhase ? a.generationPhase.charAt(0).toUpperCase() + a.generationPhase.slice(1) : "Processing"}
                                        </span>
                                      </div>
                                      <div className="mt-1">
                                        <div className="h-[6px] rounded bg-muted">
                                          <div className="h-[6px] rounded bg-chart-3" style={{ width: `${progress}%` }} />
                                        </div>
                                        <div className="mt-1 text-[10px] text-muted-foreground">{progress}% complete</div>
                                      </div>
                                    </div>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-[360px] rounded-xl p-3" align="start" sideOffset={8} onOpenAutoFocus={(e) => e.preventDefault()}>
                                    <div className="min-w-0 pr-3">
                                      <div className="text-base font-semibold leading-tight break-words">{ev.title}</div>
                                      <div className="text-muted-foreground mt-1 flex items-center gap-2 text-sm">
                                        <span className="inline-flex items-center gap-1 rounded bg-secondary px-1.5 py-0.5 text-xs font-medium">
                                          <Zap className="h-3 w-3" />
                                          {a.generationPhase ? a.generationPhase.charAt(0).toUpperCase() + a.generationPhase.slice(1) : "Processing"}
                                        </span>
                                        <span>Creating content</span>
                                      </div>
                                      <div className="mt-2">
                                        <Progress value={progress} />
                                        <div className="text-muted-foreground mt-1 text-xs">{progress}% complete</div>
                                      </div>
                                    </div>
                                  </PopoverContent>
                                </Popover>
                              </div>
                            );
                          }
                          if (ev.kind === "publishScheduled") {
                            const href = ev.article.slug ? `/articles/${ev.article.slug}` : `/dashboard/articles/${ev.article.id}`;
                            return (
                              <Popover key={ev.key}>
                                <PopoverTrigger asChild>
                                  <div className={cn("task-card-interactive cursor-pointer rounded-md border p-2 text-white select-none", "bg-chart-3 border-white/30")}
                                  >
                                    <div className="min-w-0">
                                      <div className="text-xs leading-tight font-medium break-words whitespace-normal">{time} — {ev.title}</div>
                                      <div className="text-[10px] opacity-90">Publish scheduled</div>
                                    </div>
                                  </div>
                                </PopoverTrigger>
                                <PopoverContent className="w-[360px] rounded-xl p-3" align="start" sideOffset={8} onOpenAutoFocus={(e) => e.preventDefault()}>
                                  <div className="min-w-0 pr-3">
                                    <a href={href} className="text-base font-semibold leading-tight break-words underline-offset-2 hover:underline">{ev.title}</a>
                                    <div className="text-muted-foreground mt-1 text-sm">{format(new Date(ev.dateIso), "EEEE, MMMM d • h:mma")} — publish scheduled</div>
                                  </div>
                                </PopoverContent>
                              </Popover>
                            );
                          }
                          if (ev.kind === "published") {
                            const href = ev.article.slug ? `/articles/${ev.article.slug}` : `/dashboard/articles/${ev.article.id}`;
                            return (
                              <Popover key={ev.key}>
                                <PopoverTrigger asChild>
                                  <div className={cn("task-card-interactive cursor-pointer rounded-md border p-2 text-white select-none", "bg-chart-1 border-white/30")}
                                  >
                                    <div className="min-w-0">
                                      <div className="text-xs leading-tight font-medium break-words whitespace-normal">{time} — {ev.title}</div>
                                      <div className="text-[10px] opacity-90">Published</div>
                                    </div>
                                  </div>
                                </PopoverTrigger>
                                <PopoverContent className="w-[360px] rounded-xl p-3" align="start" sideOffset={8} onOpenAutoFocus={(e) => e.preventDefault()}>
                                  <div className="min-w-0 pr-3">
                                    <a href={href} className="text-base font-semibold leading-tight break-words underline-offset-2 hover:underline">{ev.title}</a>
                                    <div className="text-muted-foreground mt-1 text-sm">{format(new Date(ev.dateIso), "EEEE, MMMM d • h:mma")} — published</div>
                                  </div>
                                </PopoverContent>
                              </Popover>
                            );
                          }
                          // generationScheduled (legacy)
                          return (
                            <div key={ev.key} className={cn("task-card-interactive cursor-pointer rounded-md border p-2 text-white select-none", "bg-chart-4 border-white/30")}>
                              <div className="min-w-0">
                                <div className="text-xs leading-tight font-medium break-words whitespace-normal">{time} — {ev.title}</div>
                                <div className="text-[10px] opacity-90">Generation scheduled</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
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
                  value={creatingAt ? new Date(new Date(creatingAt.date).setHours(creatingAt.hour, creatingAt.minute, 0, 0)) : undefined}
                  onChange={(d) => {
                    if (!d) return;
                    setCreatingAt({ date: d, hour: d.getHours(), minute: d.getMinutes() });
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
