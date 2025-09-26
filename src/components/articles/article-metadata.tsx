"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ArticleStatus } from "@/types";

// Article metadata data interface
interface ArticleMetadataData {
  id: number;
  title: string;
  status: ArticleStatus;
  scheduledAt?: Date | null;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface ArticleMetadataProps {
  article: ArticleMetadataData;
}

export function ArticleMetadata({ article }: ArticleMetadataProps) {
  // Format date helper
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  // Get status display text and color
  const getStatusDisplay = (status: ArticleMetadataData["status"]) => {
    const statusMap = {
      idea: { text: "Idea", color: "text-brand-white bg-brand-white/10" },
      scheduled: {
        text: "Scheduled",
        color: "text-brand-green bg-brand-green/10",
      },
      generating: {
        text: "Generating",
        color: "text-brand-orange bg-brand-orange/10",
      },
      published: {
        text: "Published",
        color: "text-brand-green bg-brand-green/20",
      },
      failed: { text: "Failed", color: "text-red-600 bg-red-100" },
    } as const satisfies Record<ArticleStatus, { text: string; color: string }>;
    return statusMap[status] ?? {
      text: status,
      color: "text-gray-600 bg-gray-100",
    };
  };

  const statusDisplay = getStatusDisplay(article.status);

  return (
    <div className="space-y-6">
      {/* Article Header with Status */}
      <div>
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <span
            className={`rounded-full px-2 py-1 text-xs font-medium ${statusDisplay.color}`}
          >
            {statusDisplay.text}
          </span>
        </div>
      </div>

      {/* Publishing Information */}
      {(article.scheduledAt ?? article.publishedAt) && (
        <Card>
          <CardHeader>
            <CardTitle>Publishing Information</CardTitle>
          </CardHeader>
          <CardContent>
            {article.scheduledAt && (
              <div className="mb-2">
                <span className="font-medium text-gray-900">
                  Scheduled for:{" "}
                </span>
                <span className="text-gray-700">
                  {formatDate(article.scheduledAt)}
                </span>
              </div>
            )}
            {article.publishedAt && (
              <div>
                <span className="font-medium text-gray-900">
                  Published at:{" "}
                </span>
                <span className="text-gray-700">
                  {formatDate(article.publishedAt)}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
