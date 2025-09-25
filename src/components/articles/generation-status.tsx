"use client";

import type { ArticleStatus } from "@/types";

interface GenerationStatusData {
  status: ArticleStatus;
}

interface GenerationStatusProps {
  article: GenerationStatusData;
}

export function GenerationStatus({ article }: GenerationStatusProps) {
  // Only show generation status for generating articles
  if (article.status !== "generating") {
    return null;
  }

  return (
    <div className="py-8 text-center">
      <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600"></div>
      <p className="text-gray-600">Article is being generated...</p>
    </div>
  );
}
