'use client';

import { cn } from '@/lib/utils';
import { 
  Lightbulb, 
  Zap, 
  Clock, 
  CheckCircle, 
  Calendar,
  AlertCircle 
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { ArticleStatus } from '@/types';

interface StatusIndicatorProps {
  status: ArticleStatus;
  isScheduled?: boolean;
  progress?: number;
  estimatedCompletion?: string;
  className?: string;
}

export function StatusIndicator({ 
  status, 
  isScheduled = false, 
  progress, 
  estimatedCompletion,
  className 
}: StatusIndicatorProps) {
  const getStatusConfig = () => {
    switch (status) {
      case 'idea':
        return {
          icon: Lightbulb,
          label: 'Idea',
          color: 'bg-yellow-100 text-yellow-800',
          description: 'Ready to generate'
        };
      case 'to_generate':
        return {
          icon: isScheduled ? Calendar : Clock,
          label: isScheduled ? 'Scheduled' : 'Ready',
          color: isScheduled ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800',
          description: isScheduled ? 'Generation scheduled' : 'Ready to generate'
        };
      case 'generating':
        return {
          icon: Zap,
          label: 'Generating',
          color: 'bg-blue-100 text-blue-800',
          description: 'AI writing content'
        };
      case 'wait_for_publish':
        return {
          icon: CheckCircle,
          label: 'Ready to Publish',
          color: 'bg-green-100 text-green-800',
          description: 'Content generated successfully'
        };
      case 'published':
        return {
          icon: CheckCircle,
          label: 'Published',
          color: 'bg-gray-100 text-gray-800',
          description: 'Live on website'
        };
      default:
        return {
          icon: AlertCircle,
          label: 'Unknown',
          color: 'bg-red-100 text-red-800',
          description: 'Unknown status'
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  return (
    <div className={cn("space-y-2", className)}>
      <Badge 
        variant="secondary" 
        className={cn("flex items-center gap-1.5 w-fit", config.color)}
      >
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
      
      {status === 'generating' && typeof progress === 'number' && (
        <div className="space-y-1">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-in-out" 
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-600">
            <span>{progress}% complete</span>
            {estimatedCompletion && (
              <span>Est. {estimatedCompletion}</span>
            )}
          </div>
        </div>
      )}
      
      <p className="text-xs text-gray-500">{config.description}</p>
    </div>
  );
}

// Helper function to format relative time
export function formatRelativeTime(date: string | Date): string {
  const now = new Date();
  const targetDate = typeof date === 'string' ? new Date(date) : date;
  const diffMs = targetDate.getTime() - now.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMs < 0) {
    // Past time
    const absDiffMinutes = Math.abs(diffMinutes);
    const absDiffHours = Math.abs(diffHours);
    const absDiffDays = Math.abs(diffDays);
    
    if (absDiffMinutes < 60) {
      return `${absDiffMinutes} min ago`;
    } else if (absDiffHours < 24) {
      return `${absDiffHours}h ago`;
    } else {
      return `${absDiffDays}d ago`;
    }
  } else {
    // Future time
    if (diffMinutes < 60) {
      return `in ${diffMinutes} min`;
    } else if (diffHours < 24) {
      return `in ${diffHours}h`;
    } else {
      return `in ${diffDays}d`;
    }
  }
}