'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Image as ImageIcon } from 'lucide-react';
import Image from 'next/image';
import { ArticleActions } from './article-actions';
import { ArticleMetadata } from './article-metadata';
import { ArticleEditor } from './article-editor';
import { GenerationProgress } from './generation-progress';
import { useGenerationPolling } from '@/hooks/use-generation-polling';
import type { ArticleDetailResponse } from '@/app/api/articles/[id]/route';

interface ArticlePreviewClientProps {
  initialArticle: ArticleDetailResponse['data'];
}

export function ArticlePreviewClient({ initialArticle }: ArticlePreviewClientProps) {
  const [article, setArticle] = useState(initialArticle);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState<string | null>(null);
  const [showErrorMessage, setShowErrorMessage] = useState<string | null>(null);
  const router = useRouter();

  // Use generation status polling for articles in "generating" status
  const { status: generationStatus } = useGenerationPolling({
    articleId: article.id.toString(),
    enabled: article.status === 'generating',
    onStatusUpdate: (status) => {
      // Update article status when generation progresses
      if (status.status === 'completed') {
        setShowSuccessMessage('Article generation completed successfully!');
        setTimeout(() => setShowSuccessMessage(null), 5000);
        // Refresh the page to get the updated content
        router.refresh();
      } else if (status.status === 'failed') {
        setShowErrorMessage(status.error ?? 'Article generation failed');
        setTimeout(() => setShowErrorMessage(null), 5000);
        // Refresh the page to get the updated status
        router.refresh();
      }
    },
    onComplete: () => {
      // Update the article state when generation is complete
      setArticle(prev => ({
        ...prev,
        status: 'wait_for_publish'
      }));
    },
    onError: (error) => {
      setShowErrorMessage(`Generation status error: ${error}`);
      setTimeout(() => setShowErrorMessage(null), 5000);
    }
  });

  // Handle status changes from ArticleActions
  const handleStatusChange = useCallback((newStatus: string) => {
    setArticle(prev => ({
      ...prev,
      status: newStatus as typeof prev.status
    }));
    
    // Show success message
    setShowSuccessMessage(`Article status updated to ${newStatus}`);
    setTimeout(() => setShowSuccessMessage(null), 3000);
    
    // Refresh the page data
    router.refresh();
    
    // Store status change in sessionStorage to notify kanban board
    sessionStorage.setItem('articleStatusChanged', JSON.stringify({
      articleId: article.id,
      newStatus,
      timestamp: Date.now()
    }));
  }, [router, article.id]);

  // Handle edit mode toggle
  const handleEdit = useCallback(() => {
    setIsEditing(!isEditing);
  }, [isEditing]);

  // Handle article save
  const handleSave = useCallback(async (updatedData: Partial<ArticleDetailResponse['data']>) => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/articles/${article.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedData),
      });

      if (!response.ok) {
        throw new Error('Failed to update article');
      }

      await response.json();
      
      // Update local state
      setArticle(prev => ({ ...prev, ...updatedData }));
      setIsEditing(false);
      setShowSuccessMessage('Article updated successfully!');
      setTimeout(() => setShowSuccessMessage(null), 3000);
      
      // Refresh the page data
      router.refresh();
      
    } catch (error) {
      console.error('Save error:', error);
      setShowErrorMessage('Failed to save article changes');
      setTimeout(() => setShowErrorMessage(null), 5000);
    } finally {
      setIsSaving(false);
    }
  }, [article.id, router]);

  // Handle edit cancel
  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
  }, []);

  return (
    <div className="space-y-6">
      {/* Success/Error Messages */}
      {showSuccessMessage && (
        <div className="bg-green-50 border border-green-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-green-800">{showSuccessMessage}</p>
            </div>
          </div>
        </div>
      )}

      {showErrorMessage && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-red-800">{showErrorMessage}</p>
            </div>
          </div>
        </div>
      )}

      {/* Article Metadata */}
      <ArticleMetadata article={article} />

      {/* Generation Progress - Show when article is generating and we have status */}
      {article.status === 'generating' && generationStatus && (
        <GenerationProgress status={generationStatus} />
      )}

      {/* Article Actions */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Article Actions</h3>
        <ArticleActions
          article={article}
          onEdit={handleEdit}
          onStatusChange={handleStatusChange}
          className="mb-4"
        />
      </div>

      {/* Article Content */}
      {isEditing ? (
        <ArticleEditor
          article={article}
          onSave={handleSave}
          onCancel={handleCancelEdit}
          isLoading={isSaving}
        />
      ) : (
        <div className="space-y-6">
          {/* Cover Image Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ImageIcon className="h-5 w-5" />
                Cover Image
              </CardTitle>
            </CardHeader>
            <CardContent>
              {article.coverImageUrl ? (
                <div className="space-y-2">
                  <Image
                    src={article.coverImageUrl}
                    alt={article.coverImageAlt ?? 'Article cover image'}
                    width={800}
                    height={384}
                    className="w-full h-96 object-cover rounded-lg border"
                    unoptimized
                  />
                  {article.coverImageAlt && (
                    <p className="text-sm text-gray-600">{article.coverImageAlt}</p>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <ImageIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No cover image set</p>
                  <p className="text-sm mt-1">Use the Edit button to add a cover image</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Article Content Section */}
          <Card>
            <CardHeader>
              <CardTitle>Article Content</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Status Badge */}
                <div className="flex items-center gap-2">
                  <Badge variant={
                    article.status === 'published' ? 'default' :
                    article.status === 'wait_for_publish' ? 'secondary' :
                    article.status === 'generating' ? 'red' : 'outline'
                  }>
                    {article.status.replace('_', ' ').toUpperCase()}
                  </Badge>
                  {article.status === 'generating' && (
                    <span className="text-sm text-gray-600">Generation in progress...</span>
                  )}
                </div>

                {/* Content Display */}
                {article.optimizedContent ?? article.draft ? (
                  <div className="prose prose-lg max-w-none prose-headings:text-gray-900 prose-p:text-gray-700 prose-p:leading-relaxed prose-strong:text-gray-900">
                    <ReactMarkdown
                      remarkPlugins={[remarkBreaks, remarkGfm]}
                      components={{
                        p: ({ children }) => <p className="mb-4 leading-relaxed">{children}</p>,
                        h1: ({ children }) => <h1 className="text-2xl font-bold mb-4 text-gray-900">{children}</h1>,
                        h2: ({ children }) => <h2 className="text-xl font-semibold mb-3 text-gray-900">{children}</h2>,
                        h3: ({ children }) => <h3 className="text-lg font-medium mb-2 text-gray-900">{children}</h3>,
                        ul: ({ children }) => <ul className="list-disc pl-6 mb-4 space-y-1">{children}</ul>,
                        ol: ({ children }) => <ol className="list-decimal pl-6 mb-4 space-y-1">{children}</ol>,
                        li: ({ children }) => <li className="text-gray-700">{children}</li>,
                        strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,
                        em: ({ children }) => <em className="italic text-gray-700">{children}</em>,
                        blockquote: ({ children }) => <blockquote className="border-l-4 border-gray-300 pl-4 py-2 mb-4 italic text-gray-600">{children}</blockquote>,
                      }}
                    >
                      {(article.optimizedContent ?? article.draft) ?? ''}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <p>No content available yet</p>
                    {article.status === 'idea' && (
                      <p className="text-sm mt-2">Move to &quot;To Generate&quot; to create content</p>
                    )}
                  </div>
                )}

                {/* Meta Description */}
                {article.metaDescription && (
                  <div>
                    <Label className="text-sm font-medium mb-2 block">Meta Description</Label>
                    <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded border">
                      {article.metaDescription}
                    </p>
                  </div>
                )}

                {/* Keywords */}
                {Array.isArray(article.keywords) && article.keywords.length > 0 && (
                  <div>
                    <Label className="text-sm font-medium mb-2 block">Keywords</Label>
                    <div className="flex flex-wrap gap-2">
                      {(article.keywords as string[]).map((keyword: string, index: number) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {keyword}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Word Count */}
                {(article.optimizedContent ?? article.draft) && (
                  <div>
                    <Label className="text-sm font-medium mb-2 block">Word Count</Label>
                    <p className="text-sm text-gray-600">
                      {((article.optimizedContent ?? article.draft) ?? '').split(/\s+/).filter(word => word.length > 0).length} words
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}