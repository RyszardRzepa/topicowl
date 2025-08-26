"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  ArrowLeft,
  Bot,
} from "lucide-react";
import { toast } from "sonner";
import { useCurrentProjectId } from "@/contexts/project-context";
import { AutomationWizard } from "@/components/reddit-automation/AutomationWizard";

interface WorkflowConfig {
  name: string;
  description: string;
  subreddit: string;
  keywords: string[];
  timeRange: "24h" | "7d" | "30d";
  maxResults: number;
  passThreshold: number;
  evaluationPrompt?: string;
  toneOfVoice: string;
  maxLength: number;
  replyPrompt?: string;
  saveToDatabase: boolean;
  postToReddit: boolean;
  requireApproval: boolean;
  sendWebhook: boolean;
  webhookUrl?: string;
}

export default function CreateAutomationPage() {
  const router = useRouter();
  const currentProjectId = useCurrentProjectId();
  const [useWizard, setUseWizard] = useState(true);

  const generateWorkflowNodes = (config: WorkflowConfig) => {
    return [
      {
        id: "trigger-1",
        type: "trigger" as const,
        config: { type: "manual" },
        position: { x: 100, y: 100 },
      },
      {
        id: "search-1",
        type: "search" as const,
        config: {
          subreddit: config.subreddit,
          keywords: config.keywords,
          timeRange: config.timeRange,
          maxResults: config.maxResults,
        },
        position: { x: 300, y: 100 },
      },
      {
        id: "evaluate-1",
        type: "evaluate" as const,
        config: {
          prompt: config.evaluationPrompt,
          passThreshold: config.passThreshold,
          variables: {},
        },
        position: { x: 500, y: 100 },
      },
      {
        id: "reply-1",
        type: "reply" as const,
        config: {
          prompt: config.replyPrompt,
          toneOfVoice: config.toneOfVoice,
          maxLength: config.maxLength,
          variables: {},
        },
        position: { x: 700, y: 100 },
      },
      {
        id: "action-1",
        type: "action" as const,
        config: {
          saveToDatabase: config.saveToDatabase,
          postToReddit: config.postToReddit,
          requireApproval: config.requireApproval,
          sendWebhook: config.sendWebhook,
          webhookUrl: config.webhookUrl,
        },
        position: { x: 900, y: 100 },
      },
    ];
  };

  const handleSave = async (config: WorkflowConfig) => {
    try {
      const workflow = generateWorkflowNodes(config);
      
      const response = await fetch("/api/tools/reddit-automation/workflows", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
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
        const error = await response.json();
        toast.error(error.error || "Failed to create automation");
      }
    } catch (error) {
      console.error("Error saving automation:", error);
      toast.error("Failed to create automation");
    }
  };

  const handleCancel = () => {
    router.push("/dashboard/tools/reddit-automation");
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <Button
          variant="ghost"
          onClick={() => router.back()}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Automations
        </Button>
      </div>

      {useWizard ? (
        <AutomationWizard onSave={handleSave} onCancel={handleCancel} />
      ) : (
        <Card className="p-8">
          <div className="text-center">
            <Bot className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Choose Creation Method</h2>
            <p className="text-gray-600 mb-6">
              How would you like to create your automation?
            </p>
            <div className="flex justify-center space-x-4">
              <Button onClick={() => setUseWizard(true)}>
                Step-by-Step Wizard
              </Button>
              <Button variant="outline" onClick={() => setUseWizard(false)}>
                Advanced Builder
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}