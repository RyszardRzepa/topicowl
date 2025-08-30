"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  CheckCircle,
  Clock,
  SkipForward,
  MessageCircle,
  FileText,
  ExternalLink,
} from "lucide-react";
import type { RedditTask } from "@/types";

interface TaskCardProps {
  task: RedditTask;
  onClick: (task: RedditTask) => void;
}

export function TaskCard({ task, onClick }: TaskCardProps) {
  const getStatusIcon = () => {
    switch (task.status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'skipped':
        return <SkipForward className="h-4 w-4 text-gray-500" />;
      default:
        return <Clock className="h-4 w-4 text-orange-500" />;
    }
  };

  const getStatusColor = () => {
    switch (task.status) {
      case 'completed':
        return 'border-green-200 bg-green-50';
      case 'skipped':
        return 'border-gray-200 bg-gray-50';
      default:
        return 'border-orange-200 bg-orange-50 hover:bg-orange-100';
    }
  };

  const TaskTypeIcon = task.taskType === 'comment' ? MessageCircle : FileText;

  return (
    <Card 
      className={`cursor-pointer transition-all duration-200 ${getStatusColor()} ${
        task.status === 'pending' ? 'hover:shadow-md' : ''
      }`}
      onClick={() => onClick(task)}
    >
      <CardContent className="p-3">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <TaskTypeIcon className="h-3 w-3 text-gray-600" />
            <Badge 
              variant="outline" 
              className="text-xs px-1.5 py-0.5"
            >
              {task.subreddit}
            </Badge>
          </div>
          {getStatusIcon()}
        </div>
        
        <p className="text-sm text-gray-700 line-clamp-2 mb-2">
          {task.prompt}
        </p>
        
        {task.searchKeywords && (
          <p className="text-xs text-gray-500 mb-2">
            Search: {task.searchKeywords}
          </p>
        )}
        
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500 capitalize">
            {task.taskType}
          </span>
          
          {task.status === 'completed' && task.redditUrl && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                window.open(task.redditUrl!, '_blank');
              }}
            >
              <ExternalLink className="h-3 w-3" />
            </Button>
          )}
        </div>
        
        {task.status === 'completed' && task.karmaEarned > 0 && (
          <div className="mt-2 pt-2 border-t border-green-200">
            <span className="text-xs text-green-600 font-medium">
              +{task.karmaEarned} karma
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
