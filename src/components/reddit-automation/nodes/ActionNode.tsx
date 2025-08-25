"use client";

import { type NodeProps } from "@xyflow/react";
import { Zap, Database, Globe, Download } from "lucide-react";
import { BaseNode } from "./BaseNode";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ActionNodeData {
  config: {
    saveToDatabase?: boolean;
    sendWebhook?: boolean;
    webhookUrl?: string;
    exportResults?: boolean;
    exportFormat?: "json" | "csv";
    postToReddit?: boolean;
    requireApproval?: boolean;
  };
  onConfigChange: (config: Record<string, unknown>) => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  readOnly?: boolean;
}

export function ActionNode({ data }: NodeProps<ActionNodeData>) {
  const handleConfigChange = (updates: Partial<ActionNodeData["config"]>) => {
    data.onConfigChange({
      ...data.config,
      ...updates,
    });
  };

  return (
    <BaseNode
      data={data}
      title="Action"
      icon={<Zap className="w-4 h-4" />}
      color="#ea580c"
      hasSourceHandle={false}
    >
      <div className="space-y-4">
        {/* Save to Database */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Database className="w-4 h-4 text-gray-500" />
            <Label htmlFor="save-database">Save Results to Database</Label>
          </div>
          <Switch
            id="save-database"
            checked={data.config.saveToDatabase ?? true}
            onCheckedChange={(checked) => 
              handleConfigChange({ saveToDatabase: checked })
            }
            disabled={data.readOnly}
          />
        </div>
        
        {data.config.saveToDatabase && (
          <div className="text-xs text-gray-500 pl-6">
            Execution results will be stored for future reference and analytics.
          </div>
        )}

        {/* Post to Reddit */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Globe className="w-4 h-4 text-gray-500" />
            <Label htmlFor="post-reddit">Post Replies to Reddit</Label>
          </div>
          <Switch
            id="post-reddit"
            checked={data.config.postToReddit ?? false}
            onCheckedChange={(checked) => 
              handleConfigChange({ postToReddit: checked })
            }
            disabled={data.readOnly}
          />
        </div>

        {data.config.postToReddit && (
          <>
            <div className="text-xs text-yellow-600 pl-6">
              ⚠️ Be careful with automated posting - always follow Reddit's terms of service and community guidelines.
            </div>
            
            <div className="flex items-center justify-between pl-6">
              <Label htmlFor="require-approval">Require Manual Approval</Label>
              <Switch
                id="require-approval"
                checked={data.config.requireApproval ?? true}
                onCheckedChange={(checked) => 
                  handleConfigChange({ requireApproval: checked })
                }
                disabled={data.readOnly}
              />
            </div>

            {data.config.requireApproval && (
              <div className="text-xs text-gray-500 pl-12">
                Replies will be queued for manual review before posting.
              </div>
            )}
          </>
        )}

        {/* Send Webhook */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Globe className="w-4 h-4 text-gray-500" />
            <Label htmlFor="send-webhook">Send Webhook</Label>
          </div>
          <Switch
            id="send-webhook"
            checked={data.config.sendWebhook ?? false}
            onCheckedChange={(checked) => 
              handleConfigChange({ sendWebhook: checked })
            }
            disabled={data.readOnly}
          />
        </div>

        {data.config.sendWebhook && (
          <div className="pl-6">
            <Label htmlFor="webhook-url">Webhook URL</Label>
            <Input
              id="webhook-url"
              type="url"
              value={data.config.webhookUrl ?? ""}
              onChange={(e) => handleConfigChange({ webhookUrl: e.target.value })}
              placeholder="https://your-app.com/webhook"
              disabled={data.readOnly}
            />
            <div className="text-xs text-gray-500 mt-1">
              Results will be sent as JSON POST request to this URL.
            </div>
          </div>
        )}

        {/* Export Results */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Download className="w-4 h-4 text-gray-500" />
            <Label htmlFor="export-results">Export Results</Label>
          </div>
          <Switch
            id="export-results"
            checked={data.config.exportResults ?? false}
            onCheckedChange={(checked) => 
              handleConfigChange({ exportResults: checked })
            }
            disabled={data.readOnly}
          />
        </div>

        {data.config.exportResults && (
          <div className="pl-6">
            <Label htmlFor="export-format">Export Format</Label>
            <Select
              value={data.config.exportFormat ?? "json"}
              onValueChange={(value: "json" | "csv") =>
                handleConfigChange({ exportFormat: value })
              }
              disabled={data.readOnly}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select format" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="json">JSON</SelectItem>
                <SelectItem value="csv">CSV</SelectItem>
              </SelectContent>
            </Select>
            <div className="text-xs text-gray-500 mt-1">
              Results will be available for download after execution.
            </div>
          </div>
        )}

        {/* Summary */}
        <div className="bg-blue-50 p-3 rounded text-sm">
          <div className="font-medium text-blue-900 mb-1">Action Summary:</div>
          <ul className="text-blue-800 text-xs space-y-1">
            {data.config.saveToDatabase && <li>• Save results to database</li>}
            {data.config.postToReddit && (
              <li>
                • Post replies to Reddit 
                {data.config.requireApproval && " (with approval)"}
              </li>
            )}
            {data.config.sendWebhook && <li>• Send webhook notification</li>}
            {data.config.exportResults && <li>• Export results as {data.config.exportFormat?.toUpperCase()}</li>}
          </ul>
        </div>
      </div>
    </BaseNode>
  );
}