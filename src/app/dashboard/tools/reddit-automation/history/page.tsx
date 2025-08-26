"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Eye,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { useCurrentProjectId } from "@/contexts/project-context";

interface AutomationRun {
  id: number;
  status: "running" | "completed" | "failed";
  results: unknown;
  errorMessage?: string;
  startedAt: string;
  completedAt?: string;
  automationId: number;
  automationName: string;
}

export default function AutomationHistoryPage() {
  const router = useRouter();
  const currentProjectId = useCurrentProjectId();
  const [runs, setRuns] = useState<AutomationRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRun, setSelectedRun] = useState<AutomationRun | null>(null);

  useEffect(() => {
    const fetchRuns = async () => {
      try {
        setLoading(true);
        const response = await fetch(
          `/api/tools/reddit-automation/runs?projectId=${currentProjectId}`,
        );

        if (response.ok) {
          const data = await response.json() as { runs: AutomationRun[] };
          setRuns(data.runs);
        } else {
          toast.error("Failed to load execution history");
        }
      } catch (error) {
        console.error("Error fetching runs:", error);
        toast.error("Failed to load execution history");
      } finally {
        setLoading(false);
      }
    };

    if (currentProjectId) {
      void fetchRuns();
    }
  }, [currentProjectId]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case "failed":
        return <XCircle className="h-5 w-5 text-red-600" />;
      case "running":
        return <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />;
      default:
        return <AlertCircle className="h-5 w-5 text-yellow-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800";
      case "failed":
        return "bg-red-100 text-red-800";
      case "running":
        return "bg-blue-100 text-blue-800";
      default:
        return "bg-yellow-100 text-yellow-800";
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getDuration = (startedAt: string, completedAt?: string) => {
    const start = new Date(startedAt);
    const end = completedAt ? new Date(completedAt) : new Date();
    const diffMs = end.getTime() - start.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    
    if (diffMins > 0) {
      return `${diffMins}m ${diffSecs % 60}s`;
    }
    return `${diffSecs}s`;
  };

  const formatResults = (results: unknown) => {
    if (!results) return "No results data";
    
    try {
      const parsed = typeof results === 'string' ? JSON.parse(results) : results;
      const data = parsed as Record<string, unknown>;
      return (
        <div className="space-y-2">
          {data.postsFound != null && (
            <div className="flex justify-between">
              <span>Posts Found:</span>
              <span className="font-medium">{Number(data.postsFound) || 0}</span>
            </div>
          )}
          {data.postsEvaluated != null && (
            <div className="flex justify-between">
              <span>Posts Evaluated:</span>
              <span className="font-medium">{Number(data.postsEvaluated) || 0}</span>
            </div>
          )}
          {data.postsApproved != null && (
            <div className="flex justify-between">
              <span>Posts Approved:</span>
              <span className="font-medium">{Number(data.postsApproved) || 0}</span>
            </div>
          )}
          {data.repliesGenerated != null && (
            <div className="flex justify-between">
              <span>Replies Generated:</span>
              <span className="font-medium">{Number(data.repliesGenerated) || 0}</span>
            </div>
          )}
          {data.repliesPosted != null && (
            <div className="flex justify-between">
              <span>Replies Posted:</span>
              <span className="font-medium">{Number(data.repliesPosted) || 0}</span>
            </div>
          )}
        </div>
      );
    } catch {
      return <pre className="text-xs overflow-auto">{JSON.stringify(results, null, 2)}</pre>;
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <Button
          variant="ghost"
          onClick={() => router.push("/dashboard/tools/reddit-automation")}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Automations
        </Button>
        
        <h1 className="text-3xl font-bold text-gray-900">
          Execution History
        </h1>
        <p className="mt-2 text-gray-600">
          View the execution history and results of your Reddit automations.
        </p>
      </div>

      {runs.length === 0 ? (
        <Card className="p-12 text-center">
          <Clock className="mx-auto mb-4 h-12 w-12 text-gray-400" />
          <h3 className="mb-2 text-lg font-semibold text-gray-900">
            No Execution History Yet
          </h3>
          <p className="mx-auto mb-6 max-w-md text-gray-600">
            Your automation execution history will appear here once you run your first automation.
          </p>
          <Button
            onClick={() => router.push("/dashboard/tools/reddit-automation")}
          >
            Go to Automations
          </Button>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Runs List */}
          <div className="lg:col-span-2">
            <div className="space-y-4">
              {runs.map((run) => (
                <Card
                  key={run.id}
                  className={`p-4 cursor-pointer transition-colors ${
                    selectedRun?.id === run.id 
                      ? "ring-2 ring-blue-500 bg-blue-50" 
                      : "hover:bg-gray-50"
                  }`}
                  onClick={() => setSelectedRun(run)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        {getStatusIcon(run.status)}
                        <h3 className="font-semibold text-gray-900">
                          {run.automationName}
                        </h3>
                        <Badge className={`${getStatusColor(run.status)} capitalize`}>
                          {run.status}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          Started: {formatDate(run.startedAt)}
                        </div>
                        {run.completedAt && (
                          <div>
                            Duration: {getDuration(run.startedAt, run.completedAt)}
                          </div>
                        )}
                      </div>

                      {run.errorMessage && (
                        <div className="mt-2 text-sm text-red-600">
                          Error: {run.errorMessage}
                        </div>
                      )}
                    </div>

                    <Button variant="ghost" size="sm">
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {/* Run Details */}
          <div className="lg:col-span-1">
            <Card className="p-6 sticky top-4">
              {selectedRun ? (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    {getStatusIcon(selectedRun.status)}
                    <h2 className="text-lg font-semibold">Run Details</h2>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <h3 className="font-medium text-gray-900 mb-1">
                        Automation
                      </h3>
                      <p className="text-gray-600">{selectedRun.automationName}</p>
                    </div>

                    <div>
                      <h3 className="font-medium text-gray-900 mb-1">
                        Status
                      </h3>
                      <Badge className={`${getStatusColor(selectedRun.status)} capitalize`}>
                        {selectedRun.status}
                      </Badge>
                    </div>

                    <div>
                      <h3 className="font-medium text-gray-900 mb-1">
                        Started At
                      </h3>
                      <p className="text-gray-600">{formatDate(selectedRun.startedAt)}</p>
                    </div>

                    {selectedRun.completedAt && (
                      <div>
                        <h3 className="font-medium text-gray-900 mb-1">
                          Completed At
                        </h3>
                        <p className="text-gray-600">{formatDate(selectedRun.completedAt)}</p>
                      </div>
                    )}

                    {selectedRun.completedAt && (
                      <div>
                        <h3 className="font-medium text-gray-900 mb-1">
                          Duration
                        </h3>
                        <p className="text-gray-600">
                          {getDuration(selectedRun.startedAt, selectedRun.completedAt)}
                        </p>
                      </div>
                    )}

                    {selectedRun.errorMessage && (
                      <div>
                        <h3 className="font-medium text-red-900 mb-1">
                          Error Message
                        </h3>
                        <p className="text-red-600 text-sm bg-red-50 p-2 rounded">
                          {selectedRun.errorMessage}
                        </p>
                      </div>
                    )}

                    <div>
                      <h3 className="font-medium text-gray-900 mb-2">
                        Results
                      </h3>
                      <div className="bg-gray-50 p-3 rounded text-sm">
                        {formatResults(selectedRun.results)}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center text-gray-500 py-8">
                  <Eye className="mx-auto mb-2 h-8 w-8 text-gray-400" />
                  <p>Select a run to view details</p>
                </div>
              )}
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
