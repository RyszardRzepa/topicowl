"use client";

import { useCallback, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type OnConnect,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Play,
  Save,
  Plus,
  Settings,
  Copy,
  Trash2,
  FileText,
} from "lucide-react";

// Workflow node types
export interface WorkflowNode {
  id: string;
  type: "trigger" | "search" | "evaluate" | "reply" | "action";
  config: Record<string, unknown>;
  position: { x: number; y: number };
}

interface WorkflowBuilderProps {
  initialWorkflow?: WorkflowNode[];
  onSave?: (workflow: WorkflowNode[], name: string, description?: string) => void;
  onExecute?: (workflow: WorkflowNode[], dryRun?: boolean) => void;
  readOnly?: boolean;
  projectId: number;
}

const initialNodes: Node[] = [
  {
    id: "trigger-1",
    type: "default",
    position: { x: 100, y: 100 },
    data: { 
      label: "Manual Trigger",
      nodeType: "trigger",
      config: { type: "manual" },
    },
    style: {
      background: '#059669',
      color: 'white',
      border: '1px solid #059669',
      width: 200,
    },
  },
];

const initialEdges: Edge[] = [];

export function WorkflowBuilder({
  initialWorkflow,
  onSave,
  onExecute,
  readOnly = false,
  projectId,
}: WorkflowBuilderProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Workflow metadata
  const [workflowName, setWorkflowName] = useState("");
  const [workflowDescription, setWorkflowDescription] = useState("");
  const [isExecuting, setIsExecuting] = useState(false);

  const onConnect: OnConnect = useCallback(
    (params) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const addNode = useCallback(
    (nodeType: "search" | "evaluate" | "reply" | "action") => {
      const nodeConfig = {
        search: {
          label: "Reddit Search",
          background: "#2563eb",
          config: { subreddit: "", keywords: [], timeRange: "24h", maxResults: 10 },
        },
        evaluate: {
          label: "Post Evaluation",
          background: "#7c3aed",
          config: { passThreshold: 6.0, variables: {} },
        },
        reply: {
          label: "Reply Generation",
          background: "#dc2626",
          config: { toneOfVoice: "helpful", maxLength: 500, variables: {} },
        },
        action: {
          label: "Action",
          background: "#ea580c",
          config: { saveToDatabase: true, postToReddit: false, requireApproval: true },
        },
      }[nodeType];

      const newNode: Node = {
        id: `${nodeType}-${Date.now()}`,
        type: "default",
        position: { x: Math.random() * 400 + 200, y: Math.random() * 400 + 200 },
        data: {
          label: nodeConfig.label,
          nodeType: nodeType,
          config: nodeConfig.config,
        },
        style: {
          background: nodeConfig.background,
          color: 'white',
          border: `1px solid ${nodeConfig.background}`,
          width: 200,
        },
      };
      
      setNodes((nodes) => [...nodes, newNode]);
    },
    [setNodes]
  );

  const deleteNode = useCallback(
    (nodeId: string) => {
      setNodes((nodes) => nodes.filter((node) => node.id !== nodeId));
      setEdges((edges) => edges.filter((edge) => 
        edge.source !== nodeId && edge.target !== nodeId
      ));
    },
    [setNodes, setEdges]
  );

  const handleSave = useCallback(() => {
    if (!workflowName.trim()) {
      toast.error("Please enter a workflow name");
      return;
    }

    const workflow: WorkflowNode[] = nodes.map((node) => ({
      id: node.id,
      type: node.data.nodeType as WorkflowNode["type"],
      config: node.data.config || {} as Record<string, unknown>,
      position: node.position,
    }));

    onSave?.(workflow, workflowName, workflowDescription);
  }, [nodes, workflowName, workflowDescription, onSave]);

  const handleExecute = useCallback(
    async (dryRun = false) => {
      if (nodes.length === 0) {
        toast.error("Please add nodes to the workflow");
        return;
      }

      setIsExecuting(true);
      try {
        const workflow: WorkflowNode[] = nodes.map((node) => ({
          id: node.id,
          type: node.data.nodeType as WorkflowNode["type"],
          config: node.data.config || {} as Record<string, unknown>,
          position: node.position,
        }));

        await onExecute?.(workflow, dryRun);
        toast.success(
          dryRun ? "Workflow test completed" : "Workflow executed successfully"
        );
      } catch (error) {
        toast.error(
          `Workflow execution failed: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      } finally {
        setIsExecuting(false);
      }
    },
    [nodes, onExecute]
  );

  return (
    <div className="h-screen flex flex-col">
      {/* Toolbar */}
      <div className="border-b border-gray-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div>
              <Label htmlFor="workflow-name">Workflow Name</Label>
              <Input
                id="workflow-name"
                value={workflowName}
                onChange={(e) => setWorkflowName(e.target.value)}
                placeholder="Enter workflow name..."
                className="w-64"
                disabled={readOnly}
              />
            </div>
            <div>
              <Label htmlFor="workflow-description">Description (Optional)</Label>
              <Input
                id="workflow-description"
                value={workflowDescription}
                onChange={(e) => setWorkflowDescription(e.target.value)}
                placeholder="Describe this workflow..."
                className="w-80"
                disabled={readOnly}
              />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {!readOnly && (
              <>
                <Button
                  onClick={() => handleExecute(true)}
                  variant="outline"
                  disabled={isExecuting}
                >
                  <FileText className="w-4 h-4 mr-1" />
                  Test Run
                </Button>
                <Button
                  onClick={() => handleExecute(false)}
                  disabled={isExecuting}
                >
                  <Play className="w-4 h-4 mr-1" />
                  Execute
                </Button>
                <Button onClick={handleSave} variant="outline">
                  <Save className="w-4 h-4 mr-1" />
                  Save
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-1">
        {/* Node Palette */}
        {!readOnly && (
          <div className="w-64 border-r border-gray-200 bg-gray-50 p-4">
            <h3 className="font-semibold text-sm mb-4">Add Nodes</h3>
            <div className="space-y-2">
              <Button
                onClick={() => addNode("search")}
                variant="outline"
                className="w-full justify-start"
              >
                <Plus className="w-4 h-4 mr-2" />
                Reddit Search
              </Button>
              <Button
                onClick={() => addNode("evaluate")}
                variant="outline"
                className="w-full justify-start"
              >
                <Plus className="w-4 h-4 mr-2" />
                Evaluation
              </Button>
              <Button
                onClick={() => addNode("reply")}
                variant="outline"
                className="w-full justify-start"
              >
                <Plus className="w-4 h-4 mr-2" />
                Reply Generation
              </Button>
              <Button
                onClick={() => addNode("action")}
                variant="outline"
                className="w-full justify-start"
              >
                <Plus className="w-4 h-4 mr-2" />
                Action
              </Button>
            </div>

            <div className="mt-8">
              <h3 className="font-semibold text-sm mb-4">Workflow Stats</h3>
              <div className="space-y-2 text-sm text-gray-600">
                <div>Nodes: {nodes.length}</div>
                <div>Connections: {edges.length}</div>
              </div>
            </div>

            <div className="mt-8">
              <h3 className="font-semibold text-sm mb-4">Instructions</h3>
              <div className="text-xs text-gray-600 space-y-2">
                <p>1. Add nodes from the palette above</p>
                <p>2. Connect nodes by dragging from output to input</p>
                <p>3. Configure each node by double-clicking</p>
                <p>4. Save and execute your workflow</p>
              </div>
            </div>
          </div>
        )}

        {/* Workflow Canvas */}
        <div className="flex-1 relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            fitView
            className="bg-gray-50"
          >
            <Background />
            <Controls />
            <MiniMap />
          </ReactFlow>
        </div>
      </div>
    </div>
  );
}