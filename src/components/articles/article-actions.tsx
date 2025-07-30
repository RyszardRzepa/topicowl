'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Edit, RefreshCw, Calendar, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

// Import colocated types from API routes for type safety
import type { ArticleGenerationRequest } from '@/app/api/articles/generate/route';
import type { ArticleScheduleRequest } from '@/app/api/articles/[id]/schedule/route';
import type { ArticleDetailResponse } from '@/app/api/articles/[id]/route';

interface ArticleActionsProps {
  article: ArticleDetailResponse['data'];
  onEdit: () => void;
  onStatusChange?: (newStatus: string) => void;
  className?: string;
}

export function ArticleActions({ 
  article, 
  onEdit, 
  onStatusChange,
  className = '' 
}: ArticleActionsProps) {
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isScheduling, setIsScheduling] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [scheduledDate, setScheduledDate] = useState('');
  const router = useRouter();

  const handleRegenerate = async () => {
    if (!confirm('Are you sure you want to regenerate this article? This will overwrite the current content.')) {
      return;
    }

    setIsRegenerating(true);
    try {
      const response = await fetch(`/api/articles/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          articleId: article.id.toString(),
          forceRegenerate: true,
        } as ArticleGenerationRequest),
      });

      const result = await response.json() as { success: boolean; error?: string };
      
      if (result.success) {
        onStatusChange?.('generating');
        toast.success('Article regeneration started successfully!');
      } else {
        throw new Error(result.error ?? 'Failed to regenerate article');
      }
    } catch (error) {
      console.error('Regeneration error:', error);
      toast.error('Failed to regenerate article. Please try again.');
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleSchedule = async () => {
    if (!scheduledDate) {
      toast.error('Please select a date and time for scheduling.');
      return;
    }

    setIsScheduling(true);
    try {
      const response = await fetch(`/api/articles/${article.id}/schedule`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          scheduledAt: scheduledDate,
          status: 'wait_for_publish',
        } as ArticleScheduleRequest),
      });

      const result = await response.json() as { success: boolean; error?: string };
      
      if (result.success) {
        onStatusChange?.('wait_for_publish');
        setShowScheduleDialog(false);
        setScheduledDate('');
        toast.success('Article scheduled successfully!');
      } else {
        throw new Error(result.error ?? 'Failed to schedule article');
      }
    } catch (error) {
      console.error('Scheduling error:', error);
      toast.error('Failed to schedule article. Please try again.');
    } finally {
      setIsScheduling(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/articles/${article.id}`, {
        method: 'DELETE',
      });

      const result = await response.json() as { success: boolean; error?: string };
      
      if (result.success) {
        toast.success('Article deleted successfully!');
        // Navigate back to kanban board
        router.push('/');
      } else {
        throw new Error(result.error ?? 'Failed to delete article');
      }
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Failed to delete article. Please try again.');
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const canEdit = article.status !== 'generating';
  const canRegenerate = article.status !== 'generating';
  const canSchedule = article.status === 'wait_for_publish' || (article.draft && article.status !== 'generating');

  return (
    <>
      <div className={`flex flex-wrap gap-2 ${className}`}>
        <Button
          onClick={onEdit}
          disabled={!canEdit}
          variant="outline"
          size="sm"
          className="flex items-center gap-2"
        >
          <Edit className="h-4 w-4" />
          Edit
        </Button>

        <Button
          onClick={handleRegenerate}
          disabled={!canRegenerate || isRegenerating}
          variant="outline"
          size="sm"
          className="flex items-center gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${isRegenerating ? 'animate-spin' : ''}`} />
          {isRegenerating ? 'Regenerating...' : 'Regenerate'}
        </Button>

        <Button
          onClick={() => setShowScheduleDialog(true)}
          disabled={!canSchedule || isScheduling}
          variant="outline"
          size="sm"
          className="flex items-center gap-2"
        >
          <Calendar className="h-4 w-4" />
          Schedule
        </Button>

        <Button
          onClick={() => setShowDeleteConfirm(true)}
          disabled={isDeleting}
          variant="destructive"
          size="sm"
          className="flex items-center gap-2"
        >
          <Trash2 className="h-4 w-4" />
          {isDeleting ? 'Deleting...' : 'Delete'}
        </Button>
      </div>

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-notion border border-stone-200 p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-stone-700 mb-4">
              Delete Article
            </h3>
            <p className="text-stone-600 mb-6">
              Are you sure you want to delete &ldquo;{article.title}&rdquo;? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <Button
                onClick={() => setShowDeleteConfirm(false)}
                variant="outline"
                size="sm"
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                onClick={handleDelete}
                variant="destructive"
                size="sm"
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Dialog */}
      {showScheduleDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-notion border border-stone-200 p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-stone-700 mb-4">
              Schedule Article
            </h3>
            <div className="mb-6">
              <label htmlFor="scheduledDate" className="block text-sm font-medium text-stone-700 mb-2">
                Publication Date & Time
              </label>
              <input
                id="scheduledDate"
                type="datetime-local"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="w-full px-3 py-2 border border-stone-200 rounded-notion focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                min={new Date().toISOString().slice(0, 16)}
              />
            </div>
            <div className="flex gap-3 justify-end">
              <Button
                onClick={() => {
                  setShowScheduleDialog(false);
                  setScheduledDate('');
                }}
                variant="outline"
                size="sm"
                disabled={isScheduling}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSchedule}
                variant="default"
                size="sm"
                disabled={isScheduling || !scheduledDate}
              >
                {isScheduling ? 'Scheduling...' : 'Schedule'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}