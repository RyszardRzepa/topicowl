"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Lightbulb, Users, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ArticleIdea } from "@/app/api/articles/generate-ideas/route";

interface ArticleIdeaCardProps {
  idea: ArticleIdea;
  onAddToPipeline: (idea: ArticleIdea) => Promise<void>;
  isSelected?: boolean;
  onSelectionChange?: (selected: boolean) => void;
  className?: string;
}

const contentAngleIcons = {
  "how-to": Lightbulb,
  "listicle": TrendingUp,
  "case-study": Users,
  "guide": Lightbulb,
  "comparison": TrendingUp,
  "review": Users,
  "tutorial": Lightbulb,
  "analysis": TrendingUp,
} as const;

const difficultyColors = {
  beginner: "bg-brand-green/10 text-brand-green border-brand-green/20",
  intermediate: "bg-brand-orange/10 text-brand-orange border-brand-orange/20",
  advanced: "bg-red-100 text-red-800 border-red-200",
} as const;

export function ArticleIdeaCard({
  idea,
  onAddToPipeline,
  isSelected = false,
  onSelectionChange,
  className,
}: ArticleIdeaCardProps) {
  const [isAdding, setIsAdding] = useState(false);

  const handleAddToPipeline = async () => {
    setIsAdding(true);
    try {
      await onAddToPipeline(idea);
    } catch (error) {
      console.error("Failed to add idea to pipeline:", error);
    } finally {
      setIsAdding(false);
    }
  };

  const handleSelectionChange = () => {
    if (onSelectionChange) {
      onSelectionChange(!isSelected);
    }
  };

  const ContentAngleIcon = contentAngleIcons[idea.contentAngle as keyof typeof contentAngleIcons] || Lightbulb;

  return (
    <Card
      className={cn(
        "transition-all duration-200 hover:shadow-md",
        {
          "ring-2 ring-brand-green ring-offset-2": isSelected,
        },
        className,
      )}
    >
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className="line-clamp-2 text-lg leading-tight">
              {idea.title}
            </CardTitle>
            
            {/* Content angle and difficulty indicators */}
            <div className="flex items-center gap-2 mt-2">
              <div className="flex items-center gap-1 text-sm text-stone-600">
                <ContentAngleIcon className="h-4 w-4" />
                <span className="capitalize">{idea.contentAngle.replace('-', ' ')}</span>
              </div>
              <Badge
                variant="outline"
                className={cn("text-xs", difficultyColors[idea.estimatedDifficulty])}
              >
                {idea.estimatedDifficulty}
              </Badge>
            </div>
          </div>

          {/* Selection checkbox for bulk operations */}
          {onSelectionChange && (
            <div className="flex-shrink-0">
              <input
                type="checkbox"
                checked={isSelected}
                onChange={handleSelectionChange}
                className="h-4 w-4 rounded border-stone-300 text-brand-green focus:ring-brand-green"
              />
            </div>
          )}
        </div>

        <CardDescription className="line-clamp-3 text-sm leading-relaxed">
          {idea.description}
        </CardDescription>
      </CardHeader>

      <CardContent>
        {/* Target audience */}
        {idea.targetAudience && (
          <div className="mb-3">
            <div className="flex items-center gap-1 text-xs text-stone-500 mb-1">
              <Users className="h-3 w-3" />
              Target Audience
            </div>
            <p className="text-sm text-stone-700">{idea.targetAudience}</p>
          </div>
        )}

        {/* Keywords */}
        {idea.keywords && idea.keywords.length > 0 && (
          <div>
            <div className="flex items-center gap-1 text-xs text-stone-500 mb-2">
              <TrendingUp className="h-3 w-3" />
              Keywords
            </div>
            <div className="flex flex-wrap gap-1">
              {idea.keywords.slice(0, 4).map((keyword, index) => (
                <Badge key={index} variant="secondary" className="text-xs bg-stone-100 text-stone-700 border-stone-200">
                  {keyword}
                </Badge>
              ))}
              {idea.keywords.length > 4 && (
                <Badge variant="secondary" className="text-xs bg-stone-100 text-stone-700 border-stone-200">
                  +{idea.keywords.length - 4} more
                </Badge>
              )}
            </div>
          </div>
        )}
      </CardContent>

      <CardFooter>
        <Button
          onClick={handleAddToPipeline}
          disabled={isAdding}
          size="sm"
          className="w-full bg-brand-green hover:bg-brand-green/90 text-white"
        >
          <Plus className="mr-2 h-4 w-4" />
          {isAdding ? "Adding..." : "Add to Pipeline"}
        </Button>
      </CardFooter>
    </Card>
  );
}