"use client";

import { useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

interface TimeSlot {
  day: Date;
  hour: number;
  minute: number;
}

interface ArticleCreationModalProps {
  open: boolean;
  onClose: () => void;
  timeSlot: TimeSlot | null;
  onCreateArticle: (articleData: {
    title: string;
    description?: string;
    keywords?: string[];
    targetAudience?: string;
    notes?: string;
    scheduledAt?: Date;
    scheduleType?: 'generation' | 'publishing';
  }) => void;
}

export function ArticleCreationModal({
  open,
  onClose,
  timeSlot,
  onCreateArticle,
}: ArticleCreationModalProps) {
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    keywords: "",
    targetAudience: "",
    notes: "",
    scheduleType: "generation" as "generation" | "publishing",
  });

  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim()) {
      toast.error("Please enter a title");
      return;
    }

    setLoading(true);

    try {
      const scheduledAt = timeSlot ? (() => {
        const date = new Date(timeSlot.day);
        date.setHours(timeSlot.hour, timeSlot.minute, 0, 0);
        return date;
      })() : undefined;

      await onCreateArticle({
        title: formData.title.trim(),
        description: formData.description.trim() || undefined,
        keywords: formData.keywords.split(",").map(k => k.trim()).filter(Boolean),
        targetAudience: formData.targetAudience.trim() || undefined,
        notes: formData.notes.trim() || undefined,
        scheduledAt,
        scheduleType: formData.scheduleType,
      });

      // Reset form
      setFormData({
        title: "",
        description: "",
        keywords: "",
        targetAudience: "",
        notes: "",
        scheduleType: "generation",
      });
      
      onClose();
    } catch (error) {
      console.error("Error creating article:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create New Article</DialogTitle>
          {timeSlot && (
            <div className="text-sm text-muted-foreground">
              Scheduled for {format(timeSlot.day, "MMM d, yyyy")} at{" "}
              {timeSlot.hour.toString().padStart(2, "0")}:
              {timeSlot.minute.toString().padStart(2, "0")}
            </div>
          )}
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Article Title *</Label>
            <Input
              id="title"
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Enter article title..."
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              placeholder="Brief description (optional)..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="keywords">Keywords</Label>
            <Input
              id="keywords"
              type="text"
              value={formData.keywords}
              onChange={(e) => setFormData({ ...formData, keywords: e.target.value })}
              placeholder="keyword1, keyword2, keyword3..."
            />
            <p className="text-xs text-muted-foreground">
              Separate keywords with commas
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="targetAudience">Target Audience</Label>
            <Input
              id="targetAudience"
              type="text"
              value={formData.targetAudience}
              onChange={(e) => setFormData({ ...formData, targetAudience: e.target.value })}
              placeholder="e.g., Software developers, Marketing professionals..."
            />
          </div>

          {timeSlot && (
            <div className="space-y-2">
              <Label htmlFor="scheduleType">Schedule Type</Label>
              <select
                id="scheduleType"
                value={formData.scheduleType}
                onChange={(e) => setFormData({ ...formData, scheduleType: e.target.value as "generation" | "publishing" })}
                className="w-full px-3 py-2 border border-input rounded-md bg-background"
              >
                <option value="generation">Schedule Generation</option>
                <option value="publishing">Schedule Publishing</option>
              </select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="notes">Notes for AI Generation</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={2}
              placeholder="Special instructions for AI content generation (optional)..."
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create Article"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}