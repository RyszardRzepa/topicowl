'use client';

// Generation status data interface
interface GenerationStatusData {
  status: "idea" | "to_generate" | "generating" | "wait_for_publish" | "published";
  generationStartedAt: Date | null;
  generationCompletedAt: Date | null;
  generationError: string | null;
}

interface GenerationStatusProps {
  article: GenerationStatusData;
}

export function GenerationStatus({ article }: GenerationStatusProps) {
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

  // Only show generation status for generating articles
  if (article.status !== 'generating') {
    return null;
  }

  return (
    <div className="text-center py-8">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
      <p className="text-gray-600">Article is being generated...</p>
      {article.generationStartedAt && (
        <p className="text-sm text-gray-500 mt-2">
          Started {formatDate(article.generationStartedAt)}
        </p>
      )}
    </div>
  );
}