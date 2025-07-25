'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus, Calendar, Edit3, Check, X, Trash2, Play, CalendarClock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ArticleStatus } from '@/types';

// Inline kanban flow logic
const STATUS_FLOW: Record<ArticleStatus, ArticleStatus[]> = {
  idea: ['to_generate'],
  to_generate: ['generating'], // Only through generate button, not drag
  generating: ['wait_for_publish'], // Automatically moved by system after generation
  wait_for_publish: ['published'],
  published: [], // Cannot be moved
};

const isValidStatusTransition = (from: ArticleStatus, to: ArticleStatus): boolean => {
  return STATUS_FLOW[from].includes(to);
};

const isDraggable = (status: ArticleStatus): boolean => {
  // Only allow dragging for idea and wait_for_publish status
  return status === 'idea' || status === 'wait_for_publish';
};

// Example: Import API types from their colocated routes when needed
// import type { CreateArticleRequest } from '@/app/api/articles/route';
// import type { MoveArticleRequest } from '@/app/api/articles/move/route';
import type { KanbanColumn } from '@/app/api/articles/board/route';
import type { articles } from "@/server/db/schema";

type Article = typeof articles.$inferSelect;

interface KanbanBoardProps {
  className?: string;
}

export function KanbanBoard({ className: _className }: KanbanBoardProps) {
  const router = useRouter();
  const [columns, setColumns] = useState<KanbanColumn[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchKanbanBoard = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/articles/board');
      if (!response.ok) {
        throw new Error('Failed to fetch kanban board');
      }
      const data = await response.json() as KanbanColumn[];
      setColumns(data);
      setError(null);
    } catch (error) {
      console.error('Failed to load kanban board:', error);
      setError('Failed to load kanban board');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchKanbanBoard();
  }, []);

  // Refresh kanban board when returning from article preview
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // Page became visible again, check for status changes and refresh
        const statusChange = sessionStorage.getItem('articleStatusChanged');
        if (statusChange) {
          sessionStorage.removeItem('articleStatusChanged');
          void fetchKanbanBoard();
        }
      }
    };

    const handleFocus = () => {
      // Window gained focus, check for status changes and refresh
      const statusChange = sessionStorage.getItem('articleStatusChanged');
      if (statusChange) {
        sessionStorage.removeItem('articleStatusChanged');
        void fetchKanbanBoard();
      }
    };

    const handleStorageChange = (e: StorageEvent) => {
      // Listen for storage changes from other tabs/windows
      if (e.key === 'articleStatusChanged' && e.newValue) {
        void fetchKanbanBoard();
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

  const updateArticle = async (articleId: number, updates: Partial<Article>) => {
    try {
      // Optimistic update - update UI immediately
      const updatedColumns = columns.map(column => ({
        ...column,
        articles: column.articles.map(article => 
          article.id === articleId 
            ? { ...article, ...updates }
            : article
        )
      }));
      
      setColumns(updatedColumns);

      const response = await fetch(`/api/articles/${articleId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error('Failed to update article');
      }

      // No refresh needed - optimistic update is sufficient
    } catch (error) {
      console.error('Failed to update article:', error);
      setError('Failed to update article');
      // Revert optimistic update on error by fetching fresh data
      await fetchKanbanBoard();
    }
  };

  const deleteArticle = async (articleId: number) => {
    try {
      // Optimistic update - remove article from UI immediately
      const updatedColumns = columns.map(column => ({
        ...column,
        articles: column.articles.filter(article => article.id !== articleId)
      }));
      
      setColumns(updatedColumns);

      const response = await fetch(`/api/articles/${articleId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete article');
      }

      // No refresh needed - optimistic update is sufficient
    } catch (error) {
      console.error('Failed to delete article:', error);
      setError('Failed to delete article');
      // Revert optimistic update on error by fetching fresh data
      await fetchKanbanBoard();
    }
  };

  const generateArticle = async (articleId: number) => {
    console.log('generateArticle called with ID:', articleId);
    try {
      // Optimistic update - move article to generating status immediately
      const updatedColumns = columns.map(column => {
        const filteredArticles = column.articles.filter(article => article.id !== articleId);
        
        if (column.status === 'generating') {
          // Add article to generating column
          const articleToMove = columns
            .flatMap(col => col.articles)
            .find(article => article.id === articleId);
          
          if (articleToMove) {
            const updatedArticle = {
              ...articleToMove,
              status: 'generating' as const,
              kanbanPosition: column.articles.length // Add to end of generating column
            };
            
            filteredArticles.push(updatedArticle);
          }
        }
        
        return {
          ...column,
          articles: filteredArticles
        };
      });
      
      setColumns(updatedColumns);

      const response = await fetch(`/api/articles/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          articleId: articleId.toString(),
        }),
      });

      console.log('Generate API response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Generate API error response:', errorText);
        throw new Error('Failed to start article generation');
      }

      const responseData = await response.json() as unknown;
      console.log('Generate API response data:', responseData);

      // No refresh needed - optimistic update is sufficient
      // The server will handle the actual generation process
    } catch (error) {
      console.error('Failed to generate article:', error);
      setError('Failed to generate article');
      // Revert optimistic update on error by fetching fresh data
      await fetchKanbanBoard();
    }
  };

  const scheduleGeneration = async (articleId: number, scheduledAt: string) => {
    try {
      // Optimistic update - update the scheduled time immediately
      const updatedColumns = columns.map(column => ({
        ...column,
        articles: column.articles.map(article => 
          article.id === articleId 
            ? { ...article, generationScheduledAt: new Date(scheduledAt) }
            : article
        )
      }));
      
      setColumns(updatedColumns);

      const response = await fetch('/api/articles/schedule-generation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          articleId,
          generationScheduledAt: scheduledAt,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to schedule article generation');
      }

      // No refresh needed - optimistic update is sufficient
    } catch (error) {
      console.error('Failed to schedule generation:', error);
      setError('Failed to schedule generation');
      // Revert optimistic update on error by fetching fresh data
      await fetchKanbanBoard();
    }
  };

  const moveArticle = async (articleId: number, newStatus: string, newPosition: number) => {
    try {
      // Optimistic update - update UI immediately
      const updatedColumns = columns.map(column => {
        // Remove article from source column
        const filteredArticles = column.articles.filter(article => article.id !== articleId);
        
        if (column.status === newStatus) {
          // Add article to destination column
          const articleToMove = columns
            .flatMap(col => col.articles)
            .find(article => article.id === articleId);
          
          if (articleToMove) {
            const updatedArticle = {
              ...articleToMove,
              status: newStatus,
              kanbanPosition: newPosition
            };
            
            // Insert at correct position
            filteredArticles.splice(newPosition, 0, updatedArticle);
          }
        }
        
        return {
          ...column,
          articles: filteredArticles
        };
      });
      
      setColumns(updatedColumns);

      const response = await fetch('/api/articles/move', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ articleId, newStatus, newPosition }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to move article' })) as { error?: string };
        throw new Error(errorData.error ?? 'Failed to move article');
      }

      // No refresh needed - optimistic update is sufficient
      // The server handles the position updates and the UI is already updated
    } catch (error) {
      console.error('Failed to move article:', error);
      setError('Failed to move article');
      // Revert optimistic update on error by fetching fresh data
      await fetchKanbanBoard();
    }
  };

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination || !columns) return;

    const { source, destination, draggableId } = result;
    
    // If dropped in the same position, do nothing
    if (source.droppableId === destination.droppableId && source.index === destination.index) {
      return;
    }

    // Get source article to validate transition
    const sourceColumn = columns.find(col => col.status === source.droppableId);
    const article = sourceColumn?.articles[source.index];
    
    if (!article) return;

    const newStatus = destination.droppableId as ArticleStatus;
    
    // Validate status transition
    if (!isValidStatusTransition(article.status as ArticleStatus, newStatus)) {
      setError('Invalid move. Articles can only move forward in the workflow: Ideas → To Generate → Wait for Publish → Published');
      return;
    }

    const articleId = parseInt(draggableId);
    
    void moveArticle(articleId, newStatus, destination.index);
  };

  const createNewArticle = async () => {
    try {
      const response = await fetch('/api/articles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: 'New Article Idea',
          description: 'Click to edit this article idea',
          keywords: ['article', 'content'], // Provide default keywords
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create article');
      }

      const newArticle = await response.json() as Article;
      
      // Optimistic update - add the new article to the ideas column
      const updatedColumns = columns.map(column => {
        if (column.status === 'idea') {
          return {
            ...column,
            articles: [...column.articles, newArticle]
          };
        }
        return column;
      });
      
      setColumns(updatedColumns);
    } catch (error) {
      console.error('Failed to create article:', error);
      setError('Failed to create article');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading kanban board...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <Button onClick={fetchKanbanBoard}>Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Article Pipeline</h2>
          <p className="text-sm text-gray-600 mt-1">
            Drag articles forward through the workflow: Ideas → To Generate → Generating → Wait for Publish → Published
          </p>
        </div>
        <Button onClick={createNewArticle}>
          <Plus className="mr-2 h-4 w-4" />
          New Article Idea
        </Button>
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 min-h-0">
          {columns.map((column) => (
            <div key={column.id} className="flex flex-col min-w-0">
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-lg truncate">{column.title}</h3>
                  <Badge variant="secondary" className="flex-shrink-0">{column.articles.length}</Badge>
                </div>
                <div 
                  className="h-1 rounded-full"
                  style={{ backgroundColor: column.color }}
                />
              </div>

              <Droppable droppableId={column.status}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`flex-1 min-h-[200px] p-2 rounded-lg transition-colors overflow-hidden ${
                      snapshot.isDraggingOver ? 'bg-gray-100' : 'bg-gray-50'
                    }`}
                  >
                    {column.articles.map((article, index) => (
                      <Draggable
                        key={article.id}
                        draggableId={article.id.toString()}
                        index={index}
                        isDragDisabled={!isDraggable(article.status as ArticleStatus)}
                      >
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className={cn(
                              "mb-3 min-w-0",
                              {
                                "rotate-2": snapshot.isDragging,
                                "opacity-50": snapshot.isDragging,
                              }
                            )}
                          >
                            <ArticleCard 
                              article={article} 
                              onUpdate={updateArticle}
                              onDelete={deleteArticle}
                              onGenerate={generateArticle}
                              onScheduleGeneration={scheduleGeneration}
                              onNavigate={(articleId) => router.push(`/articles/${articleId}`)}
                            />
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          ))}
        </div>
      </DragDropContext>
    </div>
  );
}

function ArticleCard({ 
  article, 
  onUpdate, 
  onDelete,
  onGenerate,
  onScheduleGeneration,
  onNavigate
}: { 
  article: Article;
  onUpdate: (articleId: number, updates: Partial<Article>) => Promise<void>;
  onDelete: (articleId: number) => Promise<void>;
  onGenerate: (articleId: number) => Promise<void>;
  onScheduleGeneration: (articleId: number, scheduledAt: string) => Promise<void>;
  onNavigate: (articleId: number) => void;
}) {
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
    const isButton = target.closest('button');
    const isInput = target.closest('input');
    const isLink = target.closest('a');
    
    // Only navigate if clicking on the card itself, not on interactive elements
    if (!isButton && !isInput && !isLink) {
      e.preventDefault();
      onNavigate(article.id);
    }
  };

  const handleSave = async () => {
    if (!editData.title.trim()) {
      return;
    }

    setIsUpdating(true);
    try {
      await onUpdate(article.id, {
        title: editData.title.trim(),
      });
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to update article:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancel = () => {
    setEditData({
      title: article.title,
    });
    setIsEditing(false);
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this article?')) {
      try {
        await onDelete(article.id);
      } catch (error) {
        console.error('Failed to delete article:', error);
      }
    }
  };

  const handleGenerate = async () => {
    console.log('Generate button clicked for article:', article.id);
    try {
      await onGenerate(article.id);
      console.log('Generate API call completed for article:', article.id);
    } catch (error) {
      console.error('Failed to generate article:', error);
    }
  };

  const handleScheduleGeneration = async (scheduledAt: string) => {
    try {
      await onScheduleGeneration(article.id, scheduledAt);
      setIsScheduling(false);
    } catch (error) {
      console.error('Failed to schedule generation:', error);
    }
  };

  const formatScheduledTime = (dateValue: string | Date | null) => {
    if (!dateValue) return '';
    const date = typeof dateValue === 'string' ? new Date(dateValue) : dateValue;
    return date.toLocaleString();
  };

  // Determine card interactivity based on status
  const isInteractive = article.status === 'idea' || article.status === 'to_generate';
  const isGenerating = article.status === 'generating';
  const isCompleted = article.status === 'published';
  const canEdit = article.status === 'idea' || article.status === 'to_generate';

  return (
    <Card 
      className={cn(
        "cursor-grab active:cursor-grabbing hover:shadow-md transition-all duration-200 w-full overflow-hidden",
        {
          "opacity-75 cursor-not-allowed": !isInteractive,
          "border-blue-500 bg-blue-50": isGenerating,
          "border-green-500 bg-green-50": isCompleted,
          "cursor-not-allowed": !isDraggable(article.status as ArticleStatus),
          "hover:cursor-pointer hover:shadow-lg hover:border-gray-300": !isEditing && !isScheduling,
        }
      )}
      onClick={handleCardClick}
      title="Click to view article details"
    >
      <CardHeader className="pb-2 p-3">
        <div className="flex items-start justify-between gap-2 min-w-0">
          {/* Status badge for non-idea articles */}
          {article.status !== 'idea' && (
            <Badge 
              variant="secondary" 
              className={cn(
                "text-xs mr-2 flex-shrink-0",
                {
                  "bg-yellow-100 text-yellow-800": article.status === 'to_generate',
                  "bg-blue-100 text-blue-800": article.status === 'generating',
                  "bg-purple-100 text-purple-800": article.status === 'wait_for_publish',
                  "bg-green-100 text-green-800": article.status === 'published',
                }
              )}
            >
              {article.status === 'to_generate' && 'Ready'}
              {article.status === 'generating' && 'Generating'}
              {article.status === 'wait_for_publish' && 'Waiting'}
              {article.status === 'published' && 'Published'}
            </Badge>
          )}

          {isEditing ? (
            <input
              value={editData.title}
              onChange={(e) => setEditData({ ...editData, title: e.target.value })}
              className="font-medium text-sm bg-transparent border-none outline-none flex-1 min-w-0"
              placeholder="Article title..."
              disabled={isUpdating || !canEdit}
            />
          ) : (
            <CardTitle 
              className={cn(
                "font-medium text-sm line-clamp-2 flex-1 min-w-0 transition-colors",
                canEdit ? "cursor-pointer hover:text-blue-600" : "cursor-default hover:text-gray-700"
              )}
              onClick={(e) => {
                if (canEdit) {
                  e.stopPropagation();
                  setIsEditing(true);
                }
              }}
            >
              {article.title}
            </CardTitle>
          )}
          
          <div className="flex items-center gap-1 flex-shrink-0">
            {isEditing ? (
              <>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-6 w-6 p-0 flex-shrink-0"
                  onClick={handleSave}
                  disabled={isUpdating || !editData.title.trim()}
                >
                  <Check className="h-3 w-3 text-green-600" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-6 w-6 p-0 flex-shrink-0"
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
                    className="h-6 w-6 p-0 flex-shrink-0"
                    onClick={() => setIsEditing(true)}
                  >
                    <Edit3 className="h-3 w-3" />
                  </Button>
                )}
                {canEdit && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-6 w-6 p-0 flex-shrink-0"
                    onClick={handleDelete}
                  >
                    <Trash2 className="h-3 w-3 text-red-500" />
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0 p-3">
        {/* Status indicator for generating articles */}
        {isGenerating && (
          <div className="mb-3">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-blue-600 h-2 rounded-full animate-pulse" style={{ width: '60%' }} />
            </div>
            <p className="text-xs text-blue-600 mt-1 font-medium">Generating content...</p>
          </div>
        )}

        {/* Show completion indicator for published articles */}
        {isCompleted && (
          <div className="mb-3">
            <div className="text-xs text-green-600 bg-green-50 p-2 rounded font-medium">
              ✓ Published successfully
            </div>
          </div>
        )}

        {article.status === 'to_generate' && !isEditing && (
          <div className="mb-3 space-y-2">
            {/* Show scheduled time if exists */}
            {article.generationScheduledAt && (
              <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded flex items-center gap-1">
                <CalendarClock className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">Generation scheduled: {formatScheduledTime(article.generationScheduledAt)}</span>
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
                      void handleScheduleGeneration(new Date(e.target.value).toISOString());
                    }
                  }}
                />
                <div className="flex gap-1">
                  <Button 
                    onClick={() => setIsScheduling(false)}
                    size="sm" 
                    variant="outline"
                    className="flex-1 text-xs h-7"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-1">
                <Button 
                  onClick={handleGenerate}
                  size="sm" 
                  className="bg-green-600 hover:bg-green-700 text-white text-xs h-7 px-2"
                >
                  <Play className="mr-1 h-3 w-3 flex-shrink-0" />
                  <span className="truncate">Generate</span>
                </Button>
                <Button 
                  onClick={() => setIsScheduling(true)}
                  size="sm" 
                  variant="outline"
                  className="text-xs h-7 px-2"
                >
                  <CalendarClock className="mr-1 h-3 w-3 flex-shrink-0" />
                  <span className="truncate">Schedule</span>
                </Button>
              </div>
            )}
          </div>
        )}
        
        {isEditing ? (
          <div className="space-y-3">
            {/* Only keeping title editing, removed description, keywords, and target audience */}
          </div>
        ) : (
          <>
            {article.scheduledAt && (
              <div className="text-xs text-blue-600 flex items-center gap-1">
                <Calendar className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">Scheduled: {new Date(article.scheduledAt).toLocaleDateString()}</span>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}