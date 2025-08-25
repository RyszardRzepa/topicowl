"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Settings, Copy, Trash2 } from "lucide-react";

interface BaseNodeData {
  config: Record<string, unknown>;
  onConfigChange: (config: Record<string, unknown>) => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  readOnly?: boolean;
}

interface BaseNodeProps extends NodeProps {
  data: BaseNodeData;
  title: string;
  icon: React.ReactNode;
  color: string;
  children: React.ReactNode;
  hasTargetHandle?: boolean;
  hasSourceHandle?: boolean;
}

export function BaseNode({
  data,
  title,
  icon,
  color,
  children,
  hasTargetHandle = true,
  hasSourceHandle = true,
}: BaseNodeProps) {
  return (
    <div className="relative">
      {hasTargetHandle && (
        <Handle
          type="target"
          position={Position.Left}
          className="w-3 h-3"
          style={{ background: color }}
        />
      )}

      <Card className="w-80 shadow-lg border-2" style={{ borderColor: color }}>
        <div
          className="px-4 py-2 rounded-t-lg text-white font-medium flex items-center justify-between"
          style={{ backgroundColor: color }}
        >
          <div className="flex items-center">
            {icon}
            <span className="ml-2">{title}</span>
          </div>
          
          {!data.readOnly && (
            <div className="flex items-center space-x-1">
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0 text-white hover:bg-white/20"
                onClick={data.onDuplicate}
              >
                <Copy className="h-3 w-3" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0 text-white hover:bg-white/20"
                onClick={data.onDelete}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>

        <div className="p-4">
          {children}
        </div>
      </Card>

      {hasSourceHandle && (
        <Handle
          type="source"
          position={Position.Right}
          className="w-3 h-3"
          style={{ background: color }}
        />
      )}
    </div>
  );
}