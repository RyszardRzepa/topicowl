"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { TaskCard } from "./TaskCard";
import type { RedditTask } from "@/types";

interface DayColumnProps {
  date: Date;
  dayName: string;
  tasks: RedditTask[];
  onTaskClick: (task: RedditTask) => void;
}

export function DayColumn({ date, dayName, tasks, onTaskClick }: DayColumnProps) {
  const isToday = new Date().toDateString() === date.toDateString();
  const isWeekend = date.getDay() === 0 || date.getDay() === 6;

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const completedTasks = tasks.filter(task => task.status === 'completed').length;
  const totalTasks = tasks.length;

  return (
    <Card 
      className={`min-h-[400px] ${
        isToday ? 'ring-2 ring-blue-200 bg-blue-50/30' : ''
      } ${isWeekend ? 'bg-gray-50/50' : ''}`}
    >
      <CardHeader className="pb-3">
        <div className="text-center">
          <h3 className={`font-semibold ${
            isToday ? 'text-blue-700' : 'text-gray-900'
          }`}>
            {dayName}
          </h3>
          <p className={`text-sm ${
            isToday ? 'text-blue-600' : 'text-gray-500'
          }`}>
            {formatDate(date)}
          </p>
          
          {totalTasks > 0 && (
            <div className="mt-2">
              <span className={`text-xs px-2 py-1 rounded-full ${
                completedTasks === totalTasks 
                  ? 'bg-green-100 text-green-700'
                  : completedTasks > 0
                  ? 'bg-orange-100 text-orange-700'
                  : 'bg-gray-100 text-gray-600'
              }`}>
                {completedTasks}/{totalTasks}
              </span>
            </div>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3">
        {tasks.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-gray-500">No tasks</p>
          </div>
        ) : (
          tasks
            .sort((a, b) => a.taskOrder - b.taskOrder)
            .map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onClick={onTaskClick}
              />
            ))
        )}
      </CardContent>
    </Card>
  );
}
