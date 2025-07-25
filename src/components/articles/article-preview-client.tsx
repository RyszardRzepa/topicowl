'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArticleActions } from './article-actions';
import { ArticlePreview } from './article-preview';
import { ArticleMetadata } from './article-metadata';
import { ArticleEditor } from './article-editor';
import { GenerationProgress } from './generation-progress';
import { useGenerationStatus } from '@/hooks/use-generation-status';
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
  const { status: generationStatus } = useGenerationStatus({
    articleId: article.id.toString(),
    enabled: article.status === 'generating',
    onStatusChange: (status) => {
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
    onComplete: (status) => {
      // Update the article state when generation is complete
      setArticle(prev => ({
        ...prev,
        status: status.status === 'completed' ? 'wait_for_publish' : 'to_generate'
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
        <ArticlePreview article={article} />
      )}
    </div>
  );
}