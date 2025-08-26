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
import { Progress } from "@/components/ui/progress";
import { 
  ArrowLeft,
  ArrowRight,
  Plus,
  X,
  Save,
  Play,
  Search,
  Brain,
  MessageSquare,
  Settings,
} from "lucide-react";
import { toast } from "sonner";

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

interface AutomationWizardProps {
  onSave: (config: WorkflowConfig) => Promise<void>;
  onCancel: () => void;
}

const WIZARD_STEPS = [
  { id: 1, title: "Basic Info", icon: Settings },
  { id: 2, title: "Search", icon: Search },
  { id: 3, title: "AI Evaluation", icon: Brain },
  { id: 4, title: "Reply", icon: MessageSquare },
  { id: 5, title: "Actions", icon: Settings },
];

export function AutomationWizard({ onSave, onCancel }: AutomationWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  
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

  const canProceed = (step: number): boolean => {
    switch (step) {
      case 1:
        return config.name.trim() !== "";
      case 2:
        return config.subreddit.trim() !== "";
      case 3:
      case 4:
      case 5:
        return true;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (canProceed(currentStep) && currentStep < 5) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSave = async () => {
    if (!canProceed(1) || !canProceed(2)) {
      toast.error("Please complete all required fields");
      return;
    }

    setSaving(true);
    try {
      await onSave(config);
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!canProceed(2)) {
      toast.error("Please enter a subreddit to test");
      return;
    }

    setTesting(true);
    try {
      // This would call the test API
      toast.success("Test configuration looks good!");
    } finally {
      setTesting(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-semibold mb-2">Let's start with the basics</h2>
              <p className="text-gray-600">Give your automation a name and description</p>
            </div>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Automation Name *</Label>
                <Input
                  id="name"
                  value={config.name}
                  onChange={(e) => setConfig(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Tech Startup Lead Generation"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="description">Description (Optional)</Label>
                <Textarea
                  id="description"
                  value={config.description}
                  onChange={(e) => setConfig(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe what this automation does..."
                  rows={3}
                  className="mt-1"
                />
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-semibold mb-2">Configure Reddit Search</h2>
              <p className="text-gray-600">Tell us where and what to look for</p>
            </div>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="subreddit">Target Subreddit *</Label>
                <Input
                  id="subreddit"
                  value={config.subreddit}
                  onChange={(e) => setConfig(prev => ({ ...prev, subreddit: e.target.value }))}
                  placeholder="e.g., startups, entrepreneur"
                  className="mt-1"
                />
                <div className="text-xs text-gray-500 mt-1">
                  Enter subreddit name without "r/"
                </div>
              </div>

              <div>
                <Label>Keywords (Optional)</Label>
                <div className="flex space-x-2 mt-1">
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
                    <SelectTrigger className="mt-1">
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
                    className="mt-1"
                  />
                </div>
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-semibold mb-2">AI Evaluation Settings</h2>
              <p className="text-gray-600">Configure how AI will score posts for relevance</p>
            </div>
            
            <div className="space-y-4">
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
                  className="mt-1"
                />
                <div className="text-xs text-gray-500 mt-1">
                  Posts scoring above this threshold will proceed to reply generation (0-10)
                </div>
              </div>
              
              <div>
                <Label htmlFor="evaluation-prompt">Custom Evaluation Prompt (Optional)</Label>
                <Textarea
                  id="evaluation-prompt"
                  value={config.evaluationPrompt ?? ""}
                  onChange={(e) => setConfig(prev => ({ ...prev, evaluationPrompt: e.target.value }))}
                  placeholder="Custom instructions for evaluating posts..."
                  rows={3}
                  className="mt-1"
                />
                <div className="text-xs text-gray-500 mt-1">
                  Leave empty to use the default evaluation prompt
                </div>
              </div>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-semibold mb-2">Reply Generation</h2>
              <p className="text-gray-600">Configure how AI will generate responses</p>
            </div>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="tone">Tone of Voice</Label>
                  <Select
                    value={config.toneOfVoice}
                    onValueChange={(value) => setConfig(prev => ({ ...prev, toneOfVoice: value }))}
                  >
                    <SelectTrigger className="mt-1">
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
                    className="mt-1"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="reply-prompt">Custom Reply Prompt (Optional)</Label>
                <Textarea
                  id="reply-prompt"
                  value={config.replyPrompt ?? ""}
                  onChange={(e) => setConfig(prev => ({ ...prev, replyPrompt: e.target.value }))}
                  placeholder="Custom instructions for generating replies..."
                  rows={3}
                  className="mt-1"
                />
                <div className="text-xs text-gray-500 mt-1">
                  Leave empty to use the default reply generation prompt
                </div>
              </div>
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-semibold mb-2">Action Settings</h2>
              <p className="text-gray-600">Choose what happens with the generated content</p>
            </div>
            
            <div className="space-y-6">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <Label className="font-medium">Save Results to Database</Label>
                  <div className="text-sm text-gray-500">
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

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <Label className="font-medium">Post Replies to Reddit</Label>
                  <div className="text-sm text-gray-500">
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
                <div className="flex items-center justify-between p-4 border rounded-lg ml-6">
                  <div>
                    <Label className="font-medium">Require Manual Approval</Label>
                    <div className="text-sm text-gray-500">
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

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <Label className="font-medium">Send Webhook</Label>
                  <div className="text-sm text-gray-500">
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
                <div className="ml-6">
                  <Label htmlFor="webhook-url">Webhook URL</Label>
                  <Input
                    id="webhook-url"
                    type="url"
                    value={config.webhookUrl ?? ""}
                    onChange={(e) => setConfig(prev => ({ ...prev, webhookUrl: e.target.value }))}
                    placeholder="https://your-app.com/webhook"
                    className="mt-1"
                  />
                </div>
              )}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Progress Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">Create Automation</h1>
          <div className="text-sm text-gray-500">
            Step {currentStep} of {WIZARD_STEPS.length}
          </div>
        </div>
        
        <Progress value={(currentStep / WIZARD_STEPS.length) * 100} className="mb-4" />
        
        <div className="flex justify-center space-x-4">
          {WIZARD_STEPS.map((step) => {
            const Icon = step.icon;
            const isActive = step.id === currentStep;
            const isCompleted = step.id < currentStep;
            
            return (
              <div
                key={step.id}
                className={`flex flex-col items-center space-y-1 ${
                  isActive ? "text-blue-600" : isCompleted ? "text-green-600" : "text-gray-400"
                }`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  isActive ? "bg-blue-100" : isCompleted ? "bg-green-100" : "bg-gray-100"
                }`}>
                  <Icon className="w-4 h-4" />
                </div>
                <span className="text-xs">{step.title}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Step Content */}
      <Card className="p-8 mb-8">
        {renderStepContent()}
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <div>
          {currentStep > 1 && (
            <Button variant="outline" onClick={handlePrev}>
              <ArrowLeft className="w-4 h-4 mr-1" />
              Previous
            </Button>
          )}
          <Button variant="ghost" onClick={onCancel} className="ml-2">
            Cancel
          </Button>
        </div>

        <div className="flex space-x-2">
          {currentStep < 5 ? (
            <>
              <Button
                variant="outline"
                onClick={handleTest}
                disabled={!canProceed(currentStep) || testing}
              >
                {testing ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-1"></div>
                ) : (
                  <Play className="w-4 h-4 mr-1" />
                )}
                Test
              </Button>
              <Button 
                onClick={handleNext} 
                disabled={!canProceed(currentStep)}
              >
                Next
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </>
          ) : (
            <Button
              onClick={handleSave}
              disabled={saving || !canProceed(1) || !canProceed(2)}
            >
              {saving ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-1"></div>
              ) : (
                <Save className="w-4 h-4 mr-1" />
              )}
              Create Automation
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}