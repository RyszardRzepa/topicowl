import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/server/db";
import { articles, users, articleGeneration, projects } from "@/server/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { z } from "zod";
import type { ArticleStatus } from "@/types";
import { videoEmbedSchema } from "@/types";

// Types colocated with this API route
export interface SEOAnalysis {
  score: number;
  recommendations: string[];
  keywordDensity: Record<string, number>;
  readabilityScore: number;
}

export interface GenerationLog {
  phase: 'research' | 'writing' | 'validation' | 'optimization';
  status: 'pending' | 'completed' | 'failed';
  timestamp: Date;
  details?: string;
}

// Type for the raw article data from database
// Type for the raw article data from database
type ArticleData = {
  id: number;
  userId: string | null;
  projectId: number;
  title: string;
  description: string | null;
  keywords: unknown;
  targetAudience: string | null;
  status: ArticleStatus;
  scheduledAt?: Date | null; // For backward compatibility, maps to publishScheduledAt
  publishScheduledAt: Date | null;
  publishedAt: Date | null;

  estimatedReadTime: number | null;
  kanbanPosition: number;
  slug: string | null;
  metaDescription: string | null;
  metaKeywords: unknown;
  draft: string | null;
  content: string | null; // Final published content
  videos: unknown; // YouTube video embeds
  factCheckReport: unknown;
  seoScore: number | null;
  internalLinks: unknown;
  sources: unknown;
  coverImageUrl: string | null;
  coverImageAlt: string | null;
  coverImageDescription: string | null;
  coverImageKeywords: unknown;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export interface ArticleDetailResponse {
  success: boolean;
  data: ArticleData & {
    // Extended fields for preview
    seoAnalysis?: SEOAnalysis;
    generationLogs?: GenerationLog[];
    wordCount?: number;
    targetKeywords?: string[];
    researchSources?: string[];
  };
}

const updateArticleSchema = z.object({
  slug: z.string().optional(),
  metaDescription: z.string().optional(),
  metaKeywords: z.array(z.string()).optional(),
  draft: z.string().optional(), // Save edits to draft
  content: z.string().optional(), // Only set on publish
  videos: z.array(videoEmbedSchema).optional(), // Video embeds
  optimizedContent: z.string().optional(), // Deprecated - for backward compatibility
  coverImageUrl: z.string().optional(),
  coverImageAlt: z.string().optional(),
  coverImageDescription: z.string().optional(),
  coverImageKeywords: z.array(z.string()).optional(),
  // Add scheduling fields
  scheduledAt: z.string().datetime().optional(), // For publishing schedule
  publishScheduledAt: z.string().datetime().optional().or(z.undefined()), // Frontend compatibility
  // Add status and publication fields
  status: z.enum(['idea', 'scheduled', 'queued', 'to_generate', 'generating', 'wait_for_publish', 'published', 'deleted']).optional(),
  publishedAt: z.string().datetime().optional(), // When article was published
  // Add basic article fields
  title: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  keywords: z.array(z.string()).optional(),
  targetAudience: z.string().optional(),
  notes: z.string().optional(),
});

// GET /api/articles/[id] - Get single article with extended preview data
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Get current user from Clerk
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verify user exists in database
    const [userRecord] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!userRecord) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    const { id } = await params;
    const articleId = parseInt(id);
    if (isNaN(articleId)) {
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid article ID' 
      }, { status: 400 });
    }

    const article = await db
      .select({
        id: articles.id,
        userId: articles.userId,
        projectId: articles.projectId,
        title: articles.title,
        description: articles.description,
        keywords: articles.keywords,
        targetAudience: articles.targetAudience,
        status: articles.status,
        publishScheduledAt: articles.publishScheduledAt,
        publishedAt: articles.publishedAt,
        estimatedReadTime: articles.estimatedReadTime,
        kanbanPosition: articles.kanbanPosition,
        slug: articles.slug,
        metaDescription: articles.metaDescription,
        metaKeywords: articles.metaKeywords,
        draft: articles.draft,
        content: articles.content,
        videos: articles.videos,
        factCheckReport: articles.factCheckReport,
        seoScore: articles.seoScore,
        internalLinks: articles.internalLinks,
        sources: articles.sources,
        coverImageUrl: articles.coverImageUrl,
        coverImageAlt: articles.coverImageAlt,
        notes: articles.notes,
        createdAt: articles.createdAt,
        updatedAt: articles.updatedAt,
      })
      .from(articles)
      .innerJoin(projects, eq(articles.projectId, projects.id))
      .where(and(eq(articles.id, articleId), eq(projects.userId, userRecord.id)))
      .limit(1);

    if (article.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'Article not found or access denied' 
      }, { status: 404 });
    }

    const articleData = article[0] as ArticleData;

    // Also fetch the latest generation data to get the full draft content
    const [generationData] = await db
      .select()
      .from(articleGeneration)
      .where(eq(articleGeneration.articleId, articleId))
      .orderBy(desc(articleGeneration.createdAt))
      .limit(1);

    // Verify article ownership and that it's not deleted
    if (articleData.status === "deleted") {
      return NextResponse.json({ 
        success: false, 
        error: 'Article not found' 
      }, { status: 404 });
    }

    // Generate SEO analysis from existing data
    const seoAnalysis: SEOAnalysis | undefined = articleData.seoScore ? {
      score: articleData.seoScore,
      recommendations: generateSEORecommendations(articleData),
      keywordDensity: calculateKeywordDensity(articleData, generationData?.draftContent),
      readabilityScore: calculateReadabilityScore(articleData, generationData?.draftContent)
    } : undefined;

    // Generate generation logs from tracking fields
    const generationLogs: GenerationLog[] = generateGenerationLogs(articleData);

    // Calculate word count from content (use generation draft content if available)
  const contentForWordCount = generationData?.draftContent ?? articleData.draft;
    const wordCount = calculateWordCount(contentForWordCount);

    // Extract target keywords from keywords field
    const targetKeywords = Array.isArray(articleData.keywords) 
      ? articleData.keywords as string[]
      : [];

    // Extract research sources from sources field
    const researchSources = Array.isArray(articleData.sources)
      ? (articleData.sources as string[])
      : [];

    const response: ArticleDetailResponse = {
      success: true,
      data: {
        ...articleData,
        // Use generation draft content if available, otherwise fall back to article draft
  draft: generationData?.draftContent ?? articleData.draft,
        seoAnalysis,
        generationLogs,
        wordCount,
        targetKeywords,
        researchSources
      }
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Get article error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch article' 
      },
      { status: 500 }
    );
  }
}

// Helper functions for generating extended data
function generateSEORecommendations(article: ArticleData): string[] {
  const recommendations: string[] = [];
  
  if (!article.metaDescription) {
    recommendations.push('Add a meta description for better search visibility');
  }
  
  if (!article.keywords || (Array.isArray(article.keywords) && article.keywords.length === 0)) {
    recommendations.push('Add target keywords to improve SEO ranking');
  }
  
  if (!article.draft) {
    recommendations.push('Generate content to analyze SEO performance');
  }
  
  if (article.seoScore && article.seoScore < 70) {
    recommendations.push('Improve content optimization to increase SEO score');
  }
  
  return recommendations;
}

function calculateKeywordDensity(article: ArticleData, generationContent?: string | null): Record<string, number> {
  const content = generationContent ?? article.draft ?? '';
  const keywords = Array.isArray(article.keywords) ? (article.keywords as string[]) : [];
  const density: Record<string, number> = {};
  
  if (!content || keywords.length === 0) {
    return density;
  }
  
  const words = content.toLowerCase().split(/\s+/).length;
  
  keywords.forEach((keyword: string) => {
    const keywordLower = keyword.toLowerCase();
    const matches = (content.toLowerCase().match(new RegExp(keywordLower, 'g')) ?? []).length;
    density[keyword] = words > 0 ? (matches / words) * 100 : 0;
  });
  
  return density;
}

function calculateReadabilityScore(article: ArticleData, generationContent?: string | null): number {
  const content = generationContent ?? article.draft ?? '';
  
  if (!content) {
    return 0;
  }
  
  // Simple readability calculation based on sentence and word length
  const sentences = content.split(/[.!?]+/).filter((s: string) => s.trim().length > 0);
  const words = content.split(/\s+/).filter((w: string) => w.length > 0);
  
  if (sentences.length === 0 || words.length === 0) {
    return 0;
  }
  
  const avgWordsPerSentence = words.length / sentences.length;
  const avgSyllablesPerWord = words.reduce((acc: number, word: string) => {
    return acc + countSyllables(word);
  }, 0) / words.length;
  
  // Simplified Flesch Reading Ease formula
  const score = 206.835 - (1.015 * avgWordsPerSentence) - (84.6 * avgSyllablesPerWord);
  
  return Math.max(0, Math.min(100, Math.round(score)));
}

function countSyllables(word: string): number {
  word = word.toLowerCase();
  if (word.length <= 3) return 1;
  word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '');
  word = word.replace(/^y/, '');
  const matches = word.match(/[aeiouy]{1,2}/g);
  return matches ? matches.length : 1;
}

function calculateWordCount(content: string | null): number {
  if (!content) return 0; // fine, boolean check still acceptable
  return content.split(/\s+/).filter(word => word.length > 0).length;
}

function generateGenerationLogs(article: ArticleData): GenerationLog[] {
  const logs: GenerationLog[] = [];
  
  // Simple logs based on available content
  if (article.draft) {
    logs.push({
      phase: 'writing',
      status: 'completed',
      timestamp: new Date(article.updatedAt),
      details: 'Draft content generated'
    });
  }
  
  if (article.factCheckReport) {
    logs.push({
      phase: 'validation',
      status: 'completed',
      timestamp: new Date(article.updatedAt),
      details: 'Content validated and fact-checked'
    });
  }
  
  if (article.draft) {
    logs.push({
      phase: 'optimization',
      status: 'completed',
      timestamp: new Date(article.updatedAt),
      details: 'Content optimized for SEO'
    });
  }
  
  return logs.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
}

// PUT /api/articles/[id] - Update article
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Get current user from Clerk
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verify user exists in database
    const [userRecord] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!userRecord) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    const { id } = await params;
    const articleId = parseInt(id);
    if (isNaN(articleId)) {
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid article ID' 
      }, { status: 400 });
    }

    const body = await req.json() as unknown;
    const validatedData = updateArticleSchema.parse(body);

    // Check if article exists and belongs to current user via project ownership
    const existingArticle = await db
      .select({
        id: articles.id,
        userId: articles.userId,
        projectId: articles.projectId,
        status: articles.status,
      })
      .from(articles)
      .innerJoin(projects, eq(articles.projectId, projects.id))
      .where(and(eq(articles.id, articleId), eq(projects.userId, userRecord.id)))
      .limit(1);

    if (existingArticle.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'Article not found or access denied' 
      }, { status: 404 });
    }

    // Prevent updating deleted articles
    if (existingArticle[0]!.status === "deleted") {
      return NextResponse.json({ 
        success: false, 
        error: 'Cannot update deleted article' 
      }, { status: 410 });
    }

    // Update the article with only the allowed fields
    const updateData = {
      ...validatedData,
      // Convert string dates to Date objects for database
      publishScheduledAt: validatedData.scheduledAt ? new Date(validatedData.scheduledAt) : undefined,
      publishedAt: validatedData.publishedAt ? new Date(validatedData.publishedAt) : undefined,
      updatedAt: new Date(),
    };

    // Handle field mapping for frontend compatibility
    if (validatedData.publishScheduledAt !== undefined) {
      updateData.publishScheduledAt = validatedData.publishScheduledAt ? new Date(validatedData.publishScheduledAt) : undefined;
    }

    const [updatedArticle] = await db
      .update(articles)
      .set(updateData)
      .where(eq(articles.id, articleId))
      .returning();

    // If draft content was updated, also sync it to the latest articleGeneration row (if any)
    if (Object.prototype.hasOwnProperty.call(validatedData, 'draft') && validatedData.draft !== undefined) {
      try {
        const latestGen = await db
          .select({ id: articleGeneration.id })
          .from(articleGeneration)
          .where(eq(articleGeneration.articleId, articleId))
          .orderBy(desc(articleGeneration.createdAt))
          .limit(1);

        if (latestGen.length > 0) {
          await db
            .update(articleGeneration)
            .set({ draftContent: validatedData.draft, updatedAt: new Date() })
            .where(eq(articleGeneration.id, latestGen[0]!.id));
        }
      } catch (syncError) {
        // Non-fatal: log and continue; we don't want to fail the primary article update
        console.error('Failed to sync draft to articleGeneration:', syncError);
      }
    }

    return NextResponse.json({
      success: true,
      data: updatedArticle
    });

  } catch (error) {
    console.error('Update article error:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid input data', 
          details: error.errors 
        },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to update article' 
      },
      { status: 500 }
    );
  }
}

// DELETE /api/articles/[id] - Delete article
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Get current user from Clerk
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verify user exists in database
    const [userRecord] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!userRecord) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    const { id } = await params;
    const articleId = parseInt(id);
    if (isNaN(articleId)) {
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid article ID' 
      }, { status: 400 });
    }

    // Check if article exists and belongs to current user via project ownership
    const existingArticle = await db
      .select({
        id: articles.id,
        userId: articles.userId,
        projectId: articles.projectId,
        status: articles.status,
      })
      .from(articles)
      .innerJoin(projects, eq(articles.projectId, projects.id))
      .where(and(eq(articles.id, articleId), eq(projects.userId, userRecord.id)))
      .limit(1);

    if (existingArticle.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'Article not found or access denied' 
      }, { status: 404 });
    }

    // Check if article is already deleted
    if (existingArticle[0]!.status === "deleted") {
      return NextResponse.json({ 
        success: false, 
        error: 'Article is already deleted' 
      }, { status: 410 });
    }

    // Soft delete the article by updating status to "deleted"
    const [deletedArticle] = await db
      .update(articles)
      .set({ 
        status: "deleted",
        updatedAt: new Date()
      })
      .where(eq(articles.id, articleId))
      .returning();

    return NextResponse.json({ 
      success: true, 
      message: 'Article deleted successfully',
      data: deletedArticle
    });

  } catch (error) {
    console.error('Delete article error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to delete article' 
      },
      { status: 500 }
    );
  }
}
