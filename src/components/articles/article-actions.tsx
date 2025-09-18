"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Calendar, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

// Import colocated types from API routes for type safety
import type { SchedulePublishingRequest } from "@/app/api/articles/schedule-publishing/route";
import type { ArticleDetailResponse } from "@/app/api/articles/[id]/route";

interface ArticleActionsProps {
  article: ArticleDetailResponse["data"];
  onEdit: () => void;
  onStatusChange?: (newStatus: string) => void;
  className?: string;
}

export function ArticleActions({
  article,
  onEdit: _onEdit,
  onStatusChange,
  className = "",
}: ArticleActionsProps) {
  const [isScheduling, setIsScheduling] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [scheduledDate, setScheduledDate] = useState("");
  const router = useRouter();

  const handleSchedule = async () => {
    if (!scheduledDate) {
      toast.error("Please select a date and time for scheduling.");
      return;
    }

    setIsScheduling(true);
    try {
      const response = await fetch("/api/articles/schedule-publishing", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          articleId: article.id,
          publishAt: scheduledDate,
        } as SchedulePublishingRequest),
      });

      const result = (await response.json()) as {
        success: boolean;
        error?: string;
      };

      if (result.success) {
        onStatusChange?.("wait_for_publish");
        setShowScheduleDialog(false);
        setScheduledDate("");
        toast.success("Article scheduled successfully!");
      } else {
        throw new Error(result.error ?? "Failed to schedule article");
      }
    } catch (error) {
      console.error("Scheduling error:", error);
      toast.error("Failed to schedule article. Please try again.");
    } finally {
      setIsScheduling(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/articles/${article.id}`, {
        method: "DELETE",
      });

      const result = (await response.json()) as {
        success: boolean;
        error?: string;
      };

      if (result.success) {
        toast.success("Article deleted successfully!");
        // Navigate back to kanban board
        router.push("/");
      } else {
        throw new Error(result.error ?? "Failed to delete article");
      }
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Failed to delete article. Please try again.");
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const canSchedule =
    article.status === "wait_for_publish" ||
    (article.content && article.status !== "generating");

  return (
    <>
      <div className={`flex flex-wrap gap-2 ${className}`}>
        <Button
          onClick={() => setShowScheduleDialog(true)}
          disabled={!canSchedule || isScheduling}
          variant="outline"
          size="sm"
          className="flex items-center gap-2"
        >
          <Calendar className="h-4 w-4" />
          Schedule
        </Button>

        <Button
          onClick={() => setShowDeleteConfirm(true)}
          disabled={isDeleting}
          variant="destructive"
          size="sm"
          className="flex items-center gap-2"
        >
          <Trash2 className="h-4 w-4" />
          {isDeleting ? "Deleting..." : "Delete"}
        </Button>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Article</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &ldquo;{article.title}&rdquo;?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-6 flex justify-end gap-3">
            <Button
              onClick={() => setShowDeleteConfirm(false)}
              variant="outline"
              size="sm"
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDelete}
              variant="destructive"
              size="sm"
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Schedule Dialog */}
      <Dialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule Article</DialogTitle>
            <DialogDescription>
              Choose when you want this article to be published.
            </DialogDescription>
          </DialogHeader>
          <div className="mb-6">
            <label
              htmlFor="scheduledDate"
              className="mb-2 block text-sm font-medium"
            >
              Publication Date & Time
            </label>
            <input
              id="scheduledDate"
              type="datetime-local"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              className="border-input focus:ring-ring w-full rounded-md border px-3 py-2 focus:border-transparent focus:ring-2 focus:outline-none"
              min={new Date().toISOString().slice(0, 16)}
            />
          </div>
          <div className="flex justify-end gap-3">
            <Button
              onClick={() => {
                setShowScheduleDialog(false);
                setScheduledDate("");
              }}
              variant="outline"
              size="sm"
              disabled={isScheduling}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSchedule}
              variant="default"
              size="sm"
              disabled={isScheduling || !scheduledDate}
            >
              {isScheduling ? "Scheduling..." : "Schedule"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
