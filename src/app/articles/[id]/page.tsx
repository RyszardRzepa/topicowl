import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { db } from "@/server/db";
import { articles } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { ArticlePreviewClient } from "@/components/articles/article-preview-client";
import type { ArticleDetailResponse } from "@/app/api/articles/[id]/route";

// Page props interface for the dynamic route
interface ArticlePreviewPageProps {
  params: Promise<{ id: string }>;
}

// Server component for article preview page
export default async function ArticlePreviewPage({ params }: ArticlePreviewPageProps) {
  const { id } = await params;
  const articleId = parseInt(id);

  // Validate article ID
  if (isNaN(articleId)) {
    notFound();
  }

    // Fetch article directly from database instead of making internal API calls
  let article!: ArticleDetailResponse['data']; // Definite assignment assertion
  try {
    const [articleData] = await db
      .select()
      .from(articles)
      .where(eq(articles.id, articleId));

    if (!articleData) {
      notFound();
    }

    // Transform the database data to match the expected format
    article = {
      id: articleData.id,
      user_id: articleData.user_id,
      title: articleData.title,
      description: articleData.description,
      keywords: Array.isArray(articleData.keywords) ? (articleData.keywords as string[]) : [],
      targetAudience: articleData.targetAudience,
      status: articleData.status,
      scheduledAt: articleData.scheduledAt,
      publishedAt: articleData.publishedAt,

      estimatedReadTime: articleData.estimatedReadTime,
      kanbanPosition: articleData.kanbanPosition,
      metaDescription: articleData.metaDescription,
      outline: articleData.outline,
      draft: articleData.draft,
      optimizedContent: articleData.optimizedContent,
      factCheckReport: articleData.factCheckReport,
      seoScore: articleData.seoScore,
      internalLinks: articleData.internalLinks,
      sources: articleData.sources,
      coverImageUrl: articleData.coverImageUrl,
      coverImageAlt: articleData.coverImageAlt,
      createdAt: articleData.createdAt,
      updatedAt: articleData.updatedAt,
      // Extended fields that are expected by ArticleDetailResponse['data']
      targetKeywords: Array.isArray(articleData.keywords) ? (articleData.keywords as string[]) : [],
      researchSources: Array.isArray(articleData.sources) ? (articleData.sources as string[]) : [],
      wordCount: articleData.optimizedContent 
        ? articleData.optimizedContent.split(/\s+/).length 
        : articleData.draft 
          ? articleData.draft.split(/\s+/).length 
          : 0,
      // Optional extended fields
      seoAnalysis: articleData.seoScore ? {
        score: articleData.seoScore,
        recommendations: [],
        keywordDensity: {},
        readabilityScore: 0
      } : undefined,
      generationLogs: []
    };
  } catch (error) {
    console.error('Failed to fetch article:', error);
    notFound();
  }

  // TypeScript assertion: article is guaranteed to be defined here due to notFound() calls above
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="container mx-auto p-8 max-w-4xl">
        {/* Navigation Header */}
        <div className="mb-8">
          <Link href="/" className="inline-block">
            <Button variant="ghost" className="mb-4 hover:bg-gray-100">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Kanban Board
            </Button>
          </Link>
          
          {/* Breadcrumb */}
          <nav className="text-sm text-gray-500">
            <Link href="/" className="hover:text-gray-700">
              Kanban Board
            </Link>
            <span className="mx-2">/</span>
            <span className="text-gray-900 font-medium">
              {article.title}
            </span>
          </nav>
        </div>

        {/* Article Content with Actions */}
        <ArticlePreviewClient initialArticle={article} />
      </div>
    </main>
  );
}