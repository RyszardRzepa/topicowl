"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar, Send, Clock } from "lucide-react";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import type { ArticleDetailResponse } from "@/app/api/articles/[id]/route";
import type { ScheduleGenerationResponse } from "@/app/api/articles/schedule-generation/route";
import type { SchedulePublishingResponse } from "@/app/api/articles/schedule-publishing/route";

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
  const [showSchedulingUI, setShowSchedulingUI] = useState(false);
  const [selectedScheduleTime, setSelectedScheduleTime] = useState<
    Date | undefined
  >(undefined);

  // Make button text context-aware based on article status
  const getScheduleButtonText = () => {
    if (article.status === "idea" || article.status === "to_generate") {
      return "Schedule Generation";
    }
    if (article.status === "wait_for_publish") {
      return "Schedule Publishing";
    }
    return "Schedule";
  };

  const handleSchedule = async () => {
    setShowSchedulingUI(true);
  };

  const handleConfirmSchedule = async () => {
    if (!selectedScheduleTime) return;

    setIsScheduling(true);
    try {
      let endpoint: string;
      let body: object;

      if (article.status === "idea" || article.status === "to_generate") {
        // Use generation scheduling endpoint
        endpoint = "/api/articles/schedule-generation";
        body = {
          articleId: article.id,
          scheduledAt: selectedScheduleTime.toISOString(),
        };
      } else if (article.status === "wait_for_publish") {
        // Use publishing scheduling endpoint
        endpoint = "/api/articles/schedule-publishing";
        body = {
          articleId: article.id,
          publishAt: selectedScheduleTime.toISOString(),
        };
      } else {
        throw new Error("Cannot schedule article in current status");
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = (await response.json()) as { error?: string };
        throw new Error(errorData.error ?? "Failed to schedule article");
      }

      let result: ScheduleGenerationResponse | SchedulePublishingResponse;
      if (article.status === "idea" || article.status === "to_generate") {
        result = (await response.json()) as ScheduleGenerationResponse;
        if (!result.success) {
          throw new Error(result.error ?? "Failed to schedule generation");
        }
      } else {
        result = (await response.json()) as SchedulePublishingResponse;
        if (!result.success) {
          throw new Error("Failed to schedule publishing");
        }
      }

      onSuccess?.(result.message ?? "Article scheduled successfully");

      // Reset scheduling UI
      setShowSchedulingUI(false);
      setSelectedScheduleTime(undefined);

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
          projectId: article.projectId,
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

  // Determine which buttons to show based on article status
  const canSchedule = ["idea", "wait_for_publish"].includes(article.status);
  const canPublish = article.status === "wait_for_publish";

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
    <div className="space-y-3">
      {/* Scheduling UI */}
      {showSchedulingUI && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
          <div className="space-y-3">
            <div className="text-sm font-medium text-gray-700">
              {article.status === "idea" || article.status === "to_generate"
                ? "Schedule Generation"
                : "Schedule Publishing"}
            </div>
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
                  setShowSchedulingUI(false);
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
                disabled={!selectedScheduleTime || isScheduling}
                className="flex-1"
              >
                {isScheduling ? "Scheduling..." : "Confirm"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-1.5">
        {canSchedule && !showSchedulingUI && (
          <Button
            onClick={handleSchedule}
            disabled={isScheduling}
            variant="outline"
            size="sm"
            className="flex h-7 items-center gap-1 px-2 py-1 text-xs"
          >
            <Calendar className="h-3 w-3" />
            {getScheduleButtonText()}
          </Button>
        )}

        {/* {canRegenerate && (
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
        )} */}

        {canPublish && (
          <Button
            onClick={handlePublish}
            disabled={isPublishing}
            size="sm"
            className="flex h-7 items-center gap-1 px-2 py-1 text-xs"
          >
            <Send className="h-3 w-3" />
            {isPublishing ? "..." : "Publish Now"}
          </Button>
        )}
      </div>
    </div>
  );
}
