"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { 
  ArrowLeft,
  Plus,
  X,
  Save,
  Play,
} from "lucide-react";
import { toast } from "sonner";
import { useCurrentProjectId } from "@/contexts/project-context";

interface WorkflowConfig {
  name: string;
  description: string;
  
  // Search configuration
  subreddit: string;
  keywords: string[];
  timeRange: "24h" | "7d" | "30d";
  maxResults: number;

  // Evaluation configuration
  passThreshold: number;
  evaluationPrompt?: string;
  
  // Reply configuration
  toneOfVoice: string;
  maxLength: number;
  replyPrompt?: string;
  
  // Action configuration
  saveToDatabase: boolean;
  postToReddit: boolean;
  requireApproval: boolean;
  sendWebhook: boolean;
  webhookUrl?: string;
}

export default function CreateAutomationPage() {
  const router = useRouter();
  const currentProjectId = useCurrentProjectId();
  
  const [config, setConfig] = useState<WorkflowConfig>({
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
  });
  
  const [keywordInput, setKeywordInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const addKeyword = () => {
    if (!keywordInput.trim()) return;
    
    if (!config.keywords.includes(keywordInput.trim())) {
      setConfig(prev => ({
        ...prev,
        keywords: [...prev.keywords, keywordInput.trim()],
      }));
    }
    setKeywordInput("");
  };

  const removeKeyword = (keyword: string) => {
    setConfig(prev => ({
      ...prev,
      keywords: prev.keywords.filter(k => k !== keyword),
    }));
  };

  const handleKeywordInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addKeyword();
    }
  };

  const generateWorkflowNodes = () => {
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

  const saveAutomation = async () => {
    if (!config.name.trim()) {
      toast.error("Please enter an automation name");
      return;
    }
    
    if (!config.subreddit.trim()) {
      toast.error("Please enter a subreddit");
      return;
    }

    setSaving(true);
    try {
      const workflow = generateWorkflowNodes();
      
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
    } finally {
      setSaving(false);
    }
  };

  const testAutomation = async () => {
    if (!config.subreddit.trim()) {
      toast.error("Please enter a subreddit to test");
      return;
    }

    setTesting(true);
    try {
      const workflow = generateWorkflowNodes();
      
      const response = await fetch("/api/tools/reddit-automation/execute", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          workflow,
          dryRun: true,
          projectId: currentProjectId,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        toast.success("Test completed successfully");
        console.log("Test results:", data.results);
      } else {
        const error = await response.json();
        toast.error(error.error || "Test failed");
      }
    } catch (error) {
      console.error("Error testing automation:", error);
      toast.error("Test failed");
    } finally {
      setTesting(false);
    }
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
        
        <h1 className="text-3xl font-bold text-gray-900">
          Create Reddit Automation
        </h1>
        <p className="mt-2 text-gray-600">
          Configure your automated Reddit workflow step by step.
        </p>
      </div>

      <div className="grid gap-8">
        {/* Basic Information */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Basic Information</h2>
          <div className="grid gap-4">
            <div>
              <Label htmlFor="name">Automation Name *</Label>
              <Input
                id="name"
                value={config.name}
                onChange={(e) => setConfig(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Tech Startup Lead Generation"
              />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={config.description}
                onChange={(e) => setConfig(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Describe what this automation does..."
                rows={3}
              />
            </div>
          </div>
        </Card>

        {/* Reddit Search Configuration */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Reddit Search</h2>
          <div className="grid gap-4">
            <div>
              <Label htmlFor="subreddit">Subreddit *</Label>
              <Input
                id="subreddit"
                value={config.subreddit}
                onChange={(e) => setConfig(prev => ({ ...prev, subreddit: e.target.value }))}
                placeholder="e.g., startups, entrepreneur"
              />
              <div className="text-xs text-gray-500 mt-1">
                Enter subreddit name without "r/"
              </div>
            </div>

            <div>
              <Label>Keywords (Optional)</Label>
              <div className="flex space-x-2">
                <Input
                  value={keywordInput}
                  onChange={(e) => setKeywordInput(e.target.value)}
                  onKeyDown={handleKeywordInputKeyDown}
                  placeholder="Add keyword..."
                  className="flex-1"
                />
                <Button onClick={addKeyword} variant="outline" size="sm">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              
              {config.keywords.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {config.keywords.map((keyword) => (
                    <Badge key={keyword} variant="secondary" className="flex items-center gap-1">
                      {keyword}
                      <X 
                        className="w-3 h-3 cursor-pointer" 
                        onClick={() => removeKeyword(keyword)}
                      />
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="time-range">Time Range</Label>
                <Select
                  value={config.timeRange}
                  onValueChange={(value: "24h" | "7d" | "30d") =>
                    setConfig(prev => ({ ...prev, timeRange: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="24h">Last 24 hours</SelectItem>
                    <SelectItem value="7d">Last 7 days</SelectItem>
                    <SelectItem value="30d">Last 30 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="max-results">Max Results</Label>
                <Input
                  id="max-results"
                  type="number"
                  min="1"
                  max="100"
                  value={config.maxResults}
                  onChange={(e) => setConfig(prev => ({ 
                    ...prev, 
                    maxResults: parseInt(e.target.value) || 10 
                  }))}
                />
              </div>
            </div>
          </div>
        </Card>

        {/* Evaluation Configuration */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">AI Evaluation</h2>
          <div className="grid gap-4">
            <div>
              <Label htmlFor="pass-threshold">Pass Score Threshold</Label>
              <Input
                id="pass-threshold"
                type="number"
                min="0"
                max="10"
                step="0.1"
                value={config.passThreshold}
                onChange={(e) => setConfig(prev => ({ 
                  ...prev, 
                  passThreshold: parseFloat(e.target.value) || 6.0 
                }))}
              />
              <div className="text-xs text-gray-500 mt-1">
                Posts scoring above this threshold will proceed to reply generation (0-10)
              </div>
            </div>
          </div>
        </Card>

        {/* Reply Generation Configuration */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Reply Generation</h2>
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="tone">Tone of Voice</Label>
                <Select
                  value={config.toneOfVoice}
                  onValueChange={(value) => setConfig(prev => ({ ...prev, toneOfVoice: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="helpful">Helpful</SelectItem>
                    <SelectItem value="professional">Professional</SelectItem>
                    <SelectItem value="casual">Casual</SelectItem>
                    <SelectItem value="technical">Technical</SelectItem>
                    <SelectItem value="friendly">Friendly</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="max-length">Max Reply Length</Label>
                <Input
                  id="max-length"
                  type="number"
                  min="100"
                  max="2000"
                  value={config.maxLength}
                  onChange={(e) => setConfig(prev => ({ 
                    ...prev, 
                    maxLength: parseInt(e.target.value) || 500 
                  }))}
                />
              </div>
            </div>
          </div>
        </Card>

        {/* Action Configuration */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Actions</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Save Results to Database</Label>
                <div className="text-xs text-gray-500">
                  Store execution results for analytics and review
                </div>
              </div>
              <Switch
                checked={config.saveToDatabase}
                onCheckedChange={(checked) => 
                  setConfig(prev => ({ ...prev, saveToDatabase: checked }))
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Post Replies to Reddit</Label>
                <div className="text-xs text-gray-500">
                  Actually post generated replies to Reddit
                </div>
              </div>
              <Switch
                checked={config.postToReddit}
                onCheckedChange={(checked) => 
                  setConfig(prev => ({ ...prev, postToReddit: checked }))
                }
              />
            </div>

            {config.postToReddit && (
              <div className="flex items-center justify-between pl-6">
                <div>
                  <Label>Require Manual Approval</Label>
                  <div className="text-xs text-gray-500">
                    Review replies before posting
                  </div>
                </div>
                <Switch
                  checked={config.requireApproval}
                  onCheckedChange={(checked) => 
                    setConfig(prev => ({ ...prev, requireApproval: checked }))
                  }
                />
              </div>
            )}

            <div className="flex items-center justify-between">
              <div>
                <Label>Send Webhook</Label>
                <div className="text-xs text-gray-500">
                  Send results to external URL
                </div>
              </div>
              <Switch
                checked={config.sendWebhook}
                onCheckedChange={(checked) => 
                  setConfig(prev => ({ ...prev, sendWebhook: checked }))
                }
              />
            </div>

            {config.sendWebhook && (
              <div className="pl-6">
                <Label htmlFor="webhook-url">Webhook URL</Label>
                <Input
                  id="webhook-url"
                  type="url"
                  value={config.webhookUrl ?? ""}
                  onChange={(e) => setConfig(prev => ({ ...prev, webhookUrl: e.target.value }))}
                  placeholder="https://your-app.com/webhook"
                />
              </div>
            )}
          </div>
        </Card>

        {/* Actions */}
        <div className="flex justify-end space-x-4">
          <Button
            variant="outline"
            onClick={testAutomation}
            disabled={testing || saving}
          >
            {testing ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-1"></div>
            ) : (
              <Play className="w-4 h-4 mr-1" />
            )}
            Test Configuration
          </Button>
          
          <Button
            onClick={saveAutomation}
            disabled={saving || testing}
          >
            {saving ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-1"></div>
            ) : (
              <Save className="w-4 h-4 mr-1" />
            )}
            Create Automation
          </Button>
        </div>
      </div>
    </div>
  );
}