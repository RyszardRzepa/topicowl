"use client";

import { useState, useCallback, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArticleIdeaCard } from "./article-idea-card";
import {
  Sparkles,
  RefreshCw,
  X,
  CheckSquare,
  Square,
  Loader2,
  AlertCircle,
} from "lucide-react";
import type {
  ArticleIdea,
  GenerateIdeasResponse,
} from "@/app/api/articles/generate-ideas/route";

interface ArticleIdeasGeneratorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onIdeaAdded: (idea: ArticleIdea) => Promise<void>;
}

interface GenerationState {
  isGenerating: boolean;
  ideas: ArticleIdea[];
  error: string | null;
  warning: string | null;
  requiresOnboarding: boolean;
}

// Local storage key for persisting generated ideas
const STORAGE_KEY = "contentbot-generated-ideas";

export function ArticleIdeasGenerator({
  open,
  onOpenChange,
  onIdeaAdded,
}: ArticleIdeasGeneratorProps) {
  const [state, setState] = useState<GenerationState>({
    isGenerating: false,
    ideas: [],
    error: null,
    warning: null,
    requiresOnboarding: false,
  });

  const [selectedIdeas, setSelectedIdeas] = useState<Set<number>>(new Set());
  const [isBulkAdding, setIsBulkAdding] = useState(false);

  // Load previously generated ideas from localStorage on component mount
  useEffect(() => {
    try {
      const savedIdeas = localStorage.getItem(STORAGE_KEY);
      if (savedIdeas) {
        const parsedIdeas = JSON.parse(savedIdeas) as ArticleIdea[];
        if (Array.isArray(parsedIdeas) && parsedIdeas.length > 0) {
          setState((prev) => ({
            ...prev,
            ideas: parsedIdeas,
          }));
        }
      }
    } catch (error) {
      console.error("Failed to load saved ideas from localStorage:", error);
      // Clear corrupted data
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  // Save ideas to localStorage whenever ideas change
  const saveIdeasToStorage = useCallback((ideas: ArticleIdea[]) => {
    try {
      if (ideas.length > 0) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(ideas));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (error) {
      console.error("Failed to save ideas to localStorage:", error);
    }
  }, []);

  const generateIdeas = useCallback(async () => {
    setState((prev) => ({
      ...prev,
      isGenerating: true,
      error: null,
      warning: null,
      requiresOnboarding: false,
    }));

    try {
      const response = await fetch("/api/articles/generate-ideas", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = (await response.json()) as GenerateIdeasResponse;

      if (!response.ok) {
        if (response.status === 400) {
          setState((prev) => ({
            ...prev,
            isGenerating: false,
            requiresOnboarding: true,
            error:
              data.error ??
              "Please complete your business profile to generate personalized article ideas.",
          }));
          return;
        }

        throw new Error(data.error ?? "Failed to generate article ideas");
      }

      setState((prev) => ({
        ...prev,
        isGenerating: false,
        ideas: data.ideas,
      }));

      // Save new ideas to localStorage
      saveIdeasToStorage(data.ideas);

      // Clear any previous selections
      setSelectedIdeas(new Set());
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isGenerating: false,
        error:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred",
      }));
    }
  }, [saveIdeasToStorage]);

  const handleIdeaSelection = useCallback(
    (index: number, selected: boolean) => {
      setSelectedIdeas((prev) => {
        const newSet = new Set(prev);
        if (selected) {
          newSet.add(index);
        } else {
          newSet.delete(index);
        }
        return newSet;
      });
    },
    [],
  );

  const handleSelectAll = useCallback(() => {
    if (selectedIdeas.size === state.ideas.length) {
      setSelectedIdeas(new Set());
    } else {
      setSelectedIdeas(new Set(state.ideas.map((_, index) => index)));
    }
  }, [selectedIdeas.size, state.ideas]);

  const handleBulkAddToPipeline = useCallback(async () => {
    if (selectedIdeas.size === 0) return;

    setIsBulkAdding(true);
    try {
      const selectedIdeaObjects = Array.from(selectedIdeas).map(
        (index) => state.ideas[index],
      );

      // Add ideas sequentially to avoid overwhelming the API
      for (const idea of selectedIdeaObjects) {
        if (idea) {
          await onIdeaAdded(idea);
        }
      }

      // Clear selections after successful bulk add
      setSelectedIdeas(new Set());
    } catch (error) {
      console.error("Failed to add ideas to pipeline:", error);
      // Don't clear selections on error so user can retry
    } finally {
      setIsBulkAdding(false);
    }
  }, [selectedIdeas, state.ideas, onIdeaAdded]);

  const handleSingleAddToPipeline = useCallback(
    async (idea: ArticleIdea) => {
      await onIdeaAdded(idea);
    },
    [onIdeaAdded],
  );

  const handleDismiss = useCallback(() => {
    setState((prev) => ({
      ...prev,
      ideas: [],
      error: null,
      warning: null,
      requiresOnboarding: false,
    }));
    setSelectedIdeas(new Set());
    // Clear saved ideas from localStorage
    saveIdeasToStorage([]);
  }, [saveIdeasToStorage]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] min-w-4/6 overflow-auto">
        <DialogHeader className="p-2">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-600" />
            AI Article Ideas Generator
          </DialogTitle>
          <DialogDescription>
            Generate personalized article ideas based on your business profile
            and keywords
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto p-2">
          {/* Initial state - no ideas generated yet */}
          {!state.isGenerating &&
            state.ideas.length === 0 &&
            !state.error &&
            !state.requiresOnboarding && (
              <div className="py-12 text-center">
                <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-blue-100">
                  <Sparkles className="h-8 w-8 text-blue-600" />
                </div>
                <h3 className="mb-2 text-lg font-medium text-gray-900">
                  Ready to Generate Ideas
                </h3>
                <p className="mx-auto mb-6 max-w-md text-gray-600">
                  Click the button below to generate 5 personalized article
                  ideas based on your business profile and keywords.
                </p>
                <Button
                  onClick={generateIdeas}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate Article Ideas
                </Button>
              </div>
            )}

          {/* Loading state */}
          {state.isGenerating && (
            <div className="py-12 text-center">
              <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-blue-100">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              </div>
              <h3 className="mb-2 text-lg font-medium text-gray-900">
                Generating Ideas...
              </h3>
              <p className="text-gray-600">
                Analyzing your business profile and generating personalized
                article suggestions
              </p>
            </div>
          )}

          {/* Error state */}
          {state.error && (
            <div className="py-12 text-center">
              <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-red-100">
                <AlertCircle className="h-8 w-8 text-red-600" />
              </div>
              <h3 className="mb-2 text-lg font-medium text-gray-900">
                {state.requiresOnboarding
                  ? "Profile Setup Required"
                  : "Generation Failed"}
              </h3>
              <p className="mx-auto mb-6 max-w-md text-gray-600">
                {state.error}
              </p>
              <div className="flex justify-center gap-2">
                {state.requiresOnboarding ? (
                  <Button
                    onClick={() => (window.location.href = "/onboarding")}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    Complete Profile Setup
                  </Button>
                ) : (
                  <Button
                    onClick={generateIdeas}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Try Again
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Results state */}
          {state.ideas.length > 0 && (
            <div className="space-y-6">
              {/* Warning message */}
              {state.warning && (
                <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-yellow-600" />
                    <p className="text-sm text-yellow-800">{state.warning}</p>
                  </div>
                </div>
              )}

              {/* Bulk actions header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <h3 className="text-lg font-medium text-gray-900">
                    Generated Ideas ({state.ideas.length})
                  </h3>

                  {/* Select all toggle */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSelectAll}
                    className="flex items-center gap-2"
                  >
                    {selectedIdeas.size === state.ideas.length ? (
                      <CheckSquare className="h-4 w-4" />
                    ) : (
                      <Square className="h-4 w-4" />
                    )}
                    {selectedIdeas.size === state.ideas.length
                      ? "Deselect All"
                      : "Select All"}
                  </Button>

                  {/* Selection count */}
                  {selectedIdeas.size > 0 && (
                    <Badge variant="secondary">
                      {selectedIdeas.size} selected
                    </Badge>
                  )}
                </div>

                {/* Bulk actions */}
                <div className="flex items-center gap-2">
                  {selectedIdeas.size > 0 && (
                    <Button
                      onClick={handleBulkAddToPipeline}
                      disabled={isBulkAdding}
                      size="sm"
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {isBulkAdding ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <CheckSquare className="mr-2 h-4 w-4" />
                      )}
                      Add Selected ({selectedIdeas.size})
                    </Button>
                  )}

                  <Button
                    onClick={generateIdeas}
                    disabled={state.isGenerating}
                    size="sm"
                    variant="outline"
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Regenerate
                  </Button>

                  <Button onClick={handleDismiss} size="sm" variant="outline">
                    <X className="mr-2 h-4 w-4" />
                    Dismiss
                  </Button>
                </div>
              </div>

              {/* Ideas grid */}
              <div className="grid gap-4 pb-2 md:grid-cols-2 lg:grid-cols-3">
                {state.ideas.map((idea, index) => (
                  <ArticleIdeaCard
                    key={index}
                    idea={idea}
                    onAddToPipeline={handleSingleAddToPipeline}
                    isSelected={selectedIdeas.has(index)}
                    onSelectionChange={(selected) =>
                      handleIdeaSelection(index, selected)
                    }
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
