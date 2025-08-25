"use client";

import { useState } from "react";
import { type NodeProps } from "@xyflow/react";
import { MessageSquare, Edit, Eye } from "lucide-react";
import { BaseNode } from "./BaseNode";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface ReplyNodeData {
  config: {
    prompt?: string;
    variables?: Record<string, string>;
    toneOfVoice?: string;
    maxLength?: number;
  };
  onConfigChange: (config: Record<string, unknown>) => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  readOnly?: boolean;
}

const DEFAULT_REPLY_PROMPT = `You are a helpful community member representing {{companyName}}.

Company: {{companyName}}
Product/Service: {{productDescription}}
Tone: {{toneOfVoice}}

Generate a helpful, authentic reply to this Reddit post. Your reply should:
1. Be genuinely helpful and add value to the conversation
2. NOT be overly promotional or spammy
3. Follow Reddit's community guidelines and etiquette
4. Feel natural and conversational
5. Only mention your product/service if it's genuinely relevant and helpful

Guidelines:
- Keep replies concise but informative
- Show genuine interest in helping the user
- Avoid sales-y language
- Be respectful of the community
- If your product isn't relevant, provide general helpful advice instead

POST CONTEXT:
Title: {{postTitle}}
Content: {{postContent}}
Subreddit: r/{{subreddit}}
Author: {{author}}

Generate a helpful reply that adds value to this conversation.`;

const TONE_OPTIONS = [
  { value: "helpful", label: "Helpful" },
  { value: "professional", label: "Professional" },
  { value: "casual", label: "Casual" },
  { value: "technical", label: "Technical" },
  { value: "friendly", label: "Friendly" },
];

export function ReplyNode({ data }: NodeProps<ReplyNodeData>) {
  const [isPromptEditorOpen, setIsPromptEditorOpen] = useState(false);
  const [promptText, setPromptText] = useState(
    data.config.prompt ?? DEFAULT_REPLY_PROMPT
  );

  const handleConfigChange = (updates: Partial<ReplyNodeData["config"]>) => {
    data.onConfigChange({
      ...data.config,
      ...updates,
    });
  };

  const handleSavePrompt = () => {
    handleConfigChange({ prompt: promptText });
    setIsPromptEditorOpen(false);
  };

  const handleVariableChange = (key: string, value: string) => {
    const currentVariables = data.config.variables ?? {};
    handleConfigChange({
      variables: {
        ...currentVariables,
        [key]: value,
      },
    });
  };

  const currentPrompt = data.config.prompt ?? DEFAULT_REPLY_PROMPT;
  const variables = data.config.variables ?? {};

  return (
    <BaseNode
      data={data}
      title="Reply Generation"
      icon={<MessageSquare className="w-4 h-4" />}
      color="#dc2626"
    >
      <div className="space-y-4">
        {/* Tone of Voice */}
        <div>
          <Label htmlFor="tone">Tone of Voice</Label>
          <Select
            value={data.config.toneOfVoice ?? "helpful"}
            onValueChange={(value) => handleConfigChange({ toneOfVoice: value })}
            disabled={data.readOnly}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select tone" />
            </SelectTrigger>
            <SelectContent>
              {TONE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Max Length */}
        <div>
          <Label htmlFor="max-length">Max Reply Length (chars)</Label>
          <Input
            id="max-length"
            type="number"
            min="100"
            max="2000"
            value={data.config.maxLength ?? 500}
            onChange={(e) => 
              handleConfigChange({ 
                maxLength: parseInt(e.target.value) || 500 
              })
            }
            disabled={data.readOnly}
          />
          <div className="text-xs text-gray-500 mt-1">
            Keep replies concise - Reddit users prefer shorter responses
          </div>
        </div>

        {/* Variables */}
        <div>
          <Label>Variables</Label>
          <div className="space-y-2">
            <div>
              <Input
                placeholder="Company Name"
                value={variables.companyName ?? ""}
                onChange={(e) => handleVariableChange("companyName", e.target.value)}
                disabled={data.readOnly}
              />
            </div>
            <div>
              <Input
                placeholder="Product Description"
                value={variables.productDescription ?? ""}
                onChange={(e) => handleVariableChange("productDescription", e.target.value)}
                disabled={data.readOnly}
              />
            </div>
            <div>
              <Input
                placeholder="Your Role/Expertise"
                value={variables.userRole ?? ""}
                onChange={(e) => handleVariableChange("userRole", e.target.value)}
                disabled={data.readOnly}
              />
            </div>
          </div>
          <div className="text-xs text-gray-500 mt-1">
            These variables will be substituted in the prompt
          </div>
        </div>

        {/* Prompt Editor */}
        <div>
          <Label>Reply Generation Prompt</Label>
          <div className="flex space-x-2">
            <Dialog open={isPromptEditorOpen} onOpenChange={setIsPromptEditorOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" disabled={data.readOnly}>
                  <Edit className="w-4 h-4 mr-1" />
                  Edit Prompt
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Edit Reply Generation Prompt</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Prompt Template</Label>
                    <Textarea
                      value={promptText}
                      onChange={(e) => setPromptText(e.target.value)}
                      className="min-h-[400px] font-mono text-sm"
                      placeholder="Enter your reply generation prompt..."
                    />
                    <div className="text-xs text-gray-500 mt-2">
                      Available context variables: {{postTitle}}, {{postContent}}, {{subreddit}}, {{author}}
                      <br />
                      Custom variables: {{companyName}}, {{productDescription}}, {{userRole}}, {{toneOfVoice}}
                    </div>
                  </div>
                  <div className="flex justify-end space-x-2">
                    <Button 
                      variant="outline" 
                      onClick={() => setIsPromptEditorOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button onClick={handleSavePrompt}>
                      Save Prompt
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <Button variant="outline" size="sm">
              <Eye className="w-4 h-4 mr-1" />
              Preview
            </Button>
          </div>
          
          <div className="text-xs text-gray-500 mt-1">
            {data.config.prompt 
              ? "Using custom prompt" 
              : "Using default reply generation prompt"
            }
          </div>
        </div>

        {/* Prompt Preview */}
        <div className="bg-gray-50 p-3 rounded text-sm">
          <div className="font-mono text-xs whitespace-pre-wrap line-clamp-4">
            {currentPrompt.substring(0, 150)}...
          </div>
        </div>
      </div>
    </BaseNode>
  );
}