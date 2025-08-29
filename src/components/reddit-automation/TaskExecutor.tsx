"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  MessageCircle,
  FileText,
  ExternalLink,
  CheckCircle,
  SkipForward,
} from "lucide-react";
import type { RedditTask } from "@/types";

interface TaskExecutorProps {
  task: RedditTask | null;
  isOpen: boolean;
  onClose: () => void;
  onComplete: (
    taskId: number,
    redditUrl?: string,
    karmaEarned?: number,
  ) => void;
  onSkip: (taskId: number) => void;
}

export function TaskExecutor({
  task,
  isOpen,
  onClose,
  onComplete,
  onSkip,
}: TaskExecutorProps) {
  const [redditUrl, setRedditUrl] = useState("");
  const [karmaEarned, setKarmaEarned] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!task) return null;

  const TaskTypeIcon = task.taskType === "comment" ? MessageCircle : FileText;

  const handleComplete = () => {
    setIsSubmitting(true);
    try {
      const karma = karmaEarned ? parseInt(karmaEarned, 10) : 0;
      onComplete(task.id, redditUrl || undefined, karma || undefined);
      setRedditUrl("");
      setKarmaEarned("");
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = () => {
    setIsSubmitting(true);
    try {
      onSkip(task.id);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TaskTypeIcon className="h-5 w-5" />
            {task.taskType === "comment" ? "Comment Task" : "Post Task"}
            <Badge variant="outline">{task.subreddit}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium text-gray-700">
              Description
            </Label>
            <div className="mt-1 rounded-lg bg-gray-50">
              <p className="text-sm text-gray-900">{task.prompt}</p>
            </div>
          </div>

          {task.status === "completed" && (
            <div className="rounded-lg bg-green-50 p-3">
              <div className="mb-2 flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium text-green-900">
                  Completed on{" "}
                  {task.completedAt
                    ? new Date(task.completedAt).toLocaleDateString()
                    : "Unknown"}
                </span>
              </div>
              {task.redditUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(task.redditUrl!, "_blank")}
                  className="mb-2"
                >
                  <ExternalLink className="mr-1 h-3 w-3" />
                  View on Reddit
                </Button>
              )}
              {task.karmaEarned > 0 && (
                <p className="text-sm text-green-700">
                  Earned {task.karmaEarned} karma
                </p>
              )}
            </div>
          )}

          {task.status === "skipped" && (
            <div className="rounded-lg bg-gray-50 p-3">
              <div className="flex items-center gap-2">
                <SkipForward className="h-4 w-4 text-gray-600" />
                <span className="text-sm font-medium text-gray-900">
                  This task was skipped
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-4">
          {task.status === "pending" && (
            <>
              <Button onClick={handleComplete} disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : "Mark Complete"}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
