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
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Workflow className="h-5 w-5 text-purple-600" />
          Workflow Status
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-orange-600" />
              <span className="text-sm">Planning</span>
            </div>
            <Badge variant="orange">{workflowCounts.planning}</Badge>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-blue-600" />
              <span className="text-sm">Generating</span>
            </div>
            <Badge variant="blue">{workflowCounts.generating}</Badge>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Send className="h-4 w-4 text-green-600" />
              <span className="text-sm">Publishing</span>
            </div>
            <Badge variant="green">{workflowCounts.publishing}</Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}