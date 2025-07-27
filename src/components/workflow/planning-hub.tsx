'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DateTimePicker } from '@/components/ui/date-time-picker';
import { ArticleCard } from './article-card';
import { Plus, Play, Calendar, Settings } from 'lucide-react';
import type { Article } from '@/types';

interface PlanningHubProps {
  articles: Article[];
  onCreateArticle: (data: { title: string; keywords?: string[] }) => Promise<void>;
  onUpdateArticle: (articleId: string, updates: Partial<Article>) => Promise<void>;
  onDeleteArticle: (articleId: string) => Promise<void>;
  onGenerateArticle: (articleId: string) => Promise<void>;
  onScheduleGeneration: (articleId: string, scheduledAt: Date) => Promise<void>;
  onBulkGenerate: (articleIds: string[]) => Promise<void>;
  onBulkSchedule: (articleIds: string[], scheduledAt: Date) => Promise<void>;
  onNavigateToArticle: (articleId: string) => void;
}

export function PlanningHub({
  articles,
  onCreateArticle,
  onUpdateArticle,
  onDeleteArticle,
  onGenerateArticle,
  onScheduleGeneration,
  onBulkGenerate,
  onBulkSchedule,
  onNavigateToArticle
}: PlanningHubProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [newArticleData, setNewArticleData] = useState({
    title: '',
    keywords: ''
  });
  const [selectedArticles, setSelectedArticles] = useState<Set<string>>(new Set());
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [isSchedulingBulk, setIsSchedulingBulk] = useState(false);

  // Group articles by status for planning phase
  // Filter out articles that are already scheduled for generation
  const ideaArticles = articles.filter(a => a.status === 'idea' && !a.generationScheduledAt);
  const readyArticles = articles.filter(a => a.status === 'to_generate' && !a.generationScheduledAt);
  const generatingArticles = articles.filter(a => a.status === 'generating');

  // Clear selection when articles change (e.g., when they get scheduled and move to another tab)
  useEffect(() => {
    const availableArticleIds = new Set([...ideaArticles, ...readyArticles].map(a => a.id));
    const currentSelection = Array.from(selectedArticles);
    const validSelection = currentSelection.filter(id => availableArticleIds.has(id));
    
    if (validSelection.length !== currentSelection.length) {
      setSelectedArticles(new Set(validSelection));
      // If no articles are selected anymore, exit bulk mode
      if (validSelection.length === 0) {
        setIsBulkMode(false);
      }
    }
  }, [ideaArticles, readyArticles, selectedArticles]);

  const handleCreateArticle = async () => {
    if (!newArticleData.title.trim()) return;

    const keywords = newArticleData.keywords
      .split(',')
      .map(k => k.trim())
      .filter(k => k.length > 0);

    await onCreateArticle({
      title: newArticleData.title.trim(),
      keywords: keywords.length > 0 ? keywords : undefined
    });

    setNewArticleData({ title: '', keywords: '' });
    setIsCreating(false);
  };

  const handleBulkGenerate = async () => {
    if (selectedArticles.size === 0) return;
    await onBulkGenerate(Array.from(selectedArticles));
    setSelectedArticles(new Set());
    setIsBulkMode(false);
  };

  const handleBulkSchedule = async (scheduledAt: string) => {
    if (selectedArticles.size === 0) return;
    await onBulkSchedule(Array.from(selectedArticles), new Date(scheduledAt));
    setSelectedArticles(new Set());
    setIsBulkMode(false);
    setIsSchedulingBulk(false);
  };

  const toggleArticleSelection = (articleId: string) => {
    const newSelected = new Set(selectedArticles);
    if (newSelected.has(articleId)) {
      newSelected.delete(articleId);
    } else {
      newSelected.add(articleId);
    }
    setSelectedArticles(newSelected);
  };

  return (
    <div 
      role="tabpanel" 
      id="planning-panel" 
      aria-labelledby="planning-tab"
      className="space-y-6"
    >
      {/* Header with actions */} 
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Article Planning Hub</h2>
          <p className="text-sm text-gray-600 mt-1">
            Create ideas and manage article generation
          </p>
        </div>
        
        <div className="flex gap-2 flex-wrap">
          {/* Bulk action mode toggle */}
          {readyArticles.length > 0 && (
            <Button
              variant={isBulkMode ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setIsBulkMode(!isBulkMode);
                setSelectedArticles(new Set());
              }}
            >
              <Settings className="mr-2 h-4 w-4" />
              {isBulkMode ? 'Exit Bulk Mode' : 'Bulk Actions'}
            </Button>
          )}

          {/* Bulk actions */}
          {isBulkMode && selectedArticles.size > 0 && (
            <>
              <Button
                size="sm"
                className="bg-green-600 hover:bg-green-700"
                onClick={handleBulkGenerate}
              >
                <Play className="mr-2 h-4 w-4" />
                Generate Selected ({selectedArticles.size})
              </Button>
              
              {isSchedulingBulk ? (
                <div className="flex items-center gap-2">
                  <DateTimePicker
                    value={undefined}
                    onChange={(date) => {
                      if (date) {
                        void handleBulkSchedule(date.toISOString());
                        setIsSchedulingBulk(false);
                      }
                    }}
                    placeholder="Select date and time"
                    minDate={new Date(Date.now() + 60000)}
                    className="text-xs"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsSchedulingBulk(false)}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsSchedulingBulk(true)}
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  Schedule Selected
                </Button>
              )}
            </>
          )}

          {/* Create new article */}
          <Button
            onClick={() => setIsCreating(true)}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Article Idea
          </Button>
        </div>
      </div>

      {/* Create article form */}
      {isCreating && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="text-base">Create New Article Idea</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Article Title *
              </label>
              <input
                type="text"
                value={newArticleData.title}
                onChange={(e) => setNewArticleData({ ...newArticleData, title: e.target.value })}
                placeholder="Enter your article title..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Keywords (optional)
              </label>
              <input
                type="text"
                value={newArticleData.keywords}
                onChange={(e) => setNewArticleData({ ...newArticleData, keywords: e.target.value })}
                placeholder="keyword1, keyword2, keyword3..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">Separate keywords with commas</p>
            </div>
            
            <div className="flex gap-2">
              <Button
                onClick={handleCreateArticle}
                disabled={!newArticleData.title.trim()}
                className="bg-green-600 hover:bg-green-700"
              >
                Create Article
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setIsCreating(false);
                  setNewArticleData({ title: '', keywords: '' });
                }}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Article sections */}
      <div className="grid gap-6">
        {/* Ideas section */}
        {ideaArticles.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-medium text-gray-900">
                Ideas ({ideaArticles.length})
              </h3>
            </div>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {ideaArticles.map((article) => (
                <ArticleCard
                  key={article.id}
                  article={article}
                  mode="planning"
                  onUpdate={onUpdateArticle}
                  onDelete={onDeleteArticle}
                  onGenerate={onGenerateArticle}
                  onScheduleGeneration={onScheduleGeneration}
                  onNavigate={onNavigateToArticle}
                />
              ))}
            </div>
          </section>
        )}

        {/* Ready to generate section */}
        {readyArticles.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-medium text-gray-900">
                Ready to Generate ({readyArticles.length})
              </h3>
            </div>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {readyArticles.map((article) => (
                <div key={article.id} className="relative">
                  {isBulkMode && !article.generationScheduledAt && (
                    <div className="absolute top-2 left-2 z-10">
                      <input
                        type="checkbox"
                        checked={selectedArticles.has(article.id)}
                        onChange={() => toggleArticleSelection(article.id)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                    </div>
                  )}
                  <ArticleCard
                    article={article}
                    mode="planning"
                    onUpdate={onUpdateArticle}
                    onDelete={onDeleteArticle}
                    onGenerate={onGenerateArticle}
                    onScheduleGeneration={onScheduleGeneration}
                    onNavigate={onNavigateToArticle}
                    className={isBulkMode && !article.generationScheduledAt ? 'ml-6' : ''}
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Currently generating section */}
        {generatingArticles.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-medium text-gray-900">
                Generating ({generatingArticles.length})
              </h3>
            </div>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {generatingArticles.map((article) => (
                <ArticleCard
                  key={article.id}
                  article={article}
                  mode="planning"
                  onGenerate={onGenerateArticle}
                  onScheduleGeneration={onScheduleGeneration}
                  onNavigate={onNavigateToArticle}
                />
              ))}
            </div>
          </section>
        )}

        {/* Scheduled articles section */}
        {articles.filter(a => a.generationScheduledAt && !['generating', 'published'].includes(a.status)).length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-medium text-gray-900">
                Scheduled for Generation ({articles.filter(a => a.generationScheduledAt && !['generating', 'published'].includes(a.status)).length})
              </h3>
            </div>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {articles
                .filter(a => a.generationScheduledAt && !['generating', 'published'].includes(a.status))
                .map((article) => (
                  <ArticleCard
                    key={article.id}
                    article={article}
                    mode="planning"
                    onNavigate={onNavigateToArticle}
                  />
                ))}
            </div>
          </section>
        )}

        {/* Empty state */}
        {articles.length === 0 && (
          <div className="text-center py-12">
            <div className="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <Plus className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No articles yet</h3>
            <p className="text-gray-600 mb-4">
              Get started by creating your first article idea
            </p>
            <Button
              onClick={() => setIsCreating(true)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="mr-2 h-4 w-4" />
              Create Your First Article
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}