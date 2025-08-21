"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { ArticleCard } from "./article-card";
import { ArticleIdeasGenerator } from "@/components/articles/article-ideas-generator";
import { Plus, Sparkles, Loader2 } from "lucide-react";
import type { Article } from "@/types";
import type { ArticleIdea } from "@/app/api/articles/generate-ideas/route";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";

interface PlanningHubProps {
  articles: Article[];
  onCreateArticle: (data: {
    title: string;
    keywords?: string[];
    description?: string;
    targetAudience?: string;
    notes?: string;
  }) => Promise<void>;
  onUpdateArticle: (
    articleId: string,
    updates: Partial<Article>,
  ) => Promise<void>;
  onDeleteArticle: (articleId: string) => Promise<void>;
  onGenerateArticle: (articleId: string) => Promise<void>;
  onScheduleGeneration: (articleId: string, scheduledAt: Date) => Promise<void>;
  onBulkGenerate: (articleIds: string[]) => Promise<void>;
  onBulkSchedule: (articleIds: string[], scheduledAt: Date) => Promise<void>;
  onNavigateToArticle: (articleId: string) => void;
}

export function PlanningHub({
  articles,
  onCreateArticle,
  onUpdateArticle,
  onDeleteArticle,
  onGenerateArticle,
  onScheduleGeneration,
  onBulkGenerate: _onBulkGenerate,
  onBulkSchedule: _onBulkSchedule,
  onNavigateToArticle,
}: PlanningHubProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [showIdeasGenerator, setShowIdeasGenerator] = useState(false);
  const [generatingArticleIds, setGeneratingArticleIds] = useState<Set<string>>(
    new Set(),
  );
  const [isCreatingArticle, setIsCreatingArticle] = useState(false);
  const [newArticleData, setNewArticleData] = useState({
    title: "",
    keywords: "",
    notes: "",
  });

  // Group articles by status for planning phase
  // Filter out articles that are already scheduled for generation
  const ideaArticles = articles.filter(
    (a) => a.status === "idea" && !a.generationScheduledAt,
  );
  const readyArticles = articles.filter(
    (a) => a.status === "to_generate" && !a.generationScheduledAt,
  );
  const generatingArticles = articles.filter((a) => a.status === "generating");

  const handleCreateArticle = async () => {
    if (!newArticleData.title.trim()) return;

    setIsCreatingArticle(true);
    try {
      const keywords = newArticleData.keywords
        .split(",")
        .map((k) => k.trim())
        .filter((k) => k.length > 0);

      await onCreateArticle({
        title: newArticleData.title.trim(),
        keywords: keywords.length > 0 ? keywords : undefined,
        notes: newArticleData.notes.trim() || undefined,
      });

      setNewArticleData({ title: "", keywords: "", notes: "" });
      setIsCreating(false);
    } catch (error) {
      console.error("Failed to create article:", error);
    } finally {
      setIsCreatingArticle(false);
    }
  };

  const handleIdeaAdded = async (idea: ArticleIdea) => {
    await onCreateArticle({
      title: idea.title,
      description: idea.description,
      keywords: idea.keywords,
      targetAudience: idea.targetAudience,
    });
  };

  const handleGenerateArticle = async (articleId: string) => {
    setGeneratingArticleIds((prev) => new Set(prev).add(articleId));
    try {
      await onGenerateArticle(articleId);
    } finally {
      setGeneratingArticleIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(articleId);
        return newSet;
      });
    }
  };

  return (
    <div
      role="tabpanel"
      id="planning-panel"
      aria-labelledby="planning-tab"
      className="space-y-6"
    >
      {/* Header with actions */}
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row">
        <div>
          <h2 className="text-xl font-semibold">Article Planning Hub</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Create ideas and manage article generation
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setIsCreating(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Article Idea
          </Button>

          <Button onClick={() => setShowIdeasGenerator(true)} variant="accent">
            <Sparkles className="mr-2 h-4 w-4" />
            Generate Ideas
          </Button>
        </div>
      </div>

      {/* Create article form */}
      {isCreating && (
        <Card className="border-accent bg-accent">
          <CardHeader>
            <CardTitle>Create New Article Idea</CardTitle>
            <CardDescription>
              Add a new article idea to your content pipeline
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-foreground mb-2 block text-sm font-medium">
                Article Title *
              </label>
              <Input
                type="text"
                value={newArticleData.title}
                onChange={(e) =>
                  setNewArticleData({
                    ...newArticleData,
                    title: e.target.value,
                  })
                }
                placeholder="Enter your article title..."
                autoFocus
                disabled={isCreatingArticle}
              />
            </div>

            <div>
              <label className="text-foreground mb-2 block text-sm font-medium">
                Keywords (optional)
              </label>
              <Input
                type="text"
                value={newArticleData.keywords}
                onChange={(e) =>
                  setNewArticleData({
                    ...newArticleData,
                    keywords: e.target.value,
                  })
                }
                placeholder="keyword1, keyword2, keyword3..."
                disabled={isCreatingArticle}
              />
              <p className="text-muted-foreground mt-1 text-xs">
                Separate keywords with commas
              </p>
            </div>

            <div>
              <label className="text-foreground mb-2 block text-sm font-medium">
                Article Notes (optional)
              </label>
              <Textarea
                value={newArticleData.notes}
                onChange={(e) =>
                  setNewArticleData({
                    ...newArticleData,
                    notes: e.target.value,
                  })
                }
                placeholder="Add specific requirements, context, or information you want the AI to consider when generating this article..."
                rows={4}
                className="resize-none"
                disabled={isCreatingArticle}
              />
              <p className="text-muted-foreground mt-1 text-xs">
                These notes will guide the AI throughout research, outlining,
                and writing phases.
              </p>
            </div>
          </CardContent>
          <CardFooter className="gap-2">
            <Button
              onClick={handleCreateArticle}
              disabled={!newArticleData.title.trim() || isCreatingArticle}
            >
              {isCreatingArticle ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {isCreatingArticle ? "Creating..." : "Create Article"}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setIsCreating(false);
                setNewArticleData({ title: "", keywords: "", notes: "" });
              }}
              disabled={isCreatingArticle}
            >
              Cancel
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Article sections */}
      <div className="grid gap-6">
        {/* Ideas section */}
        {ideaArticles.length > 0 && (
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-medium">
                Idea Collection ({ideaArticles.length})
              </h3>
            </div>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {ideaArticles.map((article) => (
                <ArticleCard
                  key={article.id}
                  article={article}
                  mode="planning"
                  onUpdate={onUpdateArticle}
                  onDelete={onDeleteArticle}
                  onGenerate={handleGenerateArticle}
                  onScheduleGeneration={onScheduleGeneration}
                  onNavigate={onNavigateToArticle}
                  isButtonLoading={generatingArticleIds.has(article.id)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Ready to generate section */}
        {readyArticles.length > 0 && (
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-medium">
                Ready to Generate ({readyArticles.length})
              </h3>
            </div>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {readyArticles.map((article) => (
                <ArticleCard
                  key={article.id}
                  article={article}
                  mode="planning"
                  onUpdate={onUpdateArticle}
                  onDelete={onDeleteArticle}
                  onGenerate={handleGenerateArticle}
                  onScheduleGeneration={onScheduleGeneration}
                  onNavigate={onNavigateToArticle}
                  isButtonLoading={generatingArticleIds.has(article.id)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Currently generating section */}
        {generatingArticles.length > 0 && (
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-foreground text-lg font-medium">
                Generating ({generatingArticles.length})
              </h3>
            </div>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {generatingArticles.map((article) => (
                <ArticleCard
                  key={article.id}
                  article={article}
                  mode="planning"
                  onGenerate={handleGenerateArticle}
                  onScheduleGeneration={onScheduleGeneration}
                  onNavigate={onNavigateToArticle}
                  isButtonLoading={generatingArticleIds.has(article.id)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Scheduled articles section */}
        {articles.filter(
          (a) =>
            a.generationScheduledAt &&
            !["generating", "published"].includes(a.status),
        ).length > 0 && (
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-medium">
                Scheduled for Generation (
                {
                  articles.filter(
                    (a) =>
                      a.generationScheduledAt &&
                      !["generating", "published"].includes(a.status),
                  ).length
                }
                )
              </h3>
            </div>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {articles
                .filter(
                  (a) =>
                    a.generationScheduledAt &&
                    !["generating", "published"].includes(a.status),
                )
                .map((article) => (
                  <ArticleCard
                    key={article.id}
                    article={article}
                    mode="planning"
                    onNavigate={onNavigateToArticle}
                  />
                ))}
            </div>
          </section>
        )}

        {/* Empty state */}
        {articles.length === 0 && (
          <div className="py-12 text-center">
            <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-full">
              <Plus className="h-8 w-8" />
            </div>
            <h3 className="mb-2 text-lg font-medium">No articles yet</h3>
            <p className="mb-4">
              Get started by creating your first article idea
            </p>
            <Button onClick={() => setIsCreating(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Your First Article
            </Button>
          </div>
        )}
      </div>

      {/* Article Ideas Generator Modal */}
      <ArticleIdeasGenerator
        open={showIdeasGenerator}
        onOpenChange={setShowIdeasGenerator}
        onIdeaAdded={handleIdeaAdded}
      />
    </div>
  );
}
