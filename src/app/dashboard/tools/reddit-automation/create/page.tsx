"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { useCurrentProjectId } from "@/contexts/project-context";
import AutomationForm, { type WorkflowConfig } from "@/components/tools/reddit-automation/AutomationForm";

export default function CreateAutomationPage() {
  const router = useRouter();
  const currentProjectId = useCurrentProjectId();

  const initialConfig: WorkflowConfig = {
    name: "",
    description: "",
    subreddit: "",
    keywords: [],
    timeRange: "24h",
    maxResults: 10,
    passThreshold: 6.0,
    toneOfVoice: "helpful",
    maxLength: 500,
    saveToDatabase: true,
    postToReddit: false,
    requireApproval: true,
    sendWebhook: false,
  };

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
    const response = await fetch("/api/tools/reddit-automation/workflows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: config.name,
        description: config.description,
        workflow,
        projectId: currentProjectId,
      }),
    });

    if (response.ok) {
      toast.success("Automation created successfully");
      router.push("/dashboard/tools/reddit-automation");
    } else {
      const error = (await response.json()) as { error?: string };
      toast.error(error?.error ?? "Failed to create automation");
    }
  };

  return (
    <div className="container max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <Button variant="ghost" onClick={() => router.back()} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Automations
        </Button>
        <h1 className="text-3xl font-bold text-gray-900">Create Reddit Automation</h1>
      </div>

      <AutomationForm initialConfig={initialConfig} submitLabel="Create Automation" onSubmit={handleSubmit} />
    </div>
  );
}