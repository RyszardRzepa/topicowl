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
import { Plus, Sparkles } from "lucide-react";
import type { Article } from "@/types";
import type { ArticleIdea } from "@/app/api/articles/generate-ideas/route";

interface PlanningHubProps {
  articles: Article[];
  onCreateArticle: (data: {
    title: string;
    keywords?: string[];
    description?: string;
    targetAudience?: string;
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
  const [newArticleData, setNewArticleData] = useState({
    title: "",
    keywords: "",
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

    const keywords = newArticleData.keywords
      .split(",")
      .map((k) => k.trim())
      .filter((k) => k.length > 0);

    await onCreateArticle({
      title: newArticleData.title.trim(),
      keywords: keywords.length > 0 ? keywords : undefined,
    });

    setNewArticleData({ title: "", keywords: "" });
    setIsCreating(false);
  };

  const handleIdeaAdded = async (idea: ArticleIdea) => {
    await onCreateArticle({
      title: idea.title,
      description: idea.description,
      keywords: idea.keywords,
      targetAudience: idea.targetAudience,
    });
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
          <h2 className="text-xl font-semibold text-gray-900">
            Article Planning Hub
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            Create ideas and manage article generation
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {/* Generate AI ideas */}
          <Button
            onClick={() => setShowIdeasGenerator(true)}
            className="bg-purple-600 hover:bg-purple-700"
          >
            <Sparkles className="mr-2 h-4 w-4" />
            Generate Ideas
          </Button>
          
          {/* Create new article */}
          <Button
            onClick={() => setIsCreating(true)}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Article Idea
          </Button>
        </div>
      </div>

      {/* Create article form */}
      {isCreating && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle>Create New Article Idea</CardTitle>
            <CardDescription>
              Add a new article idea to your content pipeline
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-stone-700">
                Article Title *
              </label>
              <input
                type="text"
                value={newArticleData.title}
                onChange={(e) =>
                  setNewArticleData({
                    ...newArticleData,
                    title: e.target.value,
                  })
                }
                placeholder="Enter your article title..."
                className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                autoFocus
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-stone-700">
                Keywords (optional)
              </label>
              <input
                type="text"
                value={newArticleData.keywords}
                onChange={(e) =>
                  setNewArticleData({
                    ...newArticleData,
                    keywords: e.target.value,
                  })
                }
                placeholder="keyword1, keyword2, keyword3..."
                className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <p className="mt-1 text-xs text-stone-500">
                Separate keywords with commas
              </p>
            </div>
          </CardContent>
          <CardFooter className="gap-2">
            <Button
              onClick={handleCreateArticle}
              disabled={!newArticleData.title.trim()}
              className="bg-green-600 hover:bg-green-700"
            >
              Create Article
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setIsCreating(false);
                setNewArticleData({ title: "", keywords: "" });
              }}
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
              <h3 className="text-lg font-medium text-gray-900">
                Ideas ({ideaArticles.length})
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
                  onGenerate={onGenerateArticle}
                  onScheduleGeneration={onScheduleGeneration}
                  onNavigate={onNavigateToArticle}
                />
              ))}
            </div>
          </section>
        )}

        {/* Ready to generate section */}
        {readyArticles.length > 0 && (
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">
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
                  onGenerate={onGenerateArticle}
                  onScheduleGeneration={onScheduleGeneration}
                  onNavigate={onNavigateToArticle}
                />
              ))}
            </div>
          </section>
        )}

        {/* Currently generating section */}
        {generatingArticles.length > 0 && (
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">
                Generating ({generatingArticles.length})
              </h3>
            </div>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {generatingArticles.map((article) => (
                <ArticleCard
                  key={article.id}
                  article={article}
                  mode="planning"
                  onGenerate={onGenerateArticle}
                  onScheduleGeneration={onScheduleGeneration}
                  onNavigate={onNavigateToArticle}
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
              <h3 className="text-lg font-medium text-gray-900">
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
            <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-gray-100">
              <Plus className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="mb-2 text-lg font-medium text-gray-900">
              No articles yet
            </h3>
            <p className="mb-4 text-gray-600">
              Get started by creating your first article idea
            </p>
            <Button
              onClick={() => setIsCreating(true)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="mr-2 h-4 w-4" />
              Create Your First Article
            </Button>
          </div>
        )}
      </div>

      {/* Article Ideas Generator Modal */}
      {showIdeasGenerator && (
        <ArticleIdeasGenerator
          onIdeaAdded={handleIdeaAdded}
          onClose={() => setShowIdeasGenerator(false)}
        />
      )}
    </div>
  );
}
