'use client';

import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription 
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { AlertCircle, CheckCircle, Clock, Loader2 } from "lucide-react";
import type { GenerationStatus } from '@/app/api/articles/[id]/generation-status/route';

interface GenerationProgressProps {
  status: GenerationStatus;
  className?: string;
}

export function GenerationProgress({ status, className }: GenerationProgressProps) {
  const getStatusIcon = () => {
    switch (status.status) {
      case 'pending':
        return <Clock className="h-5 w-5 text-gray-500" />;
      case 'researching':
      case 'writing':
      case 'validating':
      case 'updating':
        return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />;
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'failed':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Clock className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusColor = () => {
    switch (status.status) {
      case 'pending':
        return 'text-gray-600';
      case 'researching':
      case 'writing':
      case 'validating':
      case 'updating':
        return 'text-blue-600';
      case 'completed':
        return 'text-green-600';
      case 'failed':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const getStatusText = () => {
    switch (status.status) {
      case 'pending':
        return 'Pending';
      case 'researching':
        return 'Researching';
      case 'writing':
        return 'Writing';
      case 'validating':
        return 'Validating';
      case 'updating':
        return 'Updating';
      case 'completed':
        return 'Completed';
      case 'failed':
        return 'Failed';
      default:
        return 'Unknown';
    }
  };

  const formatTime = (dateString: string) => {
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(new Date(dateString));
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {getStatusIcon()}
          Generation Progress
        </CardTitle>
        <CardDescription>
          Track the progress of your article generation
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status and Progress */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className={`font-medium ${getStatusColor()}`}>
              {getStatusText()}
            </span>
            <span className="text-sm text-gray-500">
              {status.progress}%
            </span>
          </div>
          <Progress value={status.progress} className="w-full" />
        </div>

        {/* Current Step */}
        {status.currentStep && (
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-1">Current Step</h4>
            <p className="text-sm text-gray-600">{status.currentStep}</p>
          </div>
        )}

        {/* Error Message */}
        {status.error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <h4 className="text-sm font-medium text-red-800 mb-1">Error</h4>
            <p className="text-sm text-red-700">{status.error}</p>
          </div>
        )}

        {/* Timing Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          {status.startedAt && (
            <div>
              <span className="font-medium text-gray-900">Started:</span>
              <span className="ml-2 text-gray-600">
                {formatTime(status.startedAt)}
              </span>
            </div>
          )}
          {status.completedAt && (
            <div>
              <span className="font-medium text-gray-900">Completed:</span>
              <span className="ml-2 text-gray-600">
                {formatTime(status.completedAt)}
              </span>
            </div>
          )}
        </div>

        {/* Duration */}
        {status.startedAt && status.completedAt && (
          <div className="text-sm">
            <span className="font-medium text-gray-900">Duration:</span>
            <span className="ml-2 text-gray-600">
              {Math.round((new Date(status.completedAt).getTime() - new Date(status.startedAt).getTime()) / 1000)}s
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}