"use client";

import { Workflow, Clock, Zap, Send } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ArticleMetrics } from "@/types";

interface WorkflowStatusCardProps {
  metrics: ArticleMetrics;
}

export function WorkflowStatusCard({ metrics }: WorkflowStatusCardProps) {
  const { workflowCounts } = metrics;
  
  // Defensive programming - ensure we have valid numbers
  const planning = workflowCounts?.planning ?? 0;
  const generating = workflowCounts?.generating ?? 0;
  const publishing = workflowCounts?.publishing ?? 0;
  
  return (
    <Card className="h-32 hover:shadow-md transition-shadow duration-200">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Workflow className="h-4 w-4 text-purple-600 flex-shrink-0" />
          <span className="truncate">Workflow</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 pb-3">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-3 w-3 text-orange-600 flex-shrink-0" />
              <span className="text-xs font-medium">Planning</span>
            </div>
            <Badge variant="orange" className="h-5 min-w-[24px] text-xs justify-center">{planning}</Badge>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="h-3 w-3 text-blue-600 flex-shrink-0" />
              <span className="text-xs font-medium">Generating</span>
            </div>
            <Badge variant="blue" className="h-5 min-w-[24px] text-xs justify-center">{generating}</Badge>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Send className="h-3 w-3 text-green-600 flex-shrink-0" />
              <span className="text-xs font-medium">Publishing</span>
            </div>
            <Badge variant="green" className="h-5 min-w-[24px] text-xs justify-center">{publishing}</Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}