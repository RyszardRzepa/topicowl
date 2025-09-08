"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { useCreditContext } from "@/components/dashboard/credit-context";
import { useCurrentProjectId } from "@/contexts/project-context";
import type { Article } from "@/types";
import type {
  DatabaseArticle,
  KanbanColumn,
} from "@/app/api/articles/board/route";
import type { SchedulePublishingResponse } from "@/app/api/articles/schedule-publishing/route";

export function transformDatabaseArticle(dbArticle: DatabaseArticle): Article {
  let correctedStatus = dbArticle.status;
  if (
    dbArticle.generationStatus === "completed" &&
    dbArticle.generationProgress === 100 &&
    (dbArticle.status === "scheduled" || dbArticle.status === "generating")
  ) {
    correctedStatus = "wait_for_publish";
    console.log(
      `Auto-correcting article ${dbArticle.id} status from ${dbArticle.status} to wait_for_publish`,
    );
  }

  return {
    id: dbArticle.id.toString(),
    title: dbArticle.title,
    content: dbArticle.content ?? dbArticle.draft ?? undefined,
    status: correctedStatus,
    // DatabaseArticle doesn't expose projectId in imported type; fallback to 0 to satisfy required field
    projectId: (dbArticle as unknown as { projectId?: number }).projectId ?? 0,
    // Include slug if present in the board payload
    slug: (dbArticle as unknown as { slug?: string | null }).slug ?? undefined,
    keywords: Array.isArray(dbArticle.keywords)
      ? (dbArticle.keywords as string[])
      : [],
    notes: dbArticle.notes ?? undefined,
    createdAt:
      dbArticle.createdAt instanceof Date
        ? dbArticle.createdAt.toISOString()
        : dbArticle.createdAt,
    updatedAt:
      dbArticle.updatedAt instanceof Date
        ? dbArticle.updatedAt.toISOString()
        : dbArticle.updatedAt,
    generationProgress:
      typeof dbArticle.generationProgress === "number"
        ? dbArticle.generationProgress
        : 0,
    generationPhase:
      dbArticle.generationStatus === "researching"
        ? "research"
        : dbArticle.generationStatus === "writing"
          ? "writing"
          : dbArticle.generationStatus === "validating"
            ? "validation"
            : dbArticle.generationStatus === "updating"
              ? "optimization"
              : undefined,
    generationError: dbArticle.generationError ?? undefined,
    estimatedReadTime: dbArticle.estimatedReadTime ?? undefined,
    generationScheduledAt:
      dbArticle.generationScheduledAt instanceof Date
        ? dbArticle.generationScheduledAt.toISOString()
        : typeof dbArticle.generationScheduledAt === "string"
          ? dbArticle.generationScheduledAt
          : undefined,
    generationStartedAt: undefined,
    generationCompletedAt: undefined,
    publishScheduledAt:
      dbArticle.scheduledAt instanceof Date
        ? dbArticle.scheduledAt.toISOString()
        : typeof dbArticle.scheduledAt === "string"
          ? dbArticle.scheduledAt
          : undefined,
    publishedAt:
      dbArticle.publishedAt instanceof Date
        ? dbArticle.publishedAt.toISOString()
        : typeof dbArticle.publishedAt === "string"
          ? dbArticle.publishedAt
          : undefined,
  };
}

export interface CreateArticleInput {
  title: string;
  keywords?: string[];
  description?: string;
  targetAudience?: string;
  notes?: string;
}

export function useWorkflowArticles() {
  const currentProjectId = useCurrentProjectId();
  const { refreshCredits } = useCreditContext();
  const [articles, setArticles] = useState<Article[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchArticles = useCallback(async () => {
    if (!currentProjectId) {
      setArticles([]);
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);
      const response = await fetch(
        `/api/articles/board?projectId=${currentProjectId}`,
      );
      if (!response.ok) throw new Error("Failed to fetch articles");
      const raw: unknown = await response.json();
      if (!Array.isArray(raw)) throw new Error("Invalid response format");
      const data = raw as KanbanColumn[];
      const all: Article[] = [];
      data.forEach((col) =>
        col.articles.forEach((a) => all.push(transformDatabaseArticle(a))),
      );
      setArticles(all);
      setError(null);
    } catch (err) {
      console.error("Failed to load articles:", err);
      setError("Failed to load articles");
    } finally {
      setIsLoading(false);
    }
  }, [currentProjectId]);

  useEffect(() => {
    void fetchArticles();
  }, [fetchArticles]);

  const planningArticles = useMemo(
    () =>
      articles.filter(
        (a) =>
          a.status === "idea" ||
          (a.status === "to_generate" && !a.generationScheduledAt),
      ),
    [articles],
  );

  const generationsArticles = useMemo(
    () =>
      articles.filter(
        (a) =>
          a.status === "generating" ||
          (a.status === "to_generate" && Boolean(a.generationScheduledAt)) ||
          Boolean(a.generationError),
      ),
    [articles],
  );

  const publishingArticles = useMemo(
    () =>
      articles.filter(
        (a) =>
          a.status === "wait_for_publish" ||
          a.status === "published" ||
          (a.generationProgress === 100 &&
            a.generationPhase === undefined &&
            !a.generationError),
      ),
    [articles],
  );

  const generatingArticles = useMemo(
    () => articles.filter((a) => a.status === "generating"),
    [articles],
  );

  const requireProject = (): string | null => {
    if (!currentProjectId) {
      toast.error("No project selected", {
        description: "Please select a project first.",
      });
      return null;
    }
    return currentProjectId.toString();
  };

  const handleCreateArticle = async (data: CreateArticleInput) => {
    const project = requireProject();
    if (!project) return;
    try {
      const response = await fetch("/api/articles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-project-id": project,
        },
        body: JSON.stringify({
          title: data.title,
          description: data.description,
          keywords: data.keywords ?? [],
          targetAudience: data.targetAudience,
          notes: data.notes,
          // projectId must be number per API schema
          projectId: parseInt(project, 10),
        }),
      });
      if (!response.ok) throw new Error("Failed to create article");
      toast.success("Article idea created successfully!", {
        description: `"${data.title}" has been added to your planning phase.`,
      });
      await fetchArticles();
    } catch (err) {
      console.error("Failed to create article:", err);
      toast.error("Failed to create article", {
        description: "Please try again or check your connection.",
      });
      setError("Failed to create article");
    }
  };

  const handleUpdateArticle = async (
    articleId: string,
    updates: Partial<Article>,
  ) => {
    const project = requireProject();
    if (!project) return;
    try {
      const response = await fetch(`/api/articles/${articleId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-project-id": project,
        },
        body: JSON.stringify(updates),
      });
      if (!response.ok) throw new Error("Failed to update article");
      setArticles((prev) =>
        prev.map((a) => (a.id === articleId ? { ...a, ...updates } : a)),
      );
    } catch (err) {
      console.error("Failed to update article:", err);
      toast.error("Failed to update article", {
        description: "Please try again or check your connection.",
      });
      setError("Failed to update article");
      await fetchArticles();
    }
  };

  const handleDeleteArticle = async (articleId: string) => {
    const project = requireProject();
    if (!project) return;
    try {
      const articleToDelete = articles.find((a) => a.id === articleId);
      const response = await fetch(`/api/articles/${articleId}`, {
        method: "DELETE",
        headers: { "x-project-id": project },
      });
      if (!response.ok) throw new Error("Failed to delete article");
      setArticles((prev) => prev.filter((a) => a.id !== articleId));
      toast.success("Article deleted successfully!", {
        description: articleToDelete
          ? `"${articleToDelete.title}" has been removed.`
          : undefined,
      });
    } catch (err) {
      console.error("Failed to delete article:", err);
      toast.error("Failed to delete article", {
        description: "Please try again or check your connection.",
      });
      setError("Failed to delete article");
      await fetchArticles();
    }
  };

  const handleGenerateArticle = async (articleId: string) => {
    const project = requireProject();
    if (!project) return;
    try {
      const article = articles.find((a) => a.id === articleId);
      const response = await fetch("/api/articles/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-project-id": project,
        },
        body: JSON.stringify({ articleId }),
      });
      if (!response.ok) throw new Error("Failed to start article generation");
      setArticles((prev) =>
        prev.map((a) =>
          a.id === articleId
            ? { ...a, status: "generating", generationProgress: 0 }
            : a,
        ),
      );
      toast.success("Article generation started!", {
        description: article
          ? `Generating "${article.title}"...`
          : "Your article is being generated.",
      });
    } catch (err) {
      console.error("Failed to generate article:", err);
      toast.error("Failed to start article generation", {
        description: "Please try again or check your connection.",
      });
      setError("Failed to generate article");
    }
  };


  const handlePublishArticle = async (articleId: string) => {
    const project = requireProject();
    if (!project) return;
    try {
      const article = articles.find((a) => a.id === articleId);
      const response = await fetch("/api/articles/publish", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          articleId: parseInt(articleId),
          projectId: parseInt(project),
        }),
      });
      if (!response.ok) {
        const errorData = (await response.json()) as { error?: string };
        throw new Error(errorData.error ?? "Failed to publish article");
      }
      setArticles((prev) =>
        prev.map((a) =>
          a.id === articleId
            ? {
                ...a,
                status: "published",
                publishedAt: new Date().toISOString(),
                publishScheduledAt: undefined,
              }
            : a,
        ),
      );
      toast.success("Article published successfully!", {
        description: article
          ? `"${article.title}" is now live.`
          : "Your article is now live.",
      });
    } catch (err) {
      console.error("Failed to publish article:", err);
      toast.error("Failed to publish article", {
        description: "Please try again or check your connection.",
      });
      setError("Failed to publish article");
      await fetchArticles();
    }
  };

  const handleSchedulePublishing = async (
    articleId: string,
    scheduledAt: Date,
  ) => {
    const project = requireProject();
    if (!project) return;
    try {
      const article = articles.find((a) => a.id === articleId);
      const response = await fetch("/api/articles/schedule-publishing", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-project-id": project,
        },
        body: JSON.stringify({
          articleId: parseInt(articleId, 10),
          publishAt: scheduledAt.toISOString(),
        }),
      });
      const result = (await response.json()) as
        | SchedulePublishingResponse
        | { error: string };
      if (!response.ok)
        throw new Error(
          "error" in result ? result.error : "Failed to schedule publishing",
        );
      if (!("success" in result) || !result.success)
        throw new Error("Failed to schedule publishing");
      setArticles((prev) =>
        prev.map((a) =>
          a.id === articleId
            ? { ...a, publishScheduledAt: scheduledAt.toISOString() }
            : a,
        ),
      );
      const formattedDate = scheduledAt.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
      toast.success("Publishing scheduled successfully!", {
        description: article
          ? `"${article.title}" will be published on ${formattedDate}.`
          : `Article will be published on ${formattedDate}.`,
      });
    } catch (err) {
      console.error("Failed to schedule publishing:", err);
      toast.error("Failed to schedule publishing", {
        description: "Please try again or check your connection.",
      });
      setError("Failed to schedule publishing");
    }
  };

  const handleCancelPublishSchedule = async (articleId: string) => {
    const project = requireProject();
    if (!project) return;
    try {
      const article = articles.find((a) => a.id === articleId);
      const response = await fetch(
        `/api/articles/${articleId}/cancel-publish-schedule`,
        {
          method: "POST",
          headers: { "x-project-id": project },
        },
      );
      if (!response.ok) {
        const errBody = (await response.json()) as { error?: string };
        throw new Error(errBody.error ?? "Failed to cancel schedule");
      }
      setArticles((prev) =>
        prev.map((a) =>
          a.id === articleId
            ? {
                ...a,
                publishScheduledAt: undefined,
                status: "wait_for_publish",
              }
            : a,
        ),
      );
      toast.success("Publishing schedule cancelled", {
        description: article
          ? `"${article.title}" moved back to Ready to Publish.`
          : "Article moved back to Ready to Publish.",
      });
    } catch (err) {
      console.error("Failed to cancel publishing schedule:", err);
      toast.error("Failed to cancel publishing schedule", {
        description: "Please try again or check your connection.",
      });
      setError("Failed to cancel publishing schedule");
    }
  };

  const handleBulkGenerate = async (articleIds: string[]) => {
    for (const id of articleIds) await handleGenerateArticle(id);
    toast.success(
      `Started generating ${articleIds.length} article${articleIds.length > 1 ? "s" : ""}!`,
      { description: "Check the Generations tab to monitor progress." },
    );
  };

  const handleBulkPublish = async (articleIds: string[]) => {
    for (const id of articleIds) await handlePublishArticle(id);
    toast.success(
      `Published ${articleIds.length} article${articleIds.length > 1 ? "s" : ""}!`,
      { description: "All selected articles are now live." },
    );
  };

  const handleBulkSchedulePublishing = async (
    articleIds: string[],
    scheduledAt: Date,
  ) => {
    for (const id of articleIds)
      await handleSchedulePublishing(id, scheduledAt);
    const formattedDate = scheduledAt.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
    toast.success(
      `Scheduled ${articleIds.length} article${articleIds.length > 1 ? "s" : ""} for publishing!`,
      { description: `All articles will be published on ${formattedDate}.` },
    );
  };

  const refreshCreditsSafe = useCallback(() => {
    void refreshCredits();
  }, [refreshCredits]);

  return {
    state: { articles, isLoading, error },
    partitions: {
      planningArticles,
      generationsArticles,
      publishingArticles,
      generatingArticles,
    },
    refetch: fetchArticles,
    actions: {
      create: handleCreateArticle,
      update: handleUpdateArticle,
      delete: handleDeleteArticle,
      generate: handleGenerateArticle,
      publish: handlePublishArticle,
      schedulePublishing: handleSchedulePublishing,
      cancelPublishSchedule: handleCancelPublishSchedule,
      bulkGenerate: handleBulkGenerate,
      bulkPublish: handleBulkPublish,
      bulkSchedulePublishing: handleBulkSchedulePublishing,
      refreshCredits: refreshCreditsSafe,
      setArticles,
    },
  } as const;
}
