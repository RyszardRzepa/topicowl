"use client";

import { useState, useCallback } from "react";
import { type NodeProps } from "@xyflow/react";
import { Search, Plus, X } from "lucide-react";
import { BaseNode } from "./BaseNode";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SearchNodeData {
  config: {
    subreddit?: string;
    keywords?: string[];
    timeRange?: "24h" | "7d" | "30d";
    maxResults?: number;
  };
  onConfigChange: (config: Record<string, unknown>) => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  readOnly?: boolean;
}

export function SearchNode({ data }: NodeProps<SearchNodeData>) {
  const [keywordInput, setKeywordInput] = useState("");

  const handleConfigChange = (updates: Partial<SearchNodeData["config"]>) => {
    data.onConfigChange({
      ...data.config,
      ...updates,
    });
  };

  const addKeyword = useCallback(() => {
    if (!keywordInput.trim()) return;
    
    const currentKeywords = data.config.keywords ?? [];
    if (!currentKeywords.includes(keywordInput.trim())) {
      handleConfigChange({
        keywords: [...currentKeywords, keywordInput.trim()],
      });
    }
    setKeywordInput("");
  }, [keywordInput, data.config.keywords]);

  const removeKeyword = useCallback((keyword: string) => {
    const currentKeywords = data.config.keywords ?? [];
    handleConfigChange({
      keywords: currentKeywords.filter((k) => k !== keyword),
    });
  }, [data.config.keywords]);

  const handleKeywordInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addKeyword();
    }
  };

  return (
    <BaseNode
      data={data}
      title="Reddit Search"
      icon={<Search className="w-4 h-4" />}
      color="#2563eb"
    >
      <div className="space-y-4">
        {/* Subreddit */}
        <div>
          <Label htmlFor="subreddit">Subreddit</Label>
          <Input
            id="subreddit"
            value={data.config.subreddit ?? ""}
            onChange={(e) => handleConfigChange({ subreddit: e.target.value })}
            placeholder="e.g., technology, startups"
            disabled={data.readOnly}
          />
          <div className="text-xs text-gray-500 mt-1">
            Enter subreddit name without "r/"
          </div>
        </div>

        {/* Keywords */}
        <div>
          <Label>Keywords (Optional)</Label>
          <div className="flex space-x-2">
            <Input
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
              onKeyDown={handleKeywordInputKeyDown}
              placeholder="Add keyword..."
              className="flex-1"
              disabled={data.readOnly}
            />
            <Button 
              onClick={addKeyword}
              variant="outline"
              size="sm"
              disabled={data.readOnly}
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          
          {data.config.keywords && data.config.keywords.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {data.config.keywords.map((keyword) => (
                <Badge key={keyword} variant="secondary" className="flex items-center gap-1">
                  {keyword}
                  {!data.readOnly && (
                    <X 
                      className="w-3 h-3 cursor-pointer" 
                      onClick={() => removeKeyword(keyword)}
                    />
                  )}
                </Badge>
              ))}
            </div>
          )}
          <div className="text-xs text-gray-500 mt-1">
            Filter posts by keywords in title or content
          </div>
        </div>

        {/* Time Range */}
        <div>
          <Label htmlFor="time-range">Time Range</Label>
          <Select
            value={data.config.timeRange ?? "24h"}
            onValueChange={(value: "24h" | "7d" | "30d") =>
              handleConfigChange({ timeRange: value })
            }
            disabled={data.readOnly}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select time range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">Last 24 hours</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Max Results */}
        <div>
          <Label htmlFor="max-results">Max Results</Label>
          <Input
            id="max-results"
            type="number"
            min="1"
            max="100"
            value={data.config.maxResults ?? 10}
            onChange={(e) => handleConfigChange({ maxResults: parseInt(e.target.value) || 10 })}
            disabled={data.readOnly}
          />
          <div className="text-xs text-gray-500 mt-1">
            Maximum number of posts to fetch (1-100)
          </div>
        </div>
      </div>
    </BaseNode>
  );
}