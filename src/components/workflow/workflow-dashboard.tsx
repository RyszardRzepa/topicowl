'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { WorkflowTabs } from './workflow-tabs';
import { PlanningHub } from './planning-hub';
import { PublishingPipeline } from './publishing-pipeline';
import type { Article, WorkflowPhase } from '@/types';

interface WorkflowDashboardProps {
  className?: string;
}

export function WorkflowDashboard({ className }: WorkflowDashboardProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<WorkflowPhase>('planning');
  const [articles, setArticles] = useState<Article[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch articles from API
  const fetchArticles = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/articles/board');
      if (!response.ok) {
        throw new Error('Failed to fetch articles');
      }
      
      // Transform kanban board response to flat articles array
      const data = await response.json();
      const allArticles: Article[] = [];
      
      if (Array.isArray(data)) {
        data.forEach((column: any) => {
          if (column.articles && Array.isArray(column.articles)) {
            column.articles.forEach((article: any) => {
              allArticles.push({
                id: article.id.toString(),
                title: article.title,
                content: article.optimizedContent || article.draft,
                status: article.status,
                keywords: Array.isArray(article.keywords) ? article.keywords : [],
                createdAt: article.createdAt,
                updatedAt: article.updatedAt,
                generationProgress: article.generationProgress || 0,
                estimatedReadTime: article.estimatedReadTime,
                views: article.views || 0,
                clicks: article.clicks || 0,
                generationScheduledAt: article.generationScheduledAt,
                generationStartedAt: article.generationStartedAt,
                generationCompletedAt: article.generationCompletedAt,
                publishScheduledAt: article.scheduledAt,
                publishedAt: article.publishedAt,
              });
            });
          }
        });
      }
      
      setArticles(allArticles);
      setError(null);
    } catch (error) {
      console.error('Failed to load articles:', error);
      setError('Failed to load articles');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchArticles();
  }, []);

  // Refresh when returning from article preview
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        const statusChange = sessionStorage.getItem('articleStatusChanged');
        if (statusChange) {
          sessionStorage.removeItem('articleStatusChanged');
          void fetchArticles();
        }
      }
    };

    const handleFocus = () => {
      const statusChange = sessionStorage.getItem('articleStatusChanged');
      if (statusChange) {
        sessionStorage.removeItem('articleStatusChanged');
        void fetchArticles();
      }
    };

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'articleStatusChanged' && e.newValue) {
        void fetchArticles();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('storage', handleStorageChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // Article action handlers
  const handleCreateArticle = async (data: { title: string; keywords?: string[] }) => {
    try {
      const response = await fetch('/api/articles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: data.title,
          description: 'Click to edit this article idea',
          keywords: data.keywords || [],
          priority: 'medium',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create article');
      }

      await fetchArticles(); // Refresh articles
    } catch (error) {
      console.error('Failed to create article:', error);
      setError('Failed to create article');
    }
  };

  const handleUpdateArticle = async (articleId: string, updates: Partial<Article>) => {
    try {
      const response = await fetch(`/api/articles/${articleId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error('Failed to update article');
      }

      // Optimistic update
      setArticles(prev => prev.map(article => 
        article.id === articleId ? { ...article, ...updates } : article
      ));
    } catch (error) {
      console.error('Failed to update article:', error);
      setError('Failed to update article');
      await fetchArticles(); // Revert on error
    }
  };

  const handleDeleteArticle = async (articleId: string) => {
    try {
      const response = await fetch(`/api/articles/${articleId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete article');
      }

      // Optimistic update
      setArticles(prev => prev.filter(article => article.id !== articleId));
    } catch (error) {
      console.error('Failed to delete article:', error);
      setError('Failed to delete article');
      await fetchArticles(); // Revert on error
    }
  };

  const handleGenerateArticle = async (articleId: string) => {
    try {
      const response = await fetch('/api/articles/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleId }),
      });

      if (!response.ok) {
        throw new Error('Failed to start article generation');
      }

      // Optimistic update to generating status
      setArticles(prev => prev.map(article => 
        article.id === articleId ? { ...article, status: 'generating', generationProgress: 0 } : article
      ));
    } catch (error) {
      console.error('Failed to generate article:', error);
      setError('Failed to generate article');
    }
  };

  const handleScheduleGeneration = async (articleId: string, scheduledAt: Date) => {
    try {
      const response = await fetch('/api/articles/schedule-generation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          articleId: parseInt(articleId),
          generationScheduledAt: scheduledAt.toISOString(),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to schedule generation');
      }

      // Optimistic update
      setArticles(prev => prev.map(article => 
        article.id === articleId ? { ...article, generationScheduledAt: scheduledAt.toISOString() } : article
      ));
    } catch (error) {
      console.error('Failed to schedule generation:', error);
      setError('Failed to schedule generation');
    }
  };

  const handlePublishArticle = async (articleId: string) => {
    try {
      // Update article status to published
      await handleUpdateArticle(articleId, { 
        status: 'published', 
        publishedAt: new Date().toISOString() 
      });
    } catch (error) {
      console.error('Failed to publish article:', error);
      setError('Failed to publish article');
    }
  };

  const handleSchedulePublishing = async (articleId: string, scheduledAt: Date) => {
    try {
      // Update article with scheduled publish time
      await handleUpdateArticle(articleId, { 
        publishScheduledAt: scheduledAt.toISOString() 
      });
    } catch (error) {
      console.error('Failed to schedule publishing:', error);
      setError('Failed to schedule publishing');
    }
  };

  const handleBulkGenerate = async (articleIds: string[]) => {
    // For now, generate each article individually
    for (const articleId of articleIds) {
      await handleGenerateArticle(articleId);
    }
  };

  const handleBulkScheduleGeneration = async (articleIds: string[], scheduledAt: Date) => {
    // For now, schedule each article individually
    for (const articleId of articleIds) {
      await handleScheduleGeneration(articleId, scheduledAt);
    }
  };

  const handleBulkPublish = async (articleIds: string[]) => {
    // For now, publish each article individually
    for (const articleId of articleIds) {
      await handlePublishArticle(articleId);
    }
  };

  const handleBulkSchedulePublishing = async (articleIds: string[], scheduledAt: Date) => {
    // For now, schedule each article individually
    for (const articleId of articleIds) {
      await handleSchedulePublishing(articleId, scheduledAt);
    }
  };

  const handleNavigateToArticle = (articleId: string) => {
    router.push(`/articles/${articleId}`);
  };

  // Count articles for each phase
  const planningArticles = articles.filter(a => 
    a.status === 'idea' || a.status === 'to_generate' || a.status === 'generating'
  );
  const publishingArticles = articles.filter(a => 
    a.status === 'wait_for_publish' || a.status === 'published'
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading workflow dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button 
            onClick={fetchArticles}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Content Workflow</h1>
        <p className="text-sm text-gray-600 mt-1">
          Manage your article creation and publishing pipeline
        </p>
      </div>

      <WorkflowTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
        planningCount={planningArticles.length}
        publishingCount={publishingArticles.length}
      />

      {activeTab === 'planning' ? (
        <PlanningHub
          articles={planningArticles}
          onCreateArticle={handleCreateArticle}
          onUpdateArticle={handleUpdateArticle}
          onDeleteArticle={handleDeleteArticle}
          onGenerateArticle={handleGenerateArticle}
          onScheduleGeneration={handleScheduleGeneration}
          onBulkGenerate={handleBulkGenerate}
          onBulkSchedule={handleBulkScheduleGeneration}
          onNavigateToArticle={handleNavigateToArticle}
        />
      ) : (
        <PublishingPipeline
          articles={publishingArticles}
          onUpdateArticle={handleUpdateArticle}
          onPublishArticle={handlePublishArticle}
          onSchedulePublishing={handleSchedulePublishing}
          onBulkPublish={handleBulkPublish}
          onBulkSchedule={handleBulkSchedulePublishing}
          onNavigateToArticle={handleNavigateToArticle}
        />
      )}
    </div>
  );
}