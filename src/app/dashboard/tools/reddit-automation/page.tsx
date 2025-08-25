"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Bot,
  Plus,
  Play,
  Settings,
  Copy,
  Trash2,
  Clock,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useCurrentProjectId } from "@/contexts/project-context";

interface Automation {
  id: number;
  name: string;
  description?: string;
  isActive: boolean;
  lastRunAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface AutomationRun {
  id: number;
  status: "running" | "completed" | "failed";
  startedAt: string;
  completedAt?: string;
  errorMessage?: string;
}

export default function RedditAutomationPage() {
  const router = useRouter();
  const currentProjectId = useCurrentProjectId();
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);
  const [executingIds, setExecutingIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (currentProjectId) {
      fetchAutomations();
    }
  }, [currentProjectId]);

  const fetchAutomations = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/tools/reddit-automation/workflows?projectId=${currentProjectId}`
      );
      
      if (response.ok) {
        const data = await response.json();
        setAutomations(data.automations);
      } else {
        toast.error("Failed to load automations");
      }
    } catch (error) {
      console.error("Error fetching automations:", error);
      toast.error("Failed to load automations");
    } finally {
      setLoading(false);
    }
  };

  const executeAutomation = async (automationId: number, dryRun = false) => {
    try {
      setExecutingIds(prev => new Set([...prev, automationId]));
      
      const response = await fetch("/api/tools/reddit-automation/execute", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          automationId,
          dryRun,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(
          dryRun 
            ? "Automation test completed successfully"
            : "Automation executed successfully"
        );
        fetchAutomations(); // Refresh to update last run time
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to execute automation");
      }
    } catch (error) {
      console.error("Error executing automation:", error);
      toast.error("Failed to execute automation");
    } finally {
      setExecutingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(automationId);
        return newSet;
      });
    }
  };

  const deleteAutomation = async (automationId: number) => {
    if (!confirm("Are you sure you want to delete this automation?")) {
      return;
    }

    try {
      const response = await fetch(
        `/api/tools/reddit-automation/workflows/${automationId}`,
        {
          method: "DELETE",
        }
      );

      if (response.ok) {
        toast.success("Automation deleted successfully");
        fetchAutomations();
      } else {
        toast.error("Failed to delete automation");
      }
    } catch (error) {
      console.error("Error deleting automation:", error);
      toast.error("Failed to delete automation");
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
              <Bot className="h-8 w-8 text-blue-600" />
              Reddit Automation
            </h1>
            <p className="mt-2 text-gray-600">
              Create and manage automated Reddit workflows for lead generation and engagement.
            </p>
          </div>
          <Button onClick={() => router.push("/dashboard/tools/reddit-automation/create")}>
            <Plus className="w-4 h-4 mr-1" />
            Create Automation
          </Button>
        </div>
      </div>

      {automations.length === 0 ? (
        <Card className="p-12 text-center">
          <Bot className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No Automations Yet
          </h3>
          <p className="text-gray-600 mb-6 max-w-md mx-auto">
            Get started by creating your first Reddit automation workflow. 
            Automatically find relevant posts, evaluate them with AI, and generate helpful replies.
          </p>
          <Button onClick={() => router.push("/dashboard/tools/reddit-automation/create")}>
            <Plus className="w-4 h-4 mr-1" />
            Create Your First Automation
          </Button>
        </Card>
      ) : (
        <div className="grid gap-6">
          {automations.map((automation) => (
            <Card key={automation.id} className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {automation.name}
                    </h3>
                    <Badge 
                      variant={automation.isActive ? "default" : "secondary"}
                    >
                      {automation.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  
                  {automation.description && (
                    <p className="text-gray-600 mb-4">{automation.description}</p>
                  )}

                  <div className="flex items-center gap-6 text-sm text-gray-500">
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      Created: {formatDate(automation.createdAt)}
                    </div>
                    {automation.lastRunAt && (
                      <div className="flex items-center gap-1">
                        <CheckCircle className="h-4 w-4" />
                        Last run: {formatDate(automation.lastRunAt)}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => executeAutomation(automation.id, true)}
                    disabled={executingIds.has(automation.id)}
                  >
                    <Play className="w-4 h-4 mr-1" />
                    Test Run
                  </Button>
                  
                  <Button
                    size="sm"
                    onClick={() => executeAutomation(automation.id, false)}
                    disabled={executingIds.has(automation.id)}
                  >
                    {executingIds.has(automation.id) ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-1"></div>
                    ) : (
                      <Play className="w-4 h-4 mr-1" />
                    )}
                    Execute
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                  >
                    <Settings className="w-4 h-4" />
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteAutomation(automation.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Quick Start Section */}
      <Card className="mt-8 p-6 bg-blue-50 border-blue-200">
        <h3 className="text-lg font-semibold text-blue-900 mb-2">
          Quick Start Guide
        </h3>
        <div className="text-sm text-blue-800 space-y-2">
          <div className="flex items-start gap-2">
            <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">1</div>
            <div>
              <strong>Reddit Search:</strong> Configure subreddit and keywords to find relevant posts
            </div>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">2</div>
            <div>
              <strong>AI Evaluation:</strong> Use AI to score posts for relevance and engagement potential
            </div>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">3</div>
            <div>
              <strong>Reply Generation:</strong> Generate helpful, authentic responses with AI
            </div>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">4</div>
            <div>
              <strong>Actions:</strong> Save results, send webhooks, or post replies with approval
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}