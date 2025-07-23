'use client';

import { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus, Calendar, Clock, Target, MoreHorizontal } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Article {
  id: number;
  title: string;
  description?: string;
  keywords: string[];
  targetAudience?: string;
  status: 'idea' | 'to_generate' | 'generating' | 'wait_for_publish' | 'published';
  scheduledAt?: string;
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

export function KanbanBoard({ className }: KanbanBoardProps) {
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
      const data = await response.json();
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
    fetchKanbanBoard();
  }, []);

  const moveArticle = async (articleId: number, newStatus: string, newPosition: number) => {
    try {
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

      // Refresh the board after successful move
      await fetchKanbanBoard();
    } catch (error) {
      console.error('Failed to move article:', error);
      setError('Failed to move article');
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
    
    moveArticle(articleId, newStatus, destination.index);
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
          keywords: [],
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          {columns.map((column) => (
            <div key={column.id} className="flex flex-col">
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-lg">{column.title}</h3>
                  <Badge variant="secondary">{column.articles.length}</Badge>
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
                    className={`flex-1 min-h-[200px] p-2 rounded-lg transition-colors ${
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
                            className={`mb-3 ${
                              snapshot.isDragging ? 'rotate-2' : ''
                            }`}
                          >
                            <ArticleCard article={article} />
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

function ArticleCard({ article }: { article: Article }) {
  const getPriorityColor = (priority: Article['priority']) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = () => {
    switch (article.status) {
      case 'generating':
        return <Clock className="h-4 w-4 animate-spin" />;
      case 'wait_for_publish':
        return <Calendar className="h-4 w-4" />;
      case 'published':
        return <Target className="h-4 w-4" />;
      default:
        return null;
    }
  };

  return (
    <Card className="cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <CardTitle className="font-medium text-sm line-clamp-2">{article.title}</CardTitle>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
            <MoreHorizontal className="h-3 w-3" />
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        {article.description && (
          <p className="text-xs text-gray-600 mb-3 line-clamp-2">
            {article.description}
          </p>
        )}

        <div className="flex flex-wrap gap-1 mb-3">
          {article.keywords.slice(0, 3).map((keyword) => (
            <Badge key={keyword} variant="outline" className="text-xs">
              {keyword}
            </Badge>
          ))}
          {article.keywords.length > 3 && (
            <Badge variant="outline" className="text-xs">
              +{article.keywords.length - 3}
            </Badge>
          )}
        </div>

        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            {getStatusIcon()}
            <Badge className={getPriorityColor(article.priority)}>
              {article.priority}
            </Badge>
          </div>
          
          <span className="text-gray-500">
            {formatDistanceToNow(new Date(article.createdAt), { addSuffix: true })}
          </span>
        </div>

        {article.scheduledAt && (
          <div className="mt-2 text-xs text-blue-600 flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            Scheduled: {new Date(article.scheduledAt).toLocaleDateString()}
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
      </CardContent>
    </Card>
  );
}