"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar, Send, RotateCcw, Clock } from "lucide-react";
import type { ArticleDetailResponse } from "@/app/api/articles/[id]/route";

interface ArticleActionButtonsProps {
  article: ArticleDetailResponse["data"];
  onSuccess?: (message: string) => void;
  onError?: (message: string) => void;
}

export function ArticleActionButtons({
  article,
  onSuccess,
  onError,
}: ArticleActionButtonsProps) {
  const [isScheduling, setIsScheduling] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);

  const handleSchedule = async () => {
    setIsScheduling(true);
    try {
      // For now, schedule for 1 hour from now as a simple implementation
      const scheduledAt = new Date();
      scheduledAt.setHours(scheduledAt.getHours() + 1);

      const response = await fetch("/api/articles/schedule", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          articleId: article.id,
          scheduledAt: scheduledAt.toISOString(),
          schedulingType: "manual",
          frequency: "once",
        }),
      });

      if (!response.ok) {
        const errorData = (await response.json()) as { error?: string };
        throw new Error(errorData.error ?? "Failed to schedule article");
      }

      const result = (await response.json()) as { message?: string };
      onSuccess?.(result.message ?? "Article scheduled successfully");

      // Refresh the page to show updated status
      window.location.reload();
    } catch (error) {
      console.error("Schedule error:", error);
      onError?.(
        error instanceof Error ? error.message : "Failed to schedule article",
      );
    } finally {
      setIsScheduling(false);
    }
  };

  const handlePublish = async () => {
    setIsPublishing(true);
    try {
      const response = await fetch("/api/articles/publish", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          articleId: article.id,
        }),
      });

      if (!response.ok) {
        const errorData = (await response.json()) as { error?: string };
        throw new Error(errorData.error ?? "Failed to publish article");
      }

      onSuccess?.("Article published successfully");

      // Refresh the page to show updated status
      window.location.reload();
    } catch (error) {
      console.error("Publish error:", error);
      onError?.(
        error instanceof Error ? error.message : "Failed to publish article",
      );
    } finally {
      setIsPublishing(false);
    }
  };

  const handleRegenerate = async () => {
    setIsRegenerating(true);
    try {
      const response = await fetch("/api/articles/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          articleId: article.id.toString(),
          forceRegenerate: true,
        }),
      });

      if (!response.ok) {
        const errorData = (await response.json()) as { error?: string };
        throw new Error(errorData.error ?? "Failed to regenerate article");
      }

      onSuccess?.("Article regeneration started");

      // Refresh the page to show updated status
      window.location.reload();
    } catch (error) {
      console.error("Regenerate error:", error);
      onError?.(
        error instanceof Error ? error.message : "Failed to regenerate article",
      );
    } finally {
      setIsRegenerating(false);
    }
  };

  // Determine which buttons to show based on article status
  const canSchedule = ["idea", "wait_for_publish"].includes(article.status);
  const canPublish = article.status === "wait_for_publish";
  const canRegenerate = !["generating", "published"].includes(article.status);

  // Don't show buttons if article is currently generating
  if (article.status === "generating") {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3">
        <Clock className="h-4 w-4 animate-spin text-blue-600" />
        <span className="text-sm font-medium text-blue-800">
          Article is currently being generated...
        </span>
      </div>
    );
  }

  return (
    <div className="flex gap-1.5">
      {canSchedule && (
        <Button
          onClick={handleSchedule}
          disabled={isScheduling}
          variant="outline"
          size="sm"
          className="flex h-7 items-center gap-1 px-2 py-1 text-xs"
        >
          <Calendar className="h-3 w-3" />
          {isScheduling ? "..." : "Schedule"}
        </Button>
      )}

      {canRegenerate && (
        <Button
          onClick={handleRegenerate}
          disabled={isRegenerating}
          variant="outline"
          size="sm"
          className="flex h-7 items-center gap-1 px-2 py-1 text-xs"
        >
          <RotateCcw className="h-3 w-3" />
          {isRegenerating ? "..." : "Regenerate"}
        </Button>
      )}

      {canPublish && (
        <Button
          onClick={handlePublish}
          disabled={isPublishing}
          size="sm"
          className="flex h-7 items-center gap-1 px-2 py-1 text-xs"
        >
          <Send className="h-3 w-3" />
          {isPublishing ? "..." : "Publish"}
        </Button>
      )}
    </div>
  );
}
