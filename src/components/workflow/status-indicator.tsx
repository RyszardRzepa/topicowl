'use client';

import { cn } from '@/lib/utils';
import { 
  Lightbulb, 
  Zap, 
  Clock, 
  CheckCircle, 
  Calendar,
  AlertCircle,
  Search,
  PenTool,
  CheckSquare,
  Target
} from 'lucide-react';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { ArticleStatus } from '@/types';

type GenerationPhase = 'research' | 'writing' | 'validation' | 'optimization';

interface StatusIndicatorProps {
  status: ArticleStatus;
  isScheduled?: boolean;
  progress?: number;
  phase?: GenerationPhase;
  estimatedCompletion?: string;
  error?: string;
  className?: string;
}

export function StatusIndicator({ 
  status, 
  isScheduled = false, 
  progress, 
  phase,
  estimatedCompletion,
  error,
  className 
}: StatusIndicatorProps) {
  const getPhaseConfig = (currentPhase: GenerationPhase) => {
    switch (currentPhase) {
      case 'research':
        return {
          icon: Search,
          label: 'Researching',
          color: 'text-brand-green',
          description: 'Gathering information and sources'
        };
      case 'writing':
        return {
          icon: PenTool,
          label: 'Writing',
          color: 'text-brand-green',
          description: 'Creating content'
        };
      case 'validation':
        return {
          icon: CheckSquare,
          label: 'Validating',
          color: 'text-brand-orange',
          description: 'Fact-checking and reviewing'
        };
      case 'optimization':
        return {
          icon: Target,
          label: 'Optimizing',
          color: 'text-brand-orange',
          description: 'SEO optimization and final touches'
        };
    }
  };

  const getStatusConfig = () => {
    switch (status) {
      case 'idea':
        return {
          icon: Lightbulb,
          label: 'Idea',
          badgeVariant: 'orange' as const,
          description: 'Ready to generate'
        };
      case 'to_generate':
        return {
          icon: isScheduled ? Calendar : Clock,
          label: isScheduled ? 'Scheduled' : 'Ready',
          badgeVariant: isScheduled ? 'green' : 'orange',
          description: isScheduled ? 'Generation scheduled' : 'Ready to generate'
        };
      case 'generating':
        return {
          icon: Zap,
          label: phase ? getPhaseConfig(phase).label : 'Generating',
          badgeVariant: 'green' as const,
          description: phase ? getPhaseConfig(phase).description : 'AI writing content'
        };
      case 'wait_for_publish':
        return {
          icon: CheckCircle,
          label: 'Ready to Publish',
          badgeVariant: 'green' as const,
          description: 'Content generated successfully'
        };
      case 'published':
        return {
          icon: CheckCircle,
          label: 'Published',
          badgeVariant: 'default' as const,
          description: 'Live on website'
        };
      default:
        return {
          icon: AlertCircle,
          label: 'Unknown',
          badgeVariant: 'red' as const,
          description: 'Unknown status'
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  return (
    <div className={cn("space-y-2", className)}>
      <Badge 
        variant={config.badgeVariant as 'default' | 'secondary' | 'outline' | 'gray' | 'brown' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple' | 'pink' | 'red'}
        className={cn(
          "flex items-center gap-1.5 w-fit", 
          status === 'generating' && "animate-pulse"
        )}
      >
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
      
      {/* Error display */}
      {error && (
        <Alert variant="destructive" className="text-xs">
          <AlertCircle className="h-3 w-3" />
          <AlertDescription>
            <div className="font-medium mb-1">Generation Failed</div>
            <p>{error}</p>
          </AlertDescription>
        </Alert>
      )}
      
      {/* Progress display for generating articles */}
      {status === 'generating' && typeof progress === 'number' && !error && (
        <div className="space-y-1">
          <Progress 
            value={progress} 
            className="h-2 bg-brand-white/20 [&>div]:bg-brand-green" 
          />
          <div className="flex justify-between text-xs text-brand-white/70">
            <span>{progress}% complete</span>
            {estimatedCompletion && (
              <span>Est. {estimatedCompletion}</span>
            )}
          </div>
          
          {/* Phase indicator */}
          {phase && (
            <div className="flex items-center gap-1 text-xs mt-1">
              <div className={cn("flex items-center gap-1", getPhaseConfig(phase).color)}>
                {(() => {
                  const PhaseIcon = getPhaseConfig(phase).icon;
                  return <PhaseIcon className="h-3 w-3" />;
                })()}
                <span className="font-medium">{getPhaseConfig(phase).description}</span>
              </div>
            </div>
          )}
        </div>
      )}
      
      <p className="text-xs text-brand-white/60">{config.description}</p>
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