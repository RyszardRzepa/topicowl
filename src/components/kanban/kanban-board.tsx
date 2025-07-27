"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Plus,
  Calendar,
  Edit3,
  Check,
  X,
  Trash2,
  Play,
  CalendarClock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ArticleStatus } from "@/types";
import type { ScheduleGenerationResponse } from "@/app/api/articles/schedule-generation/route";

// Inline kanban flow logic
const STATUS_FLOW: Record<ArticleStatus, ArticleStatus[]> = {
  idea: ["to_generate", "scheduled"],
  scheduled: ["queued", "idea"],
  queued: ["generating", "scheduled", "idea"],
  to_generate: ["generating"], // Only through generate button, not drag
  generating: ["wait_for_publish"], // Automatically moved by system after generation
  wait_for_publish: ["published"],
  published: [], // Cannot be moved
};

const isValidStatusTransition = (
  from: ArticleStatus,
  to: ArticleStatus,
): boolean => {
  return STATUS_FLOW[from].includes(to);
};

const isDraggable = (status: ArticleStatus): boolean => {
  // Only allow dragging for idea and wait_for_publish status
  return status === "idea" || status === "wait_for_publish";
};

// Example: Import API types from their colocated routes when needed
// import type { CreateArticleRequest } from '@/app/api/articles/route';
// import type { MoveArticleRequest } from '@/app/api/articles/move/route';
import type {
  KanbanColumn,
  DatabaseArticle,
} from "@/app/api/articles/board/route";

type Article = DatabaseArticle;

interface KanbanBoardProps {
  className?: string;
}

export function KanbanBoard({ className: _className }: KanbanBoardProps) {
  const router = useRouter();
  const [columns, setColumns] = useState<KanbanColumn[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchKanbanBoard = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/articles/board");
      if (!response.ok) {
        throw new Error("Failed to fetch kanban board");
      }
      const data = (await response.json()) as KanbanColumn[];
      setColumns(data);
      setError(null);
    } catch (error) {
      console.error("Failed to load kanban board:", error);
      setError("Failed to load kanban board");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchKanbanBoard();
  }, []);

  // Refresh kanban board when returning from article preview
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // Page became visible again, check for status changes and refresh
        const statusChange = sessionStorage.getItem("articleStatusChanged");
        if (statusChange) {
          sessionStorage.removeItem("articleStatusChanged");
          void fetchKanbanBoard();
        }
      }
    };

    const handleFocus = () => {
      // Window gained focus, check for status changes and refresh
      const statusChange = sessionStorage.getItem("articleStatusChanged");
      if (statusChange) {
        sessionStorage.removeItem("articleStatusChanged");
        void fetchKanbanBoard();
      }
    };

    const handleStorageChange = (e: StorageEvent) => {
      // Listen for storage changes from other tabs/windows
      if (e.key === "articleStatusChanged" && e.newValue) {
        void fetchKanbanBoard();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("storage", handleStorageChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  const updateArticle = async (
    articleId: number,
    updates: Partial<Article>,
  ) => {
    try {
      // Optimistic update - update UI immediately
      const updatedColumns = columns.map((column) => ({
        ...column,
        articles: column.articles.map((article) =>
          article.id === articleId ? { ...article, ...updates } : article,
        ),
      }));

      setColumns(updatedColumns);

      const response = await fetch(`/api/articles/${articleId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error("Failed to update article");
      }

      // No refresh needed - optimistic update is sufficient
    } catch (error) {
      console.error("Failed to update article:", error);
      setError("Failed to update article");
      // Revert optimistic update on error by fetching fresh data
      await fetchKanbanBoard();
    }
  };

  const deleteArticle = async (articleId: number) => {
    try {
      // Optimistic update - remove article from UI immediately
      const updatedColumns = columns.map((column) => ({
        ...column,
        articles: column.articles.filter((article) => article.id !== articleId),
      }));

      setColumns(updatedColumns);

      const response = await fetch(`/api/articles/${articleId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete article");
      }

      // No refresh needed - optimistic update is sufficient
    } catch (error) {
      console.error("Failed to delete article:", error);
      setError("Failed to delete article");
      // Revert optimistic update on error by fetching fresh data
      await fetchKanbanBoard();
    }
  };

  const generateArticle = async (articleId: number) => {
    console.log("generateArticle called with ID:", articleId);
    try {
      // Optimistic update - move article to generating status immediately
      const updatedColumns = columns.map((column) => {
        const filteredArticles = column.articles.filter(
          (article) => article.id !== articleId,
        );

        if (column.status === "generating") {
          // Add article to generating column
          const articleToMove = columns
            .flatMap((col) => col.articles)
            .find((article) => article.id === articleId);

          if (articleToMove) {
            const updatedArticle = {
              ...articleToMove,
              status: "generating" as const,
              kanbanPosition: column.articles.length, // Add to end of generating column
            };

            filteredArticles.push(updatedArticle);
          }
        }

        return {
          ...column,
          articles: filteredArticles,
        };
      });

      setColumns(updatedColumns);

      const response = await fetch(`/api/articles/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          articleId: articleId.toString(),
        }),
      });

      console.log("Generate API response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Generate API error response:", errorText);
        throw new Error("Failed to start article generation");
      }

      const responseData = (await response.json()) as unknown;
      console.log("Generate API response data:", responseData);

      // No refresh needed - optimistic update is sufficient
      // The server will handle the actual generation process
    } catch (error) {
      console.error("Failed to generate article:", error);
      setError("Failed to generate article");
      // Revert optimistic update on error by fetching fresh data
      await fetchKanbanBoard();
    }
  };

  const scheduleGeneration = async (articleId: number, scheduledAt: string) => {
    try {
      const response = await fetch("/api/articles/schedule-generation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          articleId,
          scheduledAt: scheduledAt,
        }),
      });

      const result = (await response.json()) as ScheduleGenerationResponse;

      if (!response.ok || !result.success) {
        throw new Error(result.error);
      }

      // Refresh the board to get updated data
      await fetchKanbanBoard();
    } catch (error) {
      console.error("Failed to schedule generation:", error);
      setError("Failed to schedule generation");
    }
  };

  // New scheduling function for automatic recurring schedules
  const scheduleArticle = async (
    articleId: number,
    scheduledAt: string,
    frequency: "once" | "daily" | "weekly" | "monthly" = "once",
  ) => {
    try {
      const response = await fetch("/api/articles/schedule", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          articleId,
          scheduledAt,
          schedulingType: frequency === "once" ? "manual" : "automatic",
          frequency,
        }),
      });

      if (!response.ok) {
        const errorData = (await response.json()) as { error?: string };
        throw new Error(errorData.error ?? "Failed to schedule article");
      }

      // Refresh the board to get updated data
      await fetchKanbanBoard();
    } catch (error) {
      console.error("Failed to schedule article:", error);
      setError(
        error instanceof Error ? error.message : "Failed to schedule article",
      );
    }
  };

  // Add article to generation queue manually
  const addToQueue = async (articleId: number) => {
    try {
      const response = await fetch("/api/articles/generation-queue", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          articleId,
          scheduledForDate: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        const errorData = (await response.json()) as { error?: string };
        throw new Error(errorData.error ?? "Failed to add to queue");
      }

      // Refresh the board to get updated data
      await fetchKanbanBoard();
    } catch (error) {
      console.error("Failed to add to queue:", error);
      setError(
        error instanceof Error ? error.message : "Failed to add to queue",
      );
    }
  };

  // Remove article from generation queue
  const removeFromQueue = async (articleId: number) => {
    try {
      // First get the queue to find the queue item ID
      const queueResponse = await fetch("/api/articles/generation-queue");
      if (!queueResponse.ok) {
        throw new Error("Failed to fetch queue");
      }

      const queueData = (await queueResponse.json()) as {
        data: { articles: Array<{ id: number; articleId: number }> };
      };
      const queueItem = queueData.data.articles.find(
        (item: { id: number; articleId: number }) =>
          item.articleId === articleId,
      );

      if (!queueItem) {
        throw new Error("Article not found in queue");
      }

      const response = await fetch(
        `/api/articles/generation-queue?queueItemId=${queueItem.id}`,
        {
          method: "DELETE",
        },
      );

      if (!response.ok) {
        const errorData = (await response.json()) as { error?: string };
        throw new Error(errorData.error ?? "Failed to remove from queue");
      }

      // Refresh the board to get updated data
      await fetchKanbanBoard();
    } catch (error) {
      console.error("Failed to remove from queue:", error);
      setError(
        error instanceof Error ? error.message : "Failed to remove from queue",
      );
    }
  };

  const moveArticle = async (
    articleId: number,
    newStatus: string,
    newPosition: number,
  ) => {
    try {
      // Optimistic update - update UI immediately
      const updatedColumns = columns.map((column) => {
        // Remove article from source column
        const filteredArticles = column.articles.filter(
          (article) => article.id !== articleId,
        );

        if (column.status === newStatus) {
          // Add article to destination column
          const articleToMove = columns
            .flatMap((col) => col.articles)
            .find((article) => article.id === articleId);

          if (articleToMove) {
            const updatedArticle = {
              ...articleToMove,
              status: newStatus,
              kanbanPosition: newPosition,
            };

            // Insert at correct position
            filteredArticles.splice(newPosition, 0, updatedArticle);
          }
        }

        return {
          ...column,
          articles: filteredArticles,
        };
      });

      setColumns(updatedColumns);

      const response = await fetch("/api/articles/move", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ articleId, newStatus, newPosition }),
      });

      if (!response.ok) {
        const errorData = (await response
          .json()
          .catch(() => ({ error: "Failed to move article" }))) as {
          error?: string;
        };
        throw new Error(errorData.error ?? "Failed to move article");
      }

      // No refresh needed - optimistic update is sufficient
      // The server handles the position updates and the UI is already updated
    } catch (error) {
      console.error("Failed to move article:", error);
      setError("Failed to move article");
      // Revert optimistic update on error by fetching fresh data
      await fetchKanbanBoard();
    }
  };

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination || !columns) return;

    const { source, destination, draggableId } = result;

    // If dropped in the same position, do nothing
    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    ) {
      return;
    }

    // Get source article to validate transition
    const sourceColumn = columns.find(
      (col) => col.status === source.droppableId,
    );
    const article = sourceColumn?.articles[source.index];

    if (!article) return;

    const newStatus = destination.droppableId as ArticleStatus;

    // Validate status transition
    if (!isValidStatusTransition(article.status as ArticleStatus, newStatus)) {
      setError(
        "Invalid move. Articles can only move forward in the workflow: Ideas → To Generate → Wait for Publish → Published",
      );
      return;
    }

    const articleId = parseInt(draggableId);

    void moveArticle(articleId, newStatus, destination.index);
  };

  const createNewArticle = async () => {
    try {
      const response = await fetch("/api/articles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: "New Article Idea",
          description: "Click to edit this article idea",
          keywords: ["article", "content"], // Provide default keywords
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create article");
      }

      const newArticle = (await response.json()) as Article;

      // Optimistic update - add the new article to the ideas column
      const updatedColumns = columns.map((column) => {
        if (column.status === "idea") {
          return {
            ...column,
            articles: [...column.articles, newArticle],
          };
        }
        return column;
      });

      setColumns(updatedColumns);
    } catch (error) {
      console.error("Failed to create article:", error);
      setError("Failed to create article");
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-gray-900"></div>
          <p className="mt-2 text-gray-600">Loading kanban board...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="text-center">
          <p className="mb-4 text-red-600">{error}</p>
          <Button onClick={fetchKanbanBoard}>Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Article Pipeline</h2>
          <p className="mt-1 text-sm text-gray-600">
            Drag articles forward through the workflow: Ideas → To Generate →
            Generating → Wait for Publish → Published
          </p>
        </div>
        <Button onClick={createNewArticle}>
          <Plus className="mr-2 h-4 w-4" />
          New Article Idea
        </Button>
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="grid min-h-0 grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7">
          {columns.map((column) => (
            <div key={column.id} className="flex min-w-0 flex-col">
              <div className="mb-4">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="truncate text-lg font-semibold">
                    {column.title}
                  </h3>
                  <Badge variant="secondary" className="flex-shrink-0">
                    {column.articles.length}
                  </Badge>
                </div>
                <div
                  className="h-1 rounded-full"
                  style={{ backgroundColor: column.color }}
                />
              </div>

              <Droppable droppableId={column.status}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`min-h-[200px] flex-1 overflow-hidden rounded-lg p-2 transition-colors ${
                      snapshot.isDraggingOver ? "bg-gray-100" : "bg-gray-50"
                    }`}
                  >
                    {column.articles.map((article, index) => (
                      <Draggable
                        key={article.id}
                        draggableId={article.id.toString()}
                        index={index}
                        isDragDisabled={
                          !isDraggable(article.status as ArticleStatus)
                        }
                      >
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className={cn("mb-3 min-w-0", {
                              "rotate-2": snapshot.isDragging,
                              "opacity-50": snapshot.isDragging,
                            })}
                          >
                            <ArticleCard
                              article={article}
                              onUpdate={updateArticle}
                              onDelete={deleteArticle}
                              onGenerate={generateArticle}
                              onScheduleGeneration={scheduleGeneration}
                              onScheduleArticle={scheduleArticle}
                              onAddToQueue={addToQueue}
                              onRemoveFromQueue={removeFromQueue}
                              onNavigate={(articleId) =>
                                router.push(`/articles/${articleId}`)
                              }
                            />
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          ))}
        </div>
      </DragDropContext>
    </div>
  );
}

function ArticleCard({
  article,
  onUpdate,
  onDelete,
  onGenerate,
  onScheduleGeneration,
  onScheduleArticle,
  onAddToQueue,
  onRemoveFromQueue,
  onNavigate,
}: {
  article: Article;
  onUpdate: (articleId: number, updates: Partial<Article>) => Promise<void>;
  onDelete: (articleId: number) => Promise<void>;
  onGenerate: (articleId: number) => Promise<void>;
  onScheduleGeneration: (
    articleId: number,
    scheduledAt: string,
  ) => Promise<void>;
  onScheduleArticle: (
    articleId: number,
    scheduledAt: string,
    frequency?: "once" | "daily" | "weekly" | "monthly",
  ) => Promise<void>;
  onAddToQueue: (articleId: number) => Promise<void>;
  onRemoveFromQueue: (articleId: number) => Promise<void>;
  onNavigate: (articleId: number) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [isScheduling, setIsScheduling] = useState(false);
  const [selectedScheduleTime, setSelectedScheduleTime] = useState<string>("");
  const [schedulingFrequency, setSchedulingFrequency] = useState<
    "once" | "daily" | "weekly" | "monthly"
  >("once");
  const [editData, setEditData] = useState({
    title: article.title,
  });
  const [isUpdating, setIsUpdating] = useState(false);

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't navigate if clicking on interactive elements or during editing
    if (isEditing || isScheduling) return;

    const target = e.target as HTMLElement;
    const isButton = target.closest("button");
    const isInput = target.closest("input");
    const isLink = target.closest("a");

    // Only navigate if clicking on the card itself, not on interactive elements
    if (!isButton && !isInput && !isLink) {
      e.preventDefault();
      onNavigate(article.id);
    }
  };

  const handleSave = async () => {
    if (!editData.title.trim()) {
      return;
    }

    setIsUpdating(true);
    try {
      await onUpdate(article.id, {
        title: editData.title.trim(),
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
    });
    setIsEditing(false);
  };

  const handleDelete = async () => {
    if (window.confirm("Are you sure you want to delete this article?")) {
      try {
        await onDelete(article.id);
      } catch (error) {
        console.error("Failed to delete article:", error);
      }
    }
  };

  const handleGenerate = async () => {
    console.log("Generate button clicked for article:", article.id);
    try {
      await onGenerate(article.id);
      console.log("Generate API call completed for article:", article.id);
    } catch (error) {
      console.error("Failed to generate article:", error);
    }
  };

  const handleScheduleGeneration = async (scheduledAt: string) => {
    try {
      await onScheduleGeneration(article.id, scheduledAt);
      setIsScheduling(false);
      setSelectedScheduleTime("");
    } catch (error) {
      console.error("Failed to schedule generation:", error);
    }
  };

  const handleConfirmScheduleGeneration = async () => {
    if (selectedScheduleTime) {
      await handleScheduleGeneration(selectedScheduleTime);
    }
  };

  const handleScheduleArticle = async (scheduledAt: string) => {
    try {
      await onScheduleArticle(article.id, scheduledAt, schedulingFrequency);
      setIsScheduling(false);
      setSelectedScheduleTime("");
      setSchedulingFrequency("once");
    } catch (error) {
      console.error("Failed to schedule article:", error);
    }
  };

  const handleConfirmScheduleArticle = async () => {
    if (selectedScheduleTime) {
      await handleScheduleArticle(selectedScheduleTime);
    }
  };

  const handleAddToQueue = async () => {
    try {
      await onAddToQueue(article.id);
    } catch (error) {
      console.error("Failed to add to queue:", error);
    }
  };

  const handleRemoveFromQueue = async () => {
    try {
      await onRemoveFromQueue(article.id);
    } catch (error) {
      console.error("Failed to remove from queue:", error);
    }
  };

  // Determine card interactivity based on status
  const isInteractive =
    article.status === "idea" || article.status === "to_generate";
  const isGenerating = article.status === "generating";
  const isCompleted = article.status === "published";
  const canEdit = article.status === "idea" || article.status === "to_generate";

  return (
    <Card
      className={cn(
        "w-full cursor-grab overflow-hidden transition-all duration-200 hover:shadow-md active:cursor-grabbing",
        {
          "cursor-not-allowed opacity-75": !isInteractive,
          "border-blue-500 bg-blue-50": isGenerating,
          "border-green-500 bg-green-50": isCompleted,
          "cursor-not-allowed": !isDraggable(article.status as ArticleStatus),
          "hover:cursor-pointer hover:border-gray-300 hover:shadow-lg":
            !isEditing && !isScheduling,
        },
      )}
      onClick={handleCardClick}
      title="Click to view article details"
    >
      <CardHeader>
        {isEditing ? (
          <div className="space-y-3">
            <input
              value={editData.title}
              onChange={(e) =>
                setEditData({ ...editData, title: e.target.value })
              }
              className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              placeholder="Article title..."
              disabled={isUpdating || !canEdit}
              autoFocus
            />
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-2">
              <CardTitle
                className={cn(
                  "line-clamp-2 min-w-0 flex-1 transition-colors",
                  canEdit
                    ? "cursor-pointer hover:text-blue-600"
                    : "cursor-default",
                )}
                onClick={(e) => {
                  if (canEdit) {
                    e.stopPropagation();
                    setIsEditing(true);
                  }
                }}
              >
                {article.title}
              </CardTitle>
              <CardAction>
                {canEdit && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => setIsEditing(true)}
                    >
                      <Edit3 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={handleDelete}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </>
                )}
              </CardAction>
            </div>

            {/* Status badge as description */}
            {article.status !== "idea" && (
              <CardDescription>
                <Badge
                  variant="secondary"
                  className={cn("text-xs", {
                    "bg-yellow-100 text-yellow-800":
                      article.status === "to_generate",
                    "bg-blue-100 text-blue-800":
                      article.status === "generating",
                    "bg-purple-100 text-purple-800":
                      article.status === "wait_for_publish",
                    "bg-green-100 text-green-800":
                      article.status === "published",
                  })}
                >
                  {article.status === "to_generate" && "Ready"}
                  {article.status === "generating" && "Generating"}
                  {article.status === "wait_for_publish" && "Waiting"}
                  {article.status === "published" && "Published"}
                </Badge>
              </CardDescription>
            )}
          </>
        )}

        {/* Edit action buttons in header when editing */}
        {isEditing && (
          <CardAction className="justify-end gap-2">
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
              Save
            </Button>
          </CardAction>
        )}
      </CardHeader>

      <CardContent>
        {/* Status indicator for generating articles */}
        {isGenerating && (
          <div className="mb-3">
            <div className="h-2 w-full rounded-full bg-gray-200">
              <div
                className="h-2 animate-pulse rounded-full bg-blue-600"
                style={{ width: "60%" }}
              />
            </div>
            <p className="mt-1 text-xs font-medium text-blue-600">
              Generating content...
            </p>
          </div>
        )}

        {/* Show completion indicator for published articles */}
        {isCompleted && (
          <div className="mb-3">
            <div className="rounded bg-green-50 p-2 text-xs font-medium text-green-600">
              ✓ Published successfully
            </div>
          </div>
        )}

        {/* Scheduling UI for idea status */}
        {article.status === "idea" && !isEditing && (
          <div className="mb-3 space-y-2">
            {isScheduling ? (
              <div className="space-y-2">
                <input
                  type="datetime-local"
                  className="w-full rounded border border-gray-200 p-2 text-xs"
                  min={new Date(Date.now() + 60000).toISOString().slice(0, 16)}
                  value={
                    selectedScheduleTime
                      ? new Date(selectedScheduleTime)
                          .toISOString()
                          .slice(0, 16)
                      : ""
                  }
                  onChange={(e) => {
                    if (e.target.value) {
                      setSelectedScheduleTime(
                        new Date(e.target.value).toISOString(),
                      );
                    } else {
                      setSelectedScheduleTime("");
                    }
                  }}
                />
                <select
                  value={schedulingFrequency}
                  onChange={(e) =>
                    setSchedulingFrequency(
                      e.target.value as "once" | "daily" | "weekly" | "monthly",
                    )
                  }
                  className="w-full rounded border border-gray-200 p-2 text-xs"
                >
                  <option value="once">One-time</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
                <div className="flex gap-1">
                  <Button
                    onClick={() => {
                      setIsScheduling(false);
                      setSelectedScheduleTime("");
                      setSchedulingFrequency("once");
                    }}
                    size="sm"
                    variant="outline"
                    className="h-7 flex-1 text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleConfirmScheduleArticle}
                    size="sm"
                    disabled={!selectedScheduleTime}
                    className="h-7 flex-1 text-xs"
                  >
                    Schedule
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-1">
                <Button
                  onClick={handleAddToQueue}
                  size="sm"
                  className="h-7 bg-orange-600 px-2 text-xs text-white hover:bg-orange-700"
                >
                  <Play className="mr-1 h-3 w-3 flex-shrink-0" />
                  <span className="truncate">Queue</span>
                </Button>
                <Button
                  onClick={() => setIsScheduling(true)}
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-xs"
                >
                  <CalendarClock className="mr-1 h-3 w-3 flex-shrink-0" />
                  <span className="truncate">Schedule</span>
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Controls for scheduled articles */}
        {article.status === "scheduled" && !isEditing && (
          <div className="mb-3 space-y-2">
            <div className="grid grid-cols-2 gap-1">
              <Button
                onClick={handleAddToQueue}
                size="sm"
                className="h-7 bg-orange-600 px-2 text-xs text-white hover:bg-orange-700"
              >
                <Play className="mr-1 h-3 w-3 flex-shrink-0" />
                <span className="truncate">Queue Now</span>
              </Button>
              <Button
                onClick={() => setIsScheduling(true)}
                size="sm"
                variant="outline"
                className="h-7 px-2 text-xs"
              >
                <Edit3 className="mr-1 h-3 w-3 flex-shrink-0" />
                <span className="truncate">Edit</span>
              </Button>
            </div>
          </div>
        )}

        {/* Controls for queued articles */}
        {article.status === "queued" && !isEditing && (
          <div className="mb-3 space-y-2">
            <Button
              onClick={handleRemoveFromQueue}
              size="sm"
              variant="outline"
              className="h-7 w-full border-red-200 px-2 text-xs text-red-600 hover:bg-red-50"
            >
              <X className="mr-1 h-3 w-3 flex-shrink-0" />
              <span className="truncate">Remove from Queue</span>
            </Button>
          </div>
        )}

        {/* Generation controls for to_generate status */}
        {article.status === "to_generate" && !isEditing && (
          <div className="mb-3 space-y-2">
            {isScheduling ? (
              <div className="space-y-2">
                <input
                  type="datetime-local"
                  className="w-full rounded border border-gray-200 p-2 text-xs"
                  min={new Date(Date.now() + 60000).toISOString().slice(0, 16)}
                  value={
                    selectedScheduleTime
                      ? new Date(selectedScheduleTime)
                          .toISOString()
                          .slice(0, 16)
                      : ""
                  }
                  onChange={(e) => {
                    if (e.target.value) {
                      setSelectedScheduleTime(
                        new Date(e.target.value).toISOString(),
                      );
                    } else {
                      setSelectedScheduleTime("");
                    }
                  }}
                />
                <div className="flex gap-1">
                  <Button
                    onClick={() => {
                      setIsScheduling(false);
                      setSelectedScheduleTime("");
                    }}
                    size="sm"
                    variant="outline"
                    className="h-7 flex-1 text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleConfirmScheduleGeneration}
                    size="sm"
                    disabled={!selectedScheduleTime}
                    className="h-7 flex-1 text-xs"
                  >
                    Schedule
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-1">
                <Button
                  onClick={handleGenerate}
                  size="sm"
                  className="h-7 bg-green-600 px-2 text-xs text-white hover:bg-green-700"
                >
                  <Play className="mr-1 h-3 w-3 flex-shrink-0" />
                  <span className="truncate">Generate</span>
                </Button>
                <Button
                  onClick={() => setIsScheduling(true)}
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-xs"
                >
                  <CalendarClock className="mr-1 h-3 w-3 flex-shrink-0" />
                  <span className="truncate">Schedule</span>
                </Button>
              </div>
            )}
          </div>
        )}

        {isEditing ? (
          <div className="space-y-3">
            {/* Only keeping title editing, removed description, keywords, and target audience */}
          </div>
        ) : (
          <>
            {/* Schedule information display */}
            {article.scheduledAt && (
              <div className="flex items-center gap-1 text-xs text-blue-600">
                <Calendar className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">
                  {article.status === "scheduled"
                    ? `Next: ${new Date(article.scheduledAt).toLocaleDateString()}`
                    : `Scheduled: ${new Date(article.scheduledAt).toLocaleDateString()}`}
                </span>
              </div>
            )}

            {/* Queue information display */}
            {article.status === "queued" && (
              <div className="flex items-center gap-1 text-xs text-orange-600">
                <CalendarClock className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">In generation queue</span>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
