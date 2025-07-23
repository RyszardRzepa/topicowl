'use client';

import { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus, Calendar, Edit3, Check, X, Trash2, Play, CalendarClock } from 'lucide-react';

interface Article {
  id: number;
  title: string;
  description?: string;
  keywords: string[];
  targetAudience?: string;
  status: 'idea' | 'to_generate' | 'generating' | 'wait_for_publish' | 'published';
  scheduledAt?: string;
  generationScheduledAt?: string;
  publishedAt?: string;
  priority: 'low' | 'medium' | 'high';
  estimatedReadTime?: number;
  kanbanPosition: number;
  createdAt: string;
  updatedAt: string;
}

interface KanbanColumn {
  id: string;
  title: string;
  status: 'idea' | 'to_generate' | 'generating' | 'wait_for_publish' | 'published';
  articles: Article[];
  color: string;
}

interface KanbanBoardProps {
  className?: string;
}

export function KanbanBoard({ className: _className }: KanbanBoardProps) {
  const [columns, setColumns] = useState<KanbanColumn[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchKanbanBoard = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/kanban/board');
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

  const updateArticle = async (articleId: number, updates: Partial<Article>) => {
    try {
      const response = await fetch(`/api/kanban/articles/${articleId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error('Failed to update article');
      }

      // Refresh the board to get updated data
      await fetchKanbanBoard();
    } catch (error) {
      console.error('Failed to update article:', error);
      setError('Failed to update article');
    }
  };

  const deleteArticle = async (articleId: number) => {
    try {
      const response = await fetch(`/api/kanban/articles/${articleId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete article');
      }

      // Refresh the board to get updated data
      await fetchKanbanBoard();
    } catch (error) {
      console.error('Failed to delete article:', error);
      setError('Failed to delete article');
    }
  };

  const generateArticle = async (articleId: number) => {
    try {
      const response = await fetch(`/api/articles/${articleId}/generate`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to start article generation');
      }

      // Refresh the board to show the generating status
      await fetchKanbanBoard();
    } catch (error) {
      console.error('Failed to generate article:', error);
      setError('Failed to generate article');
    }
  };

  const scheduleGeneration = async (articleId: number, scheduledAt: string) => {
    try {
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

      // Refresh the board to show the updated schedule
      await fetchKanbanBoard();
    } catch (error) {
      console.error('Failed to schedule generation:', error);
      setError('Failed to schedule generation');
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

      const response = await fetch('/api/kanban/move-article', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ articleId, newStatus, newPosition }),
      });

      if (!response.ok) {
        throw new Error('Failed to move article');
      }

      // Only refresh if status changed to 'generating' to get real-time updates
      if (newStatus === 'to_generate') {
        setTimeout(() => {
          fetchKanbanBoard().catch(console.error);
        }, 1000); // Give the backend time to process
      }
    } catch (error) {
      console.error('Failed to move article:', error);
      setError('Failed to move article');
      // Revert optimistic update on error
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

    const articleId = parseInt(draggableId);
    const newStatus = destination.droppableId as Article['status'];
    
    void moveArticle(articleId, newStatus, destination.index);
  };

  const createNewArticle = async () => {
    try {
      const response = await fetch('/api/kanban/articles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: 'New Article Idea',
          description: 'Click to edit this article idea',
          keywords: ['article', 'content'], // Provide default keywords
          priority: 'medium',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create article');
      }

      await fetchKanbanBoard();
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
        <h2 className="text-2xl font-bold">Article Pipeline</h2>
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
                      >
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className={`mb-3 min-w-0 ${
                              snapshot.isDragging ? 'rotate-2' : ''
                            }`}
                          >
                            <ArticleCard 
                              article={article} 
                              onUpdate={updateArticle}
                              onDelete={deleteArticle}
                              onGenerate={generateArticle}
                              onScheduleGeneration={scheduleGeneration}
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
  onScheduleGeneration
}: { 
  article: Article;
  onUpdate: (articleId: number, updates: Partial<Article>) => Promise<void>;
  onDelete: (articleId: number) => Promise<void>;
  onGenerate: (articleId: number) => Promise<void>;
  onScheduleGeneration: (articleId: number, scheduledAt: string) => Promise<void>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [isScheduling, setIsScheduling] = useState(false);
  const [editData, setEditData] = useState({
    title: article.title,
  });
  const [isUpdating, setIsUpdating] = useState(false);

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
    try {
      await onGenerate(article.id);
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

  const formatScheduledTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  return (
    <Card className="cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow w-full overflow-hidden">
      <CardHeader className="pb-2 p-3">
        <div className="flex items-start justify-between gap-2 min-w-0">
          {isEditing ? (
            <input
              value={editData.title}
              onChange={(e) => setEditData({ ...editData, title: e.target.value })}
              className="font-medium text-sm bg-transparent border-none outline-none flex-1 min-w-0"
              placeholder="Article title..."
              disabled={isUpdating}
            />
          ) : (
            <CardTitle 
              className="font-medium text-sm line-clamp-2 cursor-pointer hover:text-blue-600 flex-1 min-w-0" 
              onClick={() => setIsEditing(true)}
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
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-6 w-6 p-0 flex-shrink-0"
                  onClick={() => setIsEditing(true)}
                >
                  <Edit3 className="h-3 w-3" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-6 w-6 p-0 flex-shrink-0"
                  onClick={handleDelete}
                >
                  <Trash2 className="h-3 w-3 text-red-500" />
                </Button>
              </>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0 p-3">
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

            {article.status === 'generating' && (
              <div className="mt-2">
                <div className="w-full bg-gray-200 rounded-full h-1">
                  <div className="bg-blue-600 h-1 rounded-full animate-pulse" style={{ width: '60%' }} />
                </div>
                <p className="text-xs text-gray-500 mt-1">Generating content...</p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}