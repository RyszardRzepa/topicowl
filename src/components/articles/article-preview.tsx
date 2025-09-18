"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

// Article preview data interface
interface ArticlePreviewData {
  id: number;
  title: string;
  description: string | null;
  keywords: unknown;
  targetAudience: string | null;
  status:
    | "idea"
    | "to_generate"
    | "generating"
    | "wait_for_publish"
    | "published";
  scheduledAt: Date | null;
  publishedAt: Date | null;
  estimatedReadTime: number | null;
  metaDescription: string | null;
  outline: unknown;
  optimizedContent: string | null;
  content: string | null;
  factCheckReport: unknown;
  seoScore: number | null;
  internalLinks: unknown;
  sources: unknown;
  createdAt: Date;
  updatedAt: Date;
}

interface ArticlePreviewProps {
  article: ArticlePreviewData;
}

export function ArticlePreview({ article }: ArticlePreviewProps) {
  return (
    <div className="space-y-6">
      {/* Basic Information Card */}
      <Card>
        <CardHeader>
          <CardTitle>Article Information</CardTitle>
          <CardDescription>
            Basic details and metadata for this article
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {article.description && (
            <div>
              <h3 className="mb-2 font-medium text-gray-900">Description</h3>
              <p className="text-gray-700">{article.description}</p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {article.targetAudience && (
              <div>
                <h3 className="mb-2 font-medium text-gray-900">
                  Target Audience
                </h3>
                <span className="text-gray-700">{article.targetAudience}</span>
              </div>
            )}

            {article.estimatedReadTime && (
              <div>
                <h3 className="mb-2 font-medium text-gray-900">
                  Estimated Read Time
                </h3>
                <span className="text-gray-700">
                  {article.estimatedReadTime} minutes
                </span>
              </div>
            )}

            {article.seoScore && (
              <div>
                <h3 className="mb-2 font-medium text-gray-900">SEO Score</h3>
                <span className="text-gray-700">{article.seoScore}/100</span>
              </div>
            )}
          </div>

          {article.keywords &&
          Array.isArray(article.keywords) &&
          (article.keywords as string[]).length > 0 ? (
            <div>
              <h3 className="mb-2 font-medium text-gray-900">Keywords</h3>
              <div className="flex flex-wrap gap-2">
                {(article.keywords as string[]).map((keyword, index) => (
                  <span
                    key={index}
                    className="rounded-md bg-blue-100 px-2 py-1 text-sm text-blue-800"
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
          <CardDescription>
            The generated or draft content for this article
          </CardDescription>
        </CardHeader>
        <CardContent>
          {article.status === "generating" ? (
            <div className="py-8 text-center">
              <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600"></div>
              <p className="text-gray-600">Article is being generated...</p>
            </div>
          ) : article.optimizedContent ? (
            <div className="prose max-w-none">
              <div className="whitespace-pre-wrap text-gray-700">
                {article.optimizedContent}
              </div>
            </div>
          ) : article.content ? (
            <div className="prose max-w-none">
              <div className="mb-4">
                <span className="inline-block rounded-md bg-yellow-100 px-2 py-1 text-xs text-yellow-800">
                  Content
                </span>
              </div>
              <div className="whitespace-pre-wrap text-gray-700">
                {article.content}
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-gray-500">
              <p>No content available yet.</p>
              {article.status === "idea" && (
                <p className="mt-2 text-sm">
                  Move this article to &ldquo;To Generate&rdquo; to create
                  content.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
