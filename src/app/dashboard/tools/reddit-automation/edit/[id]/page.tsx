"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { useCurrentProjectId } from "@/contexts/project-context";
import AutomationForm, { type WorkflowConfig } from "@/components/tools/reddit-automation/AutomationForm";

// Strongly-typed workflow node/config definitions to avoid `any`
type WorkflowNodeBase<TType extends string, TConfig> = {
  type: TType;
  config: TConfig;
  id?: string;
  position?: { x: number; y: number };
};

type SearchConfig = {
  subreddit: string;
  keywords: string[];
  timeRange: "24h" | "7d" | "30d";
  maxResults: number;
};

type EvaluateConfig = {
  prompt?: string;
  passThreshold: number;
  variables?: Record<string, unknown>;
};

type ReplyConfig = {
  prompt?: string;
  toneOfVoice: string;
  maxLength: number;
  variables?: Record<string, unknown>;
};

type ActionConfig = {
  saveToDatabase: boolean;
  postToReddit: boolean;
  requireApproval: boolean;
  sendWebhook: boolean;
  webhookUrl?: string;
};

type WorkflowNode =
  | WorkflowNodeBase<"trigger", { type: string }>
  | WorkflowNodeBase<"search", SearchConfig>
  | WorkflowNodeBase<"evaluate", EvaluateConfig>
  | WorkflowNodeBase<"reply", ReplyConfig>
  | WorkflowNodeBase<"action", ActionConfig>;

type AutomationResponse = {
  success: boolean;
  automation: {
    name: string;
    description: string;
    workflow: WorkflowNode[];
  };
};

export default function EditAutomationPage() {
  const router = useRouter();
  const params = useParams();
  const automationId = params.id as string;
  const currentProjectId = useCurrentProjectId();

  const [initialConfig, setInitialConfig] = useState<WorkflowConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAutomation = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/tools/reddit-automation/workflows/${automationId}?projectId=${currentProjectId}`);
        if (!response.ok) throw new Error("Failed to load automation");
        const data = (await response.json()) as AutomationResponse;

        const searchNode = data.automation.workflow.find((n) => n.type === "search");
        const evaluateNode = data.automation.workflow.find((n) => n.type === "evaluate");
        const replyNode = data.automation.workflow.find((n) => n.type === "reply");
        const actionNode = data.automation.workflow.find((n) => n.type === "action");

        const searchConfig: SearchConfig | undefined = searchNode && searchNode.type === "search" ? searchNode.config : undefined;
        const evaluateConfig: EvaluateConfig | undefined = evaluateNode && evaluateNode.type === "evaluate" ? evaluateNode.config : undefined;
        const replyConfig: ReplyConfig | undefined = replyNode && replyNode.type === "reply" ? replyNode.config : undefined;
        const actionConfig: ActionConfig | undefined = actionNode && actionNode.type === "action" ? actionNode.config : undefined;

        setInitialConfig({
          name: data.automation.name,
          description: data.automation.description,
          subreddit: searchConfig?.subreddit ?? "",
          keywords: searchConfig?.keywords ?? [],
          timeRange: searchConfig?.timeRange ?? "24h",
          maxResults: searchConfig?.maxResults ?? 10,
          passThreshold: evaluateConfig?.passThreshold ?? 6.0,
          evaluationPrompt: evaluateConfig?.prompt ?? undefined,
          toneOfVoice: replyConfig?.toneOfVoice ?? "helpful",
          maxLength: replyConfig?.maxLength ?? 500,
          replyPrompt: replyConfig?.prompt ?? undefined,
          saveToDatabase: actionConfig?.saveToDatabase ?? true,
          postToReddit: actionConfig?.postToReddit ?? false,
          requireApproval: actionConfig?.requireApproval ?? true,
          sendWebhook: actionConfig?.sendWebhook ?? false,
          webhookUrl: actionConfig?.webhookUrl ?? undefined,
        });
      } catch (err) {
        console.error("Error fetching automation:", err);
        toast.error("Failed to load automation details.");
        router.push("/dashboard/tools/reddit-automation");
      } finally {
        setLoading(false);
      }
    };

    if (automationId && currentProjectId) void fetchAutomation();
  }, [automationId, currentProjectId, router]);

  const generateWorkflowNodes = (config: WorkflowConfig) => {
    return [
      { id: "trigger-1", type: "trigger" as const, config: { type: "manual" }, position: { x: 100, y: 100 } },
      { id: "search-1", type: "search" as const, config: { subreddit: config.subreddit, keywords: config.keywords, timeRange: config.timeRange, maxResults: config.maxResults }, position: { x: 300, y: 100 } },
      { id: "evaluate-1", type: "evaluate" as const, config: { prompt: config.evaluationPrompt, passThreshold: config.passThreshold, variables: {} }, position: { x: 500, y: 100 } },
      { id: "reply-1", type: "reply" as const, config: { prompt: config.replyPrompt, toneOfVoice: config.toneOfVoice, maxLength: config.maxLength, variables: {} }, position: { x: 700, y: 100 } },
      { id: "action-1", type: "action" as const, config: { saveToDatabase: config.saveToDatabase, postToReddit: config.postToReddit, requireApproval: config.requireApproval, sendWebhook: config.sendWebhook, webhookUrl: config.webhookUrl }, position: { x: 900, y: 100 } },
    ];
  };

  const handleSubmit = async (config: WorkflowConfig) => {
    const workflow = generateWorkflowNodes(config);
    const response = await fetch(`/api/tools/reddit-automation/workflows/${automationId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: config.name,
        description: config.description,
        workflow,
        projectId: currentProjectId,
      }),
    });

    if (response.ok) {
      toast.success("Automation updated successfully");
      router.push("/dashboard/tools/reddit-automation");
    } else {
      const error = (await response.json()) as { error?: string };
      toast.error(error?.error ?? "Failed to update automation");
    }
  };

  if (loading || !initialConfig) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-orange-500"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <Button variant="ghost" onClick={() => router.back()} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Automations
        </Button>
        <h1 className="text-3xl font-bold text-gray-900">Edit Reddit Automation</h1>
      </div>

      <AutomationForm initialConfig={initialConfig} submitLabel="Save Changes" onSubmit={handleSubmit} />
    </div>
  );
}
