import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/server/db";
import { articles, users } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

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
type ArticleData = {
  id: number;
  user_id: string | null;
  title: string;
  description: string | null;
  keywords: unknown;
  targetAudience: string | null;
  status: "idea" | "scheduled" | "queued" | "to_generate" | "generating" | "wait_for_publish" | "published";
  scheduledAt: Date | null;
  publishedAt: Date | null;

  estimatedReadTime: number | null;
  kanbanPosition: number;
  metaDescription: string | null;
  outline: unknown;
  draft: string | null;
  optimizedContent: string | null;
  factCheckReport: unknown;
  seoScore: number | null;
  internalLinks: unknown;
  sources: unknown;
  coverImageUrl: string | null;
  coverImageAlt: string | null;
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
  title: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  keywords: z.array(z.string()).optional(),
  targetAudience: z.string().optional(),
  metaDescription: z.string().optional(),
  draft: z.string().optional(),
  optimizedContent: z.string().optional(),
  generationScheduledAt: z.string().datetime().optional(),
  status: z.enum(["idea", "to_generate", "generating", "wait_for_publish", "published"]).optional(),
  publishedAt: z.string().datetime().optional(),
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

    // Get user record from database
    const [userRecord] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerk_user_id, userId))
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
      .select()
      .from(articles)
      .where(eq(articles.id, articleId))
      .limit(1);

    if (article.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'Article not found' 
      }, { status: 404 });
    }

    const articleData = article[0] as ArticleData;

    // Verify article ownership
    if (articleData.user_id !== userRecord.id) {
      return NextResponse.json(
        { success: false, error: 'Access denied: Article does not belong to current user' },
        { status: 403 }
      );
    }

    // Generate SEO analysis from existing data
    const seoAnalysis: SEOAnalysis | undefined = articleData.seoScore ? {
      score: articleData.seoScore,
      recommendations: generateSEORecommendations(articleData),
      keywordDensity: calculateKeywordDensity(articleData),
      readabilityScore: calculateReadabilityScore(articleData)
    } : undefined;

    // Generate generation logs from tracking fields
    const generationLogs: GenerationLog[] = generateGenerationLogs(articleData);

    // Calculate word count from content
    const wordCount = calculateWordCount(articleData.optimizedContent ?? articleData.draft);

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
  
  if (!article.optimizedContent && !article.draft) {
    recommendations.push('Generate content to analyze SEO performance');
  }
  
  if (article.seoScore && article.seoScore < 70) {
    recommendations.push('Improve content optimization to increase SEO score');
  }
  
  return recommendations;
}

function calculateKeywordDensity(article: ArticleData): Record<string, number> {
  const content = article.optimizedContent ?? article.draft ?? '';
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

function calculateReadabilityScore(article: ArticleData): number {
  const content = article.optimizedContent ?? article.draft ?? '';
  
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
  if (!content) return 0;
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
  
  if (article.optimizedContent) {
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

    // Get user record from database
    const [userRecord] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerk_user_id, userId))
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

    // Check if article exists and belongs to current user
    const existingArticle = await db
      .select()
      .from(articles)
      .where(eq(articles.id, articleId))
      .limit(1);

    if (existingArticle.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'Article not found' 
      }, { status: 404 });
    }

    // Verify article ownership
    if (existingArticle[0]!.user_id !== userRecord.id) {
      return NextResponse.json(
        { success: false, error: 'Access denied: Article does not belong to current user' },
        { status: 403 }
      );
    }

    // Update the article
    const { generationScheduledAt, publishedAt, ...otherData } = validatedData;
    
    const updateData = {
      ...otherData,
      updatedAt: new Date(),
      ...(generationScheduledAt && { generationScheduledAt: new Date(generationScheduledAt) }),
      ...(publishedAt && { publishedAt: new Date(publishedAt) }),
    };

    // Check if we're publishing the article
    const isPublishing = validatedData.status === 'published';
    const previousStatus = existingArticle[0]!.status;

    const [updatedArticle] = await db
      .update(articles)
      .set(updateData)
      .where(eq(articles.id, articleId))
      .returning();

    // Trigger webhook if article was just published
    if (isPublishing && previousStatus !== 'published' && updatedArticle) {
      // Call the publish API to handle webhook delivery
      fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/api/articles/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          articleId: updatedArticle.id
        })
      }).catch((error: unknown) => {
        console.error('Failed to trigger publish webhook for article', updatedArticle.id, ':', error);
      });
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

    // Get user record from database
    const [userRecord] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerk_user_id, userId))
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

    // Check if article exists and belongs to current user
    const existingArticle = await db
      .select()
      .from(articles)
      .where(eq(articles.id, articleId))
      .limit(1);

    if (existingArticle.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'Article not found' 
      }, { status: 404 });
    }

    // Verify article ownership
    if (existingArticle[0]!.user_id !== userRecord.id) {
      return NextResponse.json(
        { success: false, error: 'Access denied: Article does not belong to current user' },
        { status: 403 }
      );
    }

    // Delete the article
    await db
      .delete(articles)
      .where(eq(articles.id, articleId));

    return NextResponse.json({ 
      success: true, 
      message: 'Article deleted successfully' 
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
