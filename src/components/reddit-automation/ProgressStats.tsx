"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { 
  Calendar, 
  CheckCircle, 
  Clock, 
  SkipForward, 
  Flame,
  TrendingUp 
} from "lucide-react";

interface ProgressStatsProps {
  totalTasks: number;
  completedTasks: number;
  skippedTasks: number;
  pendingTasks: number;
  completionRate: number;
  currentStreak?: number;
}

export function ProgressStats({ 
  totalTasks, 
  completedTasks, 
  skippedTasks, 
  pendingTasks, 
  completionRate,
  currentStreak = 0 
}: ProgressStatsProps) {
  return (
    <Card className="mb-6">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">
              This Week&apos;s Progress
            </h2>
          </div>
          
          {currentStreak > 0 && (
            <div className="flex items-center gap-2 text-orange-600">
              <Flame className="h-4 w-4" />
              <span className="font-medium">{currentStreak} day streak</span>
            </div>
          )}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-2xl font-bold text-green-600">
                {completedTasks}
              </span>
            </div>
            <p className="text-sm text-gray-600">Completed</p>
          </div>
          
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Clock className="h-4 w-4 text-orange-500" />
              <span className="text-2xl font-bold text-orange-500">
                {pendingTasks}
              </span>
            </div>
            <p className="text-sm text-gray-600">Pending</p>
          </div>
          
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <SkipForward className="h-4 w-4 text-gray-500" />
              <span className="text-2xl font-bold text-gray-500">
                {skippedTasks}
              </span>
            </div>
            <p className="text-sm text-gray-600">Skipped</p>
          </div>
          
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <TrendingUp className="h-4 w-4 text-blue-600" />
              <span className="text-2xl font-bold text-blue-600">
                {completionRate}%
              </span>
            </div>
            <p className="text-sm text-gray-600">Complete</p>
          </div>
        </div>
        
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700">
              Overall Progress
            </span>
            <span className="text-sm text-gray-600">
              {completedTasks} of {totalTasks} tasks
            </span>
          </div>
          <Progress 
            value={completionRate} 
            className="h-3"
          />
        </div>
      </CardContent>
    </Card>
  );
}
