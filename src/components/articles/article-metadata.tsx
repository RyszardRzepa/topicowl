'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Article metadata data interface
interface ArticleMetadataData {
  id: number;
  title: string;
  status: "idea" | "to_generate" | "generating" | "wait_for_publish" | "published";
  scheduledAt: Date | null;
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
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  // Get status display text and color
  const getStatusDisplay = (status: ArticleMetadataData['status']) => {
    const statusMap = {
      idea: { text: 'Idea', color: 'text-gray-600 bg-gray-100' },
      to_generate: { text: 'To Generate', color: 'text-blue-600 bg-blue-100' },
      generating: { text: 'Generating', color: 'text-yellow-600 bg-yellow-100' },
      wait_for_publish: { text: 'Wait for Publish', color: 'text-purple-600 bg-purple-100' },
      published: { text: 'Published', color: 'text-green-600 bg-green-100' },
    };
    return statusMap[status];
  };

  const statusDisplay = getStatusDisplay(article.status);

  return (
    <div className="space-y-6">
      {/* Article Header with Status */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          {article.title}
        </h1>
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <span
            className={`px-2 py-1 rounded-full text-xs font-medium ${statusDisplay.color}`}
          >
            {statusDisplay.text}
          </span>
          <span>Created {formatDate(article.createdAt)}</span>
          {article.updatedAt.getTime() !== article.createdAt.getTime() && (
            <span>Updated {formatDate(article.updatedAt)}</span>
          )}
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
                <span className="font-medium text-gray-900">Scheduled for: </span>
                <span className="text-gray-700">{formatDate(article.scheduledAt)}</span>
              </div>
            )}
            {article.publishedAt && (
              <div>
                <span className="font-medium text-gray-900">Published at: </span>
                <span className="text-gray-700">{formatDate(article.publishedAt)}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}