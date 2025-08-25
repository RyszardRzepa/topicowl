"use client";

import { useState } from "react";
import { type NodeProps } from "@xyflow/react";
import { Brain, Edit, Eye } from "lucide-react";
import { BaseNode } from "./BaseNode";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface EvaluationNodeData {
  config: {
    prompt?: string;
    variables?: Record<string, string>;
    passThreshold?: number;
  };
  onConfigChange: (config: Record<string, unknown>) => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  readOnly?: boolean;
}

const DEFAULT_EVALUATION_PROMPT = `You are an expert at evaluating Reddit posts for business relevance and engagement potential.

Company: {{companyName}}
Product/Service: {{productDescription}}

For each Reddit post, evaluate:
1. Relevance to our business (0-10)
2. Engagement potential (0-10) 
3. Appropriateness for our brand to reply (0-10)
4. Overall recommendation to reply (true/false)

Consider factors like:
- Post topic alignment with our business
- Community size and engagement
- Post tone and quality
- Opportunity for helpful, non-spammy contribution
- Subreddit rules and culture

Return JSON format:
{
  "score": number (0-10 overall score),
  "reasoning": "detailed explanation",
  "shouldReply": boolean
}`;

export function EvaluationNode({ data }: NodeProps<EvaluationNodeData>) {
  const [isPromptEditorOpen, setIsPromptEditorOpen] = useState(false);
  const [promptText, setPromptText] = useState(
    data.config.prompt ?? DEFAULT_EVALUATION_PROMPT
  );

  const handleConfigChange = (updates: Partial<EvaluationNodeData["config"]>) => {
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

  const currentPrompt = data.config.prompt ?? DEFAULT_EVALUATION_PROMPT;
  const variables = data.config.variables ?? {};

  return (
    <BaseNode
      data={data}
      title="Post Evaluation"
      icon={<Brain className="w-4 h-4" />}
      color="#7c3aed"
    >
      <div className="space-y-4">
        {/* Pass Threshold */}
        <div>
          <Label htmlFor="pass-threshold">Pass Score Threshold</Label>
          <Input
            id="pass-threshold"
            type="number"
            min="0"
            max="10"
            step="0.1"
            value={data.config.passThreshold ?? 6.0}
            onChange={(e) => 
              handleConfigChange({ 
                passThreshold: parseFloat(e.target.value) || 6.0 
              })
            }
            disabled={data.readOnly}
          />
          <div className="text-xs text-gray-500 mt-1">
            Posts scoring above this threshold will proceed to reply generation
          </div>
        </div>

        {/* Common Variables */}
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
                placeholder="Keywords (comma-separated)"
                value={variables.keywords ?? ""}
                onChange={(e) => handleVariableChange("keywords", e.target.value)}
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
          <Label>Evaluation Prompt</Label>
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
                  <DialogTitle>Edit Evaluation Prompt</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Prompt Template</Label>
                    <Textarea
                      value={promptText}
                      onChange={(e) => setPromptText(e.target.value)}
                      className="min-h-[400px] font-mono text-sm"
                      placeholder="Enter your evaluation prompt..."
                    />
                    <div className="text-xs text-gray-500 mt-2">
                      Available variables: {{companyName}}, {{productDescription}}, {{keywords}}
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
              : "Using default evaluation prompt"
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