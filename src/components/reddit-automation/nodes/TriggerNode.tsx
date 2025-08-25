"use client";

import { type NodeProps } from "@xyflow/react";
import { Play } from "lucide-react";
import { BaseNode } from "./BaseNode";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface TriggerNodeConfig {
  type?: "manual" | "schedule" | "webhook";
  schedule?: string;
  webhookUrl?: string;
}

export function TriggerNode(props: NodeProps) {
  const data = props.data as {
    config: TriggerNodeConfig;
    onConfigChange: (config: Record<string, unknown>) => void;
    onDelete?: () => void;
    onDuplicate?: () => void;
    readOnly?: boolean;
  };

  const handleConfigChange = (updates: Partial<TriggerNodeConfig>) => {
    data.onConfigChange({
      ...data.config,
      ...updates,
    });
  };

  return (
    <BaseNode
      {...props}
      data={data}
      title="Trigger"
      icon={<Play className="w-4 h-4" />}
      color="#059669"
      hasTargetHandle={false}
    >
      <div className="space-y-3">
        <div>
          <Label htmlFor="trigger-type">Trigger Type</Label>
          <Select
            value={data.config.type ?? "manual"}
            onValueChange={(value: "manual" | "schedule" | "webhook") =>
              handleConfigChange({ type: value })
            }
            disabled={data.readOnly}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select trigger type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="manual">Manual</SelectItem>
              <SelectItem value="schedule">Schedule (Coming Soon)</SelectItem>
              <SelectItem value="webhook">Webhook (Coming Soon)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="text-sm text-gray-600">
          {data.config.type === "manual" && (
            <p>This workflow will be triggered manually when you click the execute button.</p>
          )}
          {data.config.type === "schedule" && (
            <p className="text-yellow-600">Scheduled triggers are coming in a future update.</p>
          )}
          {data.config.type === "webhook" && (
            <p className="text-yellow-600">Webhook triggers are coming in a future update.</p>
          )}
        </div>
      </div>
    </BaseNode>
  );
}