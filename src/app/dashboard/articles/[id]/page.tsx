import { notFound } from "next/navigation";
import { db } from "@/server/db";
import { articles, articleGeneration } from "@/server/db/schema";
import { eq, desc } from "drizzle-orm";
import { ArticlePreviewClient } from "@/components/articles/article-preview-client";
import { BackButton } from "@/components/ui/back-button";
import type { ArticleDetailResponse } from "@/app/api/articles/[id]/route";

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

    // Also fetch the latest generation data to get the full draft content
    const [generationData] = await db
      .select()
      .from(articleGeneration)
      .where(eq(articleGeneration.articleId, articleId))
      .orderBy(desc(articleGeneration.createdAt))
      .limit(1);

    // Transform the database data to match the expected format
    article = {
      id: articleData.id,
      userId: articleData.userId,
      projectId: articleData.projectId,
      title: articleData.title,
      description: articleData.description,
      keywords: Array.isArray(articleData.keywords)
        ? (articleData.keywords as string[])
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
      draft: generationData?.draftContent ?? articleData.draft, // Use generation draft content if available
      content: articleData.content, // Final published content
      videos: articleData.videos, // YouTube video embeds
      factCheckReport: articleData.factCheckReport,
      seoScore: articleData.seoScore,
      internalLinks: articleData.internalLinks,
      sources: articleData.sources,
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
      researchSources: Array.isArray(articleData.sources)
        ? (articleData.sources as string[])
        : [],
      wordCount: articleData.content
        ? articleData.content.split(/\s+/).length
        : (generationData?.draftContent ?? articleData.draft)
          ? (generationData?.draftContent ?? articleData.draft)!.split(/\s+/)
              .length
          : 0,
      // Optional extended fields
      seoAnalysis: articleData.seoScore
        ? {
            score: articleData.seoScore,
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
