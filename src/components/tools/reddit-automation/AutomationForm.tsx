"use client";

import { useState } from "react";
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
import { Check, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { SubredditAutosuggestions } from "@/components/ui/subreddit-autosuggestions";

export interface WorkflowConfig {
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

interface Step {
  id: string;
  title: string;
  description: string;
}

const WORKFLOW_STEPS: Step[] = [
  { id: "info", title: "Basic Information", description: "Give your automation a name and description." },
  { id: "search", title: "Find Reddit Posts", description: "Configure what posts to search for." },
  { id: "evaluate", title: "Filter Posts", description: "Set criteria for relevant posts." },
  { id: "reply", title: "Generate Replies", description: "Configure how replies are generated." },
  { id: "action", title: "Choose Actions", description: "What happens with the replies?" },
];

export type AutomationFormProps = {
  initialConfig: WorkflowConfig;
  submitLabel: string;
  onSubmit: (config: WorkflowConfig) => Promise<void> | void;
};

const KeywordInput = ({ keywords, onChange }: { keywords: string[]; onChange: (keywords: string[]) => void }) => {
  const [inputValue, setInputValue] = useState("");

  const addKeyword = () => {
    const v = inputValue.trim();
    if (!v) return;
    if (!keywords.includes(v)) onChange([...keywords, v]);
    setInputValue("");
  };

  const removeKeyword = (kw: string) => onChange(keywords.filter((k) => k !== kw));

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addKeyword();
    }
  };

  return (
    <div>
      <div className="flex space-x-2">
        <Input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add keyword..."
          className="flex-1"
        />
        <Button onClick={addKeyword} variant="outline" size="sm">
          <Plus className="w-4 h-4" />
        </Button>
      </div>
      {keywords.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {keywords.map((kw) => (
            <Badge key={kw} variant="secondary" className="flex items-center gap-1">
              {kw}
              <X className="h-3 w-3 cursor-pointer" onClick={() => removeKeyword(kw)} />
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
};

export function AutomationForm({ initialConfig, submitLabel, onSubmit }: AutomationFormProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [config, setConfig] = useState<WorkflowConfig>(initialConfig);
  const [saving, setSaving] = useState(false);

  const handleConfigChange = (patch: Partial<WorkflowConfig>) => {
    setConfig((prev) => ({ ...prev, ...patch }));
  };

  const validateStep = (step: number): boolean => {
    if (step === 0) {
      if (!config.name.trim()) {
        toast.error("Please enter an automation name.");
        return false;
      }
    }
    if (step === 1) {
      if (!config.subreddit.trim()) {
        toast.error("Please enter a subreddit.");
        return false;
      }
      if ((config.keywords?.length ?? 0) === 0) {
        toast.error("Please add at least one keyword.");
        return false;
      }
    }
    return true;
  };

  const nextStep = () => {
    if (!validateStep(currentStep)) return;
    setCurrentStep((s) => Math.min(s + 1, WORKFLOW_STEPS.length - 1));
  };
  const prevStep = () => setCurrentStep((s) => Math.max(s - 1, 0));

  const handleSubmit = async () => {
    // validate all required up to current step
    if (!validateStep(currentStep)) return;
    setSaving(true);
    try {
      await onSubmit(config);
    } finally {
      setSaving(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="grid gap-4">
            <div>
              <Label htmlFor="name">Automation Name *</Label>
              <Input id="name" value={config.name} onChange={(e) => handleConfigChange({ name: e.target.value })} placeholder="e.g., Tech Startup Lead Generation" />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" value={config.description} onChange={(e) => handleConfigChange({ description: e.target.value })} placeholder="Describe what this automation does..." rows={3} />
            </div>
          </div>
        );
      case 1:
        return (
          <div className="grid gap-4">
            <div>
              <Label htmlFor="subreddit">Subreddit *</Label>
              <SubredditAutosuggestions
                inputId="subreddit"
                value={config.subreddit}
                onChange={(val) => handleConfigChange({ subreddit: val })}
                placeholder="e.g., startups, entrepreneur"
              />
            </div>
            <div>
              <Label>Keywords *</Label>
              <KeywordInput keywords={config.keywords} onChange={(keywords) => handleConfigChange({ keywords })} />
              <div className="mt-1 text-xs text-gray-500">Add one or more keywords used to filter posts.</div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="time-range">Time Range</Label>
                <Select value={config.timeRange} onValueChange={(value: "24h" | "7d" | "30d") => handleConfigChange({ timeRange: value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="24h">Last 24 hours</SelectItem>
                    <SelectItem value="7d">Last 7 days</SelectItem>
                    <SelectItem value="30d">Last 30 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="max-results">Max Results</Label>
                <Input id="max-results" type="number" min="1" max="100" value={config.maxResults} onChange={(e) => handleConfigChange({ maxResults: parseInt(e.target.value) || 10 })} />
              </div>
            </div>
          </div>
        );
      case 2:
        return (
          <div className="grid gap-4">
            <div>
              <Label htmlFor="pass-threshold">Pass Score Threshold</Label>
              <Input id="pass-threshold" type="number" min="0" max="10" step="0.1" value={config.passThreshold} onChange={(e) => handleConfigChange({ passThreshold: parseFloat(e.target.value) || 6.0 })} />
              <div className="mt-1 text-xs text-gray-500">Posts scoring above this threshold will proceed to reply generation (0-10)</div>
            </div>
            <div>
              <Label htmlFor="evaluation-prompt">Evaluation Prompt (Optional)</Label>
              <Textarea id="evaluation-prompt" value={config.evaluationPrompt ?? ""} onChange={(e) => handleConfigChange({ evaluationPrompt: e.target.value })} placeholder="Provide a custom prompt for evaluating posts. If empty, a default prompt will be used." rows={5} />
            </div>
          </div>
        );
      case 3:
        return (
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="tone">Tone of Voice</Label>
                <Select value={config.toneOfVoice} onValueChange={(value) => handleConfigChange({ toneOfVoice: value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
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
                <Input id="max-length" type="number" min="100" max="2000" value={config.maxLength} onChange={(e) => handleConfigChange({ maxLength: parseInt(e.target.value) || 500 })} />
              </div>
            </div>
            <div>
              <Label htmlFor="reply-prompt">Reply Prompt (Optional)</Label>
              <Textarea id="reply-prompt" value={config.replyPrompt ?? ""} onChange={(e) => handleConfigChange({ replyPrompt: e.target.value })} placeholder="Provide a custom prompt for generating replies. If empty, a default prompt will be used." rows={5} />
            </div>
          </div>
        );
      case 4:
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Save Results to Database</Label>
                <div className="text-xs text-gray-500">Store execution results for analytics and review</div>
              </div>
              <Switch checked={config.saveToDatabase} onCheckedChange={(checked) => handleConfigChange({ saveToDatabase: checked })} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Post Replies to Reddit</Label>
                <div className="text-xs text-gray-500">Actually post generated replies to Reddit</div>
              </div>
              <Switch checked={config.postToReddit} onCheckedChange={(checked) => handleConfigChange({ postToReddit: checked })} />
            </div>
            {config.postToReddit && (
              <div className="flex items-center justify-between pl-6">
                <div>
                  <Label>Require Manual Approval</Label>
                  <div className="text-xs text-gray-500">Review replies before posting</div>
                </div>
                <Switch checked={config.requireApproval} onCheckedChange={(checked) => handleConfigChange({ requireApproval: checked })} />
              </div>
            )}
            <div className="flex items-center justify-between">
              <div>
                <Label>Send Webhook</Label>
                <div className="text-xs text-gray-500">Send results to external URL</div>
              </div>
              <Switch checked={config.sendWebhook} onCheckedChange={(checked) => handleConfigChange({ sendWebhook: checked })} />
            </div>
            {config.sendWebhook && (
              <div className="pl-6">
                <Label htmlFor="webhook-url">Webhook URL</Label>
                <Input id="webhook-url" type="url" value={config.webhookUrl ?? ""} onChange={(e) => handleConfigChange({ webhookUrl: e.target.value })} placeholder="https://your-app.com/webhook" />
              </div>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <>
      {/* Progress Bar - brand colors, compact */}
      <div className="mb-8 flex items-center">
        {WORKFLOW_STEPS.map((step, idx) => (
          <div key={step.id} className="flex items-center">
            <div className="flex items-center">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${idx <= currentStep ? 'bg-brand-orange-500 text-white' : 'bg-gray-200 text-gray-600'}`}>
                {idx < currentStep ? <Check size={14} /> : idx + 1}
              </div>
              <div className="ml-2">
                <div className={`text-xs font-medium leading-none whitespace-nowrap ${idx <= currentStep ? 'text-brand-gray-900' : 'text-gray-500'}`}>{step.title}</div>
              </div>
            </div>
            {idx < WORKFLOW_STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mx-3 ${idx < currentStep ? 'bg-brand-orange-500' : 'bg-gray-200'}`} />
            )}
          </div>
        ))}
      </div>

      <Card className="p-6">
        {WORKFLOW_STEPS[currentStep] && (
          <>
            <h2 className="mb-1 text-lg font-semibold">{WORKFLOW_STEPS[currentStep].title}</h2>
            <p className="mb-6 text-sm text-gray-600">{WORKFLOW_STEPS[currentStep].description}</p>
            {renderStepContent()}
          </>
        )}
      </Card>

      <div className="mt-6 flex justify-between">
        <Button variant="outline" onClick={prevStep} disabled={currentStep === 0}>Back</Button>
        {currentStep < WORKFLOW_STEPS.length - 1 ? (
          <Button onClick={nextStep}>Continue</Button>
        ) : (
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? (
              <div className="mr-1 h-4 w-4 animate-spin rounded-full border-b-2 border-white"></div>
            ) : null}
            {submitLabel}
          </Button>
        )}
      </div>
    </>
  );
}

export default AutomationForm;
