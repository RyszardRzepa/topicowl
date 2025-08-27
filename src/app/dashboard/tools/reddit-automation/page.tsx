"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Bot,
  Plus,
  Play,
  Settings,
  Trash2,
  Clock,
  CheckCircle,
  History,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { useCurrentProjectId } from "@/contexts/project-context";

// interface AutomationRun { /* kept for future use */ }
interface Automation {
  id: number;
  name: string;
  description?: string;
  isActive: boolean;
  lastRunAt?: string;
  createdAt: string;
  updatedAt: string;
}

//

export default function RedditAutomationPage() {
  const router = useRouter();
  const currentProjectId = useCurrentProjectId();
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);
  const [executingIds, setExecutingIds] = useState<Set<number>>(new Set());
  const [redditConnected, setRedditConnected] = useState<boolean | null>(null);

  const fetchAutomations = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/tools/reddit-automation/workflows?projectId=${currentProjectId}`,
      );

      if (response.ok) {
        const data = (await response.json()) as { automations?: Automation[] };
        setAutomations(data.automations ?? []);
      } else {
        toast.error("Failed to load automations");
      }
    } catch (error) {
      console.error("Error fetching automations:", error);
      toast.error("Failed to load automations");
    } finally {
      setLoading(false);
    }
  }, [currentProjectId]);

  const checkRedditConnection = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/social/accounts?projectId=${currentProjectId}`,
      );
      if (response.ok) {
        const data = (await response.json()) as {
          data?: { reddit?: { connected: boolean } };
        };
        setRedditConnected(data.data?.reddit?.connected ?? false);
      }
    } catch (error) {
      console.error("Error checking Reddit connection:", error);
      setRedditConnected(false);
    }
  }, [currentProjectId]);

  useEffect(() => {
    if (currentProjectId) {
      void fetchAutomations();
      void checkRedditConnection();
    }
  }, [currentProjectId, fetchAutomations, checkRedditConnection]);

  const executeAutomation = async (automationId: number, dryRun = false) => {
    try {
      setExecutingIds((prev) => {
        const newSet = new Set(prev);
        newSet.add(automationId);
        return newSet;
      });

      const response = await fetch("/api/tools/reddit-automation/execute", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          automationId,
          projectId: currentProjectId,
          dryRun,
        }),
      });

      if (response.ok) {
        await response.json();
        toast.success(
          dryRun
            ? "Automation test completed successfully"
            : "Automation executed successfully",
        );
        void fetchAutomations(); // Refresh to update last run time
        if (!dryRun) {
          router.push(
            `/dashboard/tools/reddit-automation/${automationId}/history`,
          );
        }
      } else {
        const error = (await response.json()) as { error?: string };
        const errorMessage = error.error ?? "Failed to execute automation";

        // Check if the error is about Reddit connection and provide helpful guidance
        if (errorMessage.includes("Reddit account not connected")) {
          toast.error(
            "Reddit account not connected for this project. Click the alert above to connect your Reddit account first.",
            { duration: 10000 },
          );
        } else {
          toast.error(errorMessage);
        }
      }
    } catch (error) {
      console.error("Error executing automation:", error);
      toast.error("Failed to execute automation");
    } finally {
      setExecutingIds((prev) => {
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
        },
      );

      if (response.ok) {
        toast.success("Automation deleted successfully");
        void fetchAutomations();
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
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-3xl font-bold text-gray-900">
              <Bot className="h-8 w-8" />
              Reddit Automation
            </h1>
            <p className="mt-2 text-gray-600">
              Create and manage automated Reddit workflows for lead generation
              and engagement.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={() =>
                router.push("/dashboard/tools/reddit-automation/create")
              }
            >
              <Plus className="mr-1 h-4 w-4" />
              Create Automation
            </Button>
          </div>
        </div>
      </div>

      {/* Reddit Connection Alert */}
      {redditConnected === false && (
        <Alert className="border-orange-200 bg-orange-50">
          <AlertCircle className="h-4 w-4 text-orange-600" />
          <AlertDescription className="text-orange-800">
            Your Reddit account is not connected for this project. You need to
            connect your Reddit account to execute automations.{" "}
            <Button
              variant="link"
              className="h-auto p-0 text-orange-800 underline"
              onClick={() => router.push("/dashboard/social")}
            >
              Go to Social Settings to connect Reddit
              <ExternalLink className="ml-1 h-3 w-3" />
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {automations.length === 0 ? (
        <Card className="p-12 text-center">
          <Bot className="mx-auto mb-4 h-12 w-12 text-gray-400" />
          <h3 className="mb-2 text-lg font-semibold text-gray-900">
            No Automations Yet
          </h3>
          <p className="mx-auto mb-6 max-w-md text-gray-600">
            Get started by creating your first Reddit automation workflow.
            Automatically find relevant posts, evaluate them with AI, and
            generate helpful replies.
          </p>
          <Button
            onClick={() =>
              router.push("/dashboard/tools/reddit-automation/create")
            }
          >
            <Plus className="mr-1 h-4 w-4" />
            Create Your First Automation
          </Button>
        </Card>
      ) : (
        <div className="grid gap-6">
          {automations.map((automation) => (
            <Card key={automation.id} className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="mb-2 flex items-center gap-3">
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
                    <p className="mb-4 text-gray-600">
                      {automation.description}
                    </p>
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
                    size="sm"
                    onClick={() => executeAutomation(automation.id, false)}
                    disabled={executingIds.has(automation.id)}
                  >
                    {executingIds.has(automation.id) ? (
                      <div className="mr-1 h-4 w-4 animate-spin rounded-full border-b-2 border-white"></div>
                    ) : (
                      <Play className="mr-1 h-4 w-4" />
                    )}
                    Execute
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      router.push(
                        `/dashboard/tools/reddit-automation/edit/${automation.id}`,
                      )
                    }
                  >
                    <Settings className="h-4 w-4" />
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      router.push(
                        `/dashboard/tools/reddit-automation/${automation.id}/history`,
                      )
                    }
                  >
                    <History className="h-4 w-4" />
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteAutomation(automation.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
