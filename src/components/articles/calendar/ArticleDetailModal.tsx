"use client";

import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface ArticleWithScheduling {
  id: number;
  title: string;
  description: string | null;
  status: string;
  projectId: number;
  keywords: unknown;
  targetAudience: string | null;
  publishScheduledAt: Date | null;
  publishedAt: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  generationScheduledAt?: Date | null;
  generationStatus?: string | null;
  generationProgress?: number | null;
}

interface ArticleDetailModalProps {
  open: boolean;
  onClose: () => void;
  article: ArticleWithScheduling | null;
}

// Status display mapping
const statusLabels = {
  idea: { label: "Idea", color: "secondary" },
  scheduled: { label: "Scheduled", color: "blue" },
  generating: { label: "Generating", color: "yellow" },
  research: { label: "Researching", color: "orange" },
  outline: { label: "Outlining", color: "orange" },
  writing: { label: "Writing", color: "orange" },
  "quality-control": { label: "Quality Control", color: "orange" },
  validation: { label: "Validating", color: "orange" },
  updating: { label: "Updating", color: "orange" },
  "wait_for_publish": { label: "Ready to Publish", color: "green" },
  published: { label: "Published", color: "green" },
  failed: { label: "Failed", color: "destructive" },
} as const;

export function ArticleDetailModal({
  open,
  onClose,
  article,
}: ArticleDetailModalProps) {
  if (!article) return null;

  const statusInfo = statusLabels[article.status as keyof typeof statusLabels] || statusLabels.idea;
  const keywords = Array.isArray(article.keywords) ? article.keywords : [];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {article.title}
            <Badge variant={statusInfo.color as any}>
              {statusInfo.label}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 max-h-96 overflow-y-auto">
          {article.description && (
            <div>
              <h4 className="font-medium text-sm text-muted-foreground mb-1">
                Description
              </h4>
              <p className="text-sm">{article.description}</p>
            </div>
          )}

          {keywords.length > 0 && (
            <div>
              <h4 className="font-medium text-sm text-muted-foreground mb-2">
                Keywords
              </h4>
              <div className="flex flex-wrap gap-1">
                {keywords.map((keyword, index) => (
                  <Badge key={index} variant="outline" className="text-xs">
                    {String(keyword)}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {article.targetAudience && (
            <div>
              <h4 className="font-medium text-sm text-muted-foreground mb-1">
                Target Audience
              </h4>
              <p className="text-sm">{article.targetAudience}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-medium text-sm text-muted-foreground mb-1">
                Created
              </h4>
              <p className="text-sm">
                {format(new Date(article.createdAt), "MMM d, yyyy 'at' h:mm a")}
              </p>
            </div>

            <div>
              <h4 className="font-medium text-sm text-muted-foreground mb-1">
                Last Updated
              </h4>
              <p className="text-sm">
                {format(new Date(article.updatedAt), "MMM d, yyyy 'at' h:mm a")}
              </p>
            </div>
          </div>

          {article.generationScheduledAt && (
            <div>
              <h4 className="font-medium text-sm text-muted-foreground mb-1">
                Generation Scheduled
              </h4>
              <p className="text-sm">
                {format(new Date(article.generationScheduledAt), "MMM d, yyyy 'at' h:mm a")}
              </p>
            </div>
          )}

          {article.publishScheduledAt && (
            <div>
              <h4 className="font-medium text-sm text-muted-foreground mb-1">
                Publishing Scheduled
              </h4>
              <p className="text-sm">
                {format(new Date(article.publishScheduledAt), "MMM d, yyyy 'at' h:mm a")}
              </p>
            </div>
          )}

          {article.publishedAt && (
            <div>
              <h4 className="font-medium text-sm text-muted-foreground mb-1">
                Published
              </h4>
              <p className="text-sm">
                {format(new Date(article.publishedAt), "MMM d, yyyy 'at' h:mm a")}
              </p>
            </div>
          )}

          {article.generationProgress !== undefined && 
           article.generationProgress !== null && 
           article.generationProgress > 0 && (
            <div>
              <h4 className="font-medium text-sm text-muted-foreground mb-2">
                Generation Progress
              </h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>{article.generationStatus || "In Progress"}</span>
                  <span>{article.generationProgress}%</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all"
                    style={{ width: `${article.generationProgress}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {article.notes && (
            <div>
              <h4 className="font-medium text-sm text-muted-foreground mb-1">
                Notes
              </h4>
              <div className="text-sm bg-muted/50 p-3 rounded-md">
                <pre className="whitespace-pre-wrap text-xs">{article.notes}</pre>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          {/* Future: Add Edit button that opens the article editor */}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}