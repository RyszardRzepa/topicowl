'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Article preview data interface
interface ArticlePreviewData {
  id: number;
  title: string;
  description: string | null;
  keywords: unknown;
  targetAudience: string | null;
  status: "idea" | "to_generate" | "generating" | "wait_for_publish" | "published";
  scheduledAt: Date | null;
  publishedAt: Date | null;
  priority: "low" | "medium" | "high";
  estimatedReadTime: number | null;
  metaDescription: string | null;
  outline: unknown;
  draft: string | null;
  optimizedContent: string | null;
  factCheckReport: unknown;
  seoScore: number | null;
  internalLinks: unknown;
  sources: unknown;
  generationTaskId: string | null;
  generationScheduledAt: Date | null;
  generationStartedAt: Date | null;
  generationCompletedAt: Date | null;
  generationError: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface ArticlePreviewProps {
  article: ArticlePreviewData;
}

export function ArticlePreview({ article }: ArticlePreviewProps) {
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

  return (
    <div className="space-y-6">
      {/* Basic Information Card */}
      <Card>
        <CardHeader>
          <CardTitle>Article Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {article.description && (
            <div>
              <h3 className="font-medium text-gray-900 mb-2">Description</h3>
              <p className="text-gray-700">{article.description}</p>
            </div>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="font-medium text-gray-900 mb-2">Priority</h3>
              <span className="capitalize text-gray-700">{article.priority}</span>
            </div>
            
            {article.targetAudience && (
              <div>
                <h3 className="font-medium text-gray-900 mb-2">Target Audience</h3>
                <span className="text-gray-700">{article.targetAudience}</span>
              </div>
            )}
            
            {article.estimatedReadTime && (
              <div>
                <h3 className="font-medium text-gray-900 mb-2">Estimated Read Time</h3>
                <span className="text-gray-700">{article.estimatedReadTime} minutes</span>
              </div>
            )}
            
            {article.seoScore && (
              <div>
                <h3 className="font-medium text-gray-900 mb-2">SEO Score</h3>
                <span className="text-gray-700">{article.seoScore}/100</span>
              </div>
            )}
          </div>

          {article.keywords && Array.isArray(article.keywords) && (article.keywords as string[]).length > 0 ? (
            <div>
              <h3 className="font-medium text-gray-900 mb-2">Keywords</h3>
              <div className="flex flex-wrap gap-2">
                {(article.keywords as string[]).map((keyword, index) => (
                  <span
                    key={index}
                    className="px-2 py-1 bg-blue-100 text-blue-800 text-sm rounded-md"
                  >
                    {keyword}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Content Card */}
      <Card>
        <CardHeader>
          <CardTitle>Content</CardTitle>
        </CardHeader>
        <CardContent>
          {article.status === 'generating' ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Article is being generated...</p>
              {article.generationStartedAt && (
                <p className="text-sm text-gray-500 mt-2">
                  Started {formatDate(article.generationStartedAt)}
                </p>
              )}
            </div>
          ) : article.optimizedContent ? (
            <div className="prose max-w-none">
              <div className="whitespace-pre-wrap text-gray-700">
                {article.optimizedContent}
              </div>
            </div>
          ) : article.draft ? (
            <div className="prose max-w-none">
              <div className="mb-4">
                <span className="inline-block px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-md">
                  Draft
                </span>
              </div>
              <div className="whitespace-pre-wrap text-gray-700">
                {article.draft}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>No content available yet.</p>
              {article.status === 'idea' && (
                <p className="text-sm mt-2">Move this article to &ldquo;To Generate&rdquo; to create content.</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Generation Error Card */}
      {article.generationError && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-800">Generation Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-red-700">{article.generationError}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}