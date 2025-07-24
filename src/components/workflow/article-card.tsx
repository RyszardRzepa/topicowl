'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatusIndicator, formatRelativeTime } from './status-indicator';
import { 
  Play, 
  Calendar, 
  Edit3, 
  Trash2, 
  Check, 
  X, 
  Eye,
  MousePointer,
  Clock
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Article, WorkflowPhase } from '@/types';

interface ArticleCardProps {
  article: Article;
  mode: WorkflowPhase;
  onUpdate?: (articleId: string, updates: Partial<Article>) => Promise<void>;
  onDelete?: (articleId: string) => Promise<void>;
  onGenerate?: (articleId: string) => Promise<void>;
  onScheduleGeneration?: (articleId: string, scheduledAt: Date) => Promise<void>;
  onPublish?: (articleId: string) => Promise<void>;
  onSchedulePublishing?: (articleId: string, scheduledAt: Date) => Promise<void>;
  onNavigate?: (articleId: string) => void;
  className?: string;
}

export function ArticleCard({
  article,
  mode,
  onUpdate,
  onDelete,
  onGenerate,
  onScheduleGeneration,
  onPublish,
  onSchedulePublishing,
  onNavigate,
  className
}: ArticleCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isScheduling, setIsScheduling] = useState(false);
  const [editData, setEditData] = useState({
    title: article.title,
  });
  const [isUpdating, setIsUpdating] = useState(false);

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't navigate if clicking on interactive elements or during editing
    if (isEditing || isScheduling) return;
    
    const target = e.target as HTMLElement;
    const isInteractive = target.closest('button') || target.closest('input') || target.closest('a');
    
    if (!isInteractive && onNavigate) {
      e.preventDefault();
      onNavigate(article.id);
    }
  };

  const handleSave = async () => {
    if (!editData.title.trim() || !onUpdate) return;

    setIsUpdating(true);
    try {
      await onUpdate(article.id, { title: editData.title.trim() });
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to update article:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancel = () => {
    setEditData({ title: article.title });
    setIsEditing(false);
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    if (window.confirm('Are you sure you want to delete this article?')) {
      await onDelete(article.id);
    }
  };

  const handleGenerate = async () => {
    if (onGenerate) {
      await onGenerate(article.id);
    }
  };

  const handlePublish = async () => {
    if (onPublish) {
      await onPublish(article.id);
    }
  };

  const handleScheduleGeneration = async (scheduledAt: string) => {
    if (onScheduleGeneration) {
      await onScheduleGeneration(article.id, new Date(scheduledAt));
      setIsScheduling(false);
    }
  };

  const handleSchedulePublishing = async (scheduledAt: string) => {
    if (onSchedulePublishing) {
      await onSchedulePublishing(article.id, new Date(scheduledAt));
      setIsScheduling(false);
    }
  };

  // Determine what actions are available based on mode and status
  const canEdit = mode === 'planning' && (article.status === 'idea' || article.status === 'to_generate');
  const canDelete = mode === 'planning' && article.status === 'idea';
  const canGenerate = mode === 'planning' && article.status === 'to_generate';
  const canPublish = mode === 'publishing' && article.status === 'wait_for_publish';
  const isGenerating = article.status === 'generating';
  const isPublished = article.status === 'published';

  return (
    <Card 
      className={cn(
        "transition-all duration-200 hover:shadow-md cursor-pointer",
        {
          "border-blue-200 bg-blue-50": isGenerating,
          "border-green-200 bg-green-50": isPublished,
        },
        className
      )}
      onClick={handleCardClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          {isEditing ? (
            <input
              value={editData.title}
              onChange={(e) => setEditData({ ...editData, title: e.target.value })}
              className="font-medium text-sm bg-transparent border-none outline-none flex-1 min-w-0 focus:ring-1 focus:ring-blue-500 rounded px-1"
              placeholder="Article title..."
              disabled={isUpdating}
              autoFocus
            />
          ) : (
            <CardTitle className="font-medium text-sm line-clamp-2 flex-1 min-w-0">
              {article.title}
            </CardTitle>
          )}
          
          <div className="flex items-center gap-1 flex-shrink-0">
            {isEditing ? (
              <>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-6 w-6 p-0"
                  onClick={handleSave}
                  disabled={isUpdating || !editData.title.trim()}
                >
                  <Check className="h-3 w-3 text-green-600" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-6 w-6 p-0"
                  onClick={handleCancel}
                  disabled={isUpdating}
                >
                  <X className="h-3 w-3 text-gray-500" />
                </Button>
              </>
            ) : (
              <>
                {canEdit && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-6 w-6 p-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsEditing(true);
                    }}
                  >
                    <Edit3 className="h-3 w-3" />
                  </Button>
                )}
                {canDelete && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-6 w-6 p-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete();
                    }}
                  >
                    <Trash2 className="h-3 w-3 text-red-500" />
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        {/* Status indicator */}
        <StatusIndicator 
          status={article.status}
          isScheduled={!!article.generationScheduledAt}
          progress={article.generationProgress}
          estimatedCompletion={isGenerating && article.generationStartedAt ? "5 min" : undefined}
          className="mb-3"
        />

        {/* Planning mode specific content */}
        {mode === 'planning' && (
          <>
            {/* Generation actions */}
            {canGenerate && !isEditing && (
              <div className="mb-3 space-y-2">
                {/* Show scheduled time if exists */}
                {article.generationScheduledAt && (
                  <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    <span>Scheduled: {formatRelativeTime(article.generationScheduledAt)}</span>
                  </div>
                )}
                
                {/* Scheduling UI */}
                {isScheduling ? (
                  <div className="space-y-2">
                    <input
                      type="datetime-local"
                      className="w-full text-xs border border-gray-200 rounded p-2"
                      min={new Date().toISOString().slice(0, 16)}
                      onChange={(e) => {
                        if (e.target.value) {
                          handleScheduleGeneration(new Date(e.target.value).toISOString());
                        }
                      }}
                    />
                    <Button 
                      onClick={() => setIsScheduling(false)}
                      size="sm" 
                      variant="outline"
                      className="w-full text-xs h-7"
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <Button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleGenerate();
                      }}
                      size="sm" 
                      className="bg-green-600 hover:bg-green-700 text-white text-xs h-8"
                    >
                      <Play className="mr-1 h-3 w-3" />
                      Generate
                    </Button>
                    <Button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsScheduling(true);
                      }}
                      size="sm" 
                      variant="outline"
                      className="text-xs h-8"
                    >
                      <Calendar className="mr-1 h-3 w-3" />
                      Schedule
                    </Button>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Publishing mode specific content */}
        {mode === 'publishing' && (
          <>
            {/* Article metadata */}
            <div className="mb-3 space-y-1">
              {article.estimatedReadTime && (
                <div className="text-xs text-gray-600 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {article.estimatedReadTime} min read
                </div>
              )}
              
              {article.generationCompletedAt && (
                <div className="text-xs text-gray-600">
                  Generated: {formatRelativeTime(article.generationCompletedAt)}
                </div>
              )}

              {/* Analytics for published articles */}
              {isPublished && (article.views || article.clicks) && (
                <div className="flex gap-3 text-xs text-gray-600">
                  {article.views && (
                    <div className="flex items-center gap-1">
                      <Eye className="h-3 w-3" />
                      {article.views.toLocaleString()}
                    </div>
                  )}
                  {article.clicks && (
                    <div className="flex items-center gap-1">
                      <MousePointer className="h-3 w-3" />
                      {article.clicks.toLocaleString()}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Publishing actions */}
            {canPublish && !isEditing && (
              <div className="space-y-2">
                {/* Show scheduled publish time if exists */}
                {article.publishScheduledAt && (
                  <div className="text-xs text-green-600 bg-green-50 p-2 rounded flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    <span>Publish scheduled: {formatRelativeTime(article.publishScheduledAt)}</span>
                  </div>
                )}
                
                {/* Publishing UI */}
                {isScheduling ? (
                  <div className="space-y-2">
                    <input
                      type="datetime-local"
                      className="w-full text-xs border border-gray-200 rounded p-2"
                      min={new Date().toISOString().slice(0, 16)}
                      onChange={(e) => {
                        if (e.target.value) {
                          handleSchedulePublishing(new Date(e.target.value).toISOString());
                        }
                      }}
                    />
                    <Button 
                      onClick={() => setIsScheduling(false)}
                      size="sm" 
                      variant="outline"
                      className="w-full text-xs h-7"
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <Button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePublish();
                      }}
                      size="sm" 
                      className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-8"
                    >
                      <Check className="mr-1 h-3 w-3" />
                      Publish
                    </Button>
                    <Button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsScheduling(true);
                      }}
                      size="sm" 
                      variant="outline"
                      className="text-xs h-8"
                    >
                      <Calendar className="mr-1 h-3 w-3" />
                      Schedule
                    </Button>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Keywords display */}
        {article.keywords && article.keywords.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {article.keywords.slice(0, 3).map((keyword, index) => (
              <Badge key={index} variant="outline" className="text-xs">
                {typeof keyword === 'string' ? keyword : String(keyword)}
              </Badge>
            ))}
            {article.keywords.length > 3 && (
              <Badge variant="outline" className="text-xs">
                +{article.keywords.length - 3} more
              </Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}