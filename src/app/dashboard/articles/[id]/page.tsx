import { notFound } from "next/navigation";
import { db } from "@/server/db";
import { articles, articleGenerations } from "@/server/db/schema";
import { eq, desc } from "drizzle-orm";
import { ArticlePreviewClient } from "@/components/articles/article-preview-client";
import { BackButton } from "@/components/ui/back-button";
import type { ArticleDetailResponse } from "@/app/api/articles/[id]/route";
import type { ValidationArtifact, WriteArtifact } from "@/types";

// Page props interface for the dynamic route
interface ArticlePreviewPageProps {
  params: Promise<{ id: string }>;
}

// Server component for article preview page
export default async function ArticlePreviewPage({
  params,
}: ArticlePreviewPageProps) {
  const { id } = await params;
  const articleId = parseInt(id);

  // Validate article ID
  if (isNaN(articleId)) {
    notFound();
  }

  // Fetch article directly from database instead of making internal API calls
  let article!: ArticleDetailResponse["data"]; // Definite assignment assertion
  try {
    const [articleData] = await db
      .select()
      .from(articles)
      .where(eq(articles.id, articleId));

    if (!articleData) {
      notFound();
    }

    // Also fetch the latest generation data to get the latest content
    const [generationData] = await db
      .select()
      .from(articleGenerations)
      .where(eq(articleGenerations.articleId, articleId))
      .orderBy(desc(articleGenerations.createdAt))
      .limit(1);

    const artifacts = generationData?.artifacts;
    const writeArtifact: WriteArtifact | undefined = artifacts?.write;
    const qcArtifact = artifacts?.qualityControl;
    const validationArtifact: ValidationArtifact | undefined =
      artifacts?.validation;
    const researchArtifact = artifacts?.research;
    const workingContent = writeArtifact?.content ?? articleData.content;
    const factCheckReport =
      writeArtifact?.factCheckReport ??
      qcArtifact?.report ??
      null;
    const internalLinksCandidate = writeArtifact?.internalLinks;
    const internalLinks = Array.isArray(internalLinksCandidate)
      ? internalLinksCandidate.filter(
          (link): link is string => typeof link === "string",
        )
      : [];
    const derivedSeoScore = validationArtifact?.seoScore ?? null;

    // Transform the database data to match the expected format
    article = {
      id: articleData.id,
      userId: articleData.userId,
      projectId: articleData.projectId,
      title: articleData.title,
      description: articleData.description,
      keywords:
        Array.isArray(articleData.keywords) &&
        articleData.keywords.every((keyword) => typeof keyword === "string")
          ? articleData.keywords
          : [],
      targetAudience: articleData.targetAudience,
      status: articleData.status,
      scheduledAt: articleData.publishScheduledAt, // Map for compatibility
      publishScheduledAt: articleData.publishScheduledAt,
      publishedAt: articleData.publishedAt,

      estimatedReadTime: articleData.estimatedReadTime,
      kanbanPosition: articleData.kanbanPosition,
      slug: articleData.slug,
      metaDescription: articleData.metaDescription,
      metaKeywords: articleData.metaKeywords,
      content: workingContent ?? articleData.content,
      videos: articleData.videos, // YouTube video embeds
      factCheckReport,
      seoScore: derivedSeoScore,
      internalLinks,
      sources: researchArtifact?.sources
        ? researchArtifact.sources.map((source) =>
            source.title ? `${source.title} — ${source.url}` : source.url,
          )
        : [],
      coverImageUrl: articleData.coverImageUrl,
      coverImageAlt: articleData.coverImageAlt,
      coverImageDescription: null, // Not in schema, set to null
      coverImageKeywords: [], // Not in schema, set to empty array
      notes: articleData.notes,
      createdAt: articleData.createdAt,
      updatedAt: articleData.updatedAt,
      // Extended fields that are expected by ArticleDetailResponse['data']
      targetKeywords: Array.isArray(articleData.keywords)
        ? (articleData.keywords as string[])
        : [],
      researchSources: researchArtifact?.sources
        ? researchArtifact.sources.map((source) =>
            source.title ? `${source.title} — ${source.url}` : source.url,
          )
        : [],
      wordCount: workingContent
        ? workingContent.split(/\s+/).filter((word) => word.length > 0).length
        : 0,
      // Optional extended fields
      seoAnalysis: derivedSeoScore
        ? {
            score: derivedSeoScore,
            recommendations: [],
            keywordDensity: {},
            readabilityScore: 0,
          }
        : undefined,
      generationLogs: [],
    };
  } catch (error) {
    console.error("Failed to fetch article:", error);
    notFound();
  }

  // TypeScript assertion: article is guaranteed to be defined here due to notFound() calls above
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="container mx-auto max-w-7xl px-4">
        <BackButton />
        <ArticlePreviewClient initialArticle={article} />
      </div>
    </main>
  );
}
