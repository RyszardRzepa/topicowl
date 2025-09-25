import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/server/db";
import { articles, articleGenerations, projects, webhookDeliveries, users } from "@/server/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { z } from "zod";
import { ARTICLE_STATUSES, type ArticleStatus, videoEmbedSchema } from "@/types";
import { logServerError } from "@/lib/posthog-server";
import type {
  ArticleGenerationArtifacts,
  ValidationArtifact,
  WriteArtifact,
} from "@/types";

// Types colocated with this API route
export interface SEOAnalysis {
  score: number;
  recommendations: string[];
  keywordDensity: Record<string, number>;
  readabilityScore: number;
}

export interface GenerationLog {
  phase: "research" | "writing" | "validation" | "optimization";
  status: "pending" | "completed" | "failed";
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
  content: string | null; // Final published content
  videos: unknown; // YouTube video embeds
  coverImageUrl: string | null;
  coverImageAlt: string | null;
  coverImageDescription?: string | null;
  coverImageKeywords?: unknown;
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
    seoScore?: number | null;
    internalLinks?: string[];
    sources?: string[];
    factCheckReport?: string | null;
  };
}

const updateArticleSchema = z.object({
  slug: z.string().optional(),
  metaDescription: z.string().optional(),
  metaKeywords: z.array(z.string()).optional(),
  content: z.string().optional(), // Article content (working + published)
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
  status: z.enum(ARTICLE_STATUSES).optional(),
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
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // Get current user from Clerk
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
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
        { success: false, error: "User not found" },
        { status: 404 },
      );
    }

    const { id } = await params;
    const articleId = parseInt(id);
    if (isNaN(articleId)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid article ID",
        },
        { status: 400 },
      );
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
        content: articles.content,
        videos: articles.videos,
        coverImageUrl: articles.coverImageUrl,
        coverImageAlt: articles.coverImageAlt,
        notes: articles.notes,
        createdAt: articles.createdAt,
        updatedAt: articles.updatedAt,
      })
      .from(articles)
      .innerJoin(projects, eq(articles.projectId, projects.id))
      .where(
        and(eq(articles.id, articleId), eq(projects.userId, userRecord.id)),
      )
      .limit(1);

    if (article.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Article not found or access denied",
        },
        { status: 404 },
      );
    }

    const articleData = article[0];
    if (!articleData) {
      return NextResponse.json(
        {
          success: false,
          error: "Article not found or access denied",
        },
        { status: 404 },
      );
    }

    // Also fetch the latest generation data to get the full content context
    const [generationData] = await db
      .select()
      .from(articleGenerations)
      .where(eq(articleGenerations.articleId, articleId))
      .orderBy(desc(articleGenerations.createdAt))
      .limit(1);
    const artifacts: ArticleGenerationArtifacts =
      generationData?.artifacts ?? {};
    const writeArtifact: WriteArtifact | undefined = artifacts.write;
    const researchArtifact = artifacts.research;
    const qcArtifact = artifacts.qualityControl;
    const validationArtifact: ValidationArtifact | undefined = artifacts.validation;

    const workingContent = writeArtifact?.content ?? articleData.content;

    const derivedSeoScore = validationArtifact?.seoScore ?? null;

    // Note: We don't use soft deletes anymore - article exists if we got here

    // Generate SEO analysis from existing data
    const seoAnalysis: SEOAnalysis | undefined = derivedSeoScore
      ? {
          score: derivedSeoScore,
          recommendations: generateSEORecommendations(articleData, derivedSeoScore),
          keywordDensity: calculateKeywordDensity(articleData, workingContent),
          readabilityScore: calculateReadabilityScore(articleData, workingContent),
        }
      : undefined;

    // Generate generation logs from generation artifacts
    const generationLogs: GenerationLog[] = generateGenerationLogs(
      generationData,
      artifacts,
      articleData,
    );

    // Calculate word count from content (use generation content if available)
    const wordCount = calculateWordCount(workingContent);

    // Extract target keywords from keywords field
    const targetKeywords =
      Array.isArray(articleData.keywords) &&
      articleData.keywords.every((keyword) => typeof keyword === "string")
        ? articleData.keywords
        : [];

    // Extract research sources from sources field
    const researchSources = researchArtifact?.sources
      ? researchArtifact.sources.map((source) =>
          source.title ? `${source.title} — ${source.url}` : source.url,
        )
      : [];

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
    const sourceList = researchSources;

    const response: ArticleDetailResponse = {
      success: true,
      data: {
        ...articleData,
        // Use generation content if available, otherwise fall back to stored content
        content: workingContent ?? articleData.content,
        factCheckReport,
        internalLinks,
        sources: sourceList,
        seoScore: derivedSeoScore,
        seoAnalysis,
        generationLogs,
        wordCount,
        targetKeywords,
        researchSources,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    await logServerError(error, { operation: "get_article" });
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch article",
      },
      { status: 500 },
    );
  }
}

// Helper functions for generating extended data
function generateSEORecommendations(
  article: ArticleData,
  seoScore: number | null,
): string[] {
  const recommendations: string[] = [];

  if (!article.metaDescription) {
    recommendations.push("Add a meta description for better search visibility");
  }

  if (
    !article.keywords ||
    (Array.isArray(article.keywords) && article.keywords.length === 0)
  ) {
    recommendations.push("Add target keywords to improve SEO ranking");
  }

  if (!article.content) {
    recommendations.push("Generate content to analyze SEO performance");
  }

  if (typeof seoScore === "number" && seoScore < 70) {
    recommendations.push("Improve content optimization to increase SEO score");
  }

  return recommendations;
}

function calculateKeywordDensity(
  article: ArticleData,
  generationContent?: string | null,
): Record<string, number> {
  const content = generationContent ?? article.content ?? "";
  const keywords = Array.isArray(article.keywords)
    ? (article.keywords as string[])
    : [];
  const density: Record<string, number> = {};

  if (!content || keywords.length === 0) {
    return density;
  }

  const words = content.toLowerCase().split(/\s+/).length;

  keywords.forEach((keyword: string) => {
    const keywordLower = keyword.toLowerCase();
    const matches = (
      content.toLowerCase().match(new RegExp(keywordLower, "g")) ?? []
    ).length;
    density[keyword] = words > 0 ? (matches / words) * 100 : 0;
  });

  return density;
}

function calculateReadabilityScore(
  article: ArticleData,
  generationContent?: string | null,
): number {
  const content = generationContent ?? article.content ?? "";

  if (!content) {
    return 0;
  }

  // Simple readability calculation based on sentence and word length
  const sentences = content
    .split(/[.!?]+/)
    .filter((s: string) => s.trim().length > 0);
  const words = content.split(/\s+/).filter((w: string) => w.length > 0);

  if (sentences.length === 0 || words.length === 0) {
    return 0;
  }

  const avgWordsPerSentence = words.length / sentences.length;
  const avgSyllablesPerWord =
    words.reduce((acc: number, word: string) => {
      return acc + countSyllables(word);
    }, 0) / words.length;

  // Simplified Flesch Reading Ease formula
  const score =
    206.835 - 1.015 * avgWordsPerSentence - 84.6 * avgSyllablesPerWord;

  return Math.max(0, Math.min(100, Math.round(score)));
}

function countSyllables(word: string): number {
  word = word.toLowerCase();
  if (word.length <= 3) return 1;
  word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "");
  word = word.replace(/^y/, "");
  const matches = word.match(/[aeiouy]{1,2}/g);
  return matches ? matches.length : 1;
}

function calculateWordCount(content: string | null): number {
  if (!content) return 0; // fine, boolean check still acceptable
  return content.split(/\s+/).filter((word) => word.length > 0).length;
}

function generateGenerationLogs(
  generation:
    | (typeof articleGenerations.$inferSelect & {
        artifacts?: unknown;
      })
    | undefined,
  artifacts: ArticleGenerationArtifacts,
  article: ArticleData,
): GenerationLog[] {
  const logs: GenerationLog[] = [];
  const baseTimestamp = generation?.updatedAt
    ? new Date(generation.updatedAt)
    : new Date(article.updatedAt);

  if (artifacts.research) {
    logs.push({
      phase: "research",
      status: "completed",
      timestamp: baseTimestamp,
      details: "Research data captured",
    });
  }

  if (artifacts.write?.content ?? article.content) {
    logs.push({
      phase: "writing",
      status: "completed",
      timestamp: baseTimestamp,
      details: "Draft content generated",
    });
  }

  const qcReport =
    artifacts.qualityControl && typeof artifacts.qualityControl === "object"
      ? (artifacts.qualityControl as { report?: string | null }).report
      : undefined;

  if (qcReport) {
    logs.push({
      phase: "validation",
      status: "completed",
      timestamp: baseTimestamp,
      details: "Quality control report completed",
    });
  }

  if (artifacts.validation) {
    logs.push({
      phase: "validation",
      status: artifacts.validation.isValid ? "completed" : "failed",
      timestamp: baseTimestamp,
      details: artifacts.validation.isValid
        ? "Validation checks passed"
        : "Validation issues found",
    });
  }

  return logs.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
}

// PUT /api/articles/[id] - Update article
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // Get current user from Clerk
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
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
        { success: false, error: "User not found" },
        { status: 404 },
      );
    }

    const { id } = await params;
    const articleId = parseInt(id);
    if (isNaN(articleId)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid article ID",
        },
        { status: 400 },
      );
    }

    const body = (await req.json()) as unknown;
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
      .where(
        and(eq(articles.id, articleId), eq(projects.userId, userRecord.id)),
      )
      .limit(1);

    if (existingArticle.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Article not found or access denied",
        },
        { status: 404 },
      );
    }

    // Note: We don't use soft deletes anymore

    // Update the article with only the allowed fields
    const {
      optimizedContent,
      content: contentPayload,
      scheduledAt,
      ...otherFields
    } = validatedData;

    const updateData: Record<string, unknown> = {
      ...otherFields,
      // Convert string dates to Date objects for database
      publishScheduledAt:
        scheduledAt == null ? undefined : new Date(scheduledAt),
      publishedAt:
        validatedData.publishedAt == null
          ? undefined
          : new Date(validatedData.publishedAt),
      updatedAt: new Date(),
    };

    if (contentPayload !== undefined) {
      updateData.content = contentPayload;
    } else if (optimizedContent !== undefined) {
      updateData.content = optimizedContent;
    }

    // Handle field mapping for frontend compatibility
    if (Object.prototype.hasOwnProperty.call(validatedData, "publishScheduledAt")) {
      updateData.publishScheduledAt =
        validatedData.publishScheduledAt == null
          ? undefined
          : new Date(validatedData.publishScheduledAt);
    }

    const [updatedArticle] = await db
      .update(articles)
      .set(updateData)
      .where(eq(articles.id, articleId))
      .returning();

    // If content was updated, also sync it to the latest articleGenerations row (if any)
    const contentProvided =
      Object.prototype.hasOwnProperty.call(validatedData, "content") ||
      Object.prototype.hasOwnProperty.call(validatedData, "optimizedContent");
    const contentToSync = contentPayload ?? optimizedContent;

    if (contentProvided && contentToSync !== undefined) {
      try {
        const latestGen = await db
          .select({ id: articleGenerations.id, artifacts: articleGenerations.artifacts })
          .from(articleGenerations)
          .where(eq(articleGenerations.articleId, articleId))
          .orderBy(desc(articleGenerations.createdAt))
          .limit(1);

        const latestGenerationRow = latestGen[0];
        if (latestGenerationRow) {
          const existingArtifacts: ArticleGenerationArtifacts =
            latestGenerationRow.artifacts;
          const existingWriteArtifact: WriteArtifact | undefined =
            existingArtifacts.write;
          await db
            .update(articleGenerations)
            .set({
              artifacts: {
                ...existingArtifacts,
                write: {
                  ...existingWriteArtifact,
                  content: contentToSync,
                },
              },
              updatedAt: new Date(),
            })
            .where(eq(articleGenerations.id, latestGenerationRow.id));
        }
      } catch (syncError) {
        // Non-fatal: log and continue; we don't want to fail the primary article update
        console.error("Failed to sync content to articleGenerations:", syncError);
      }
    }

    return NextResponse.json({
      success: true,
      data: updatedArticle,
    });
  } catch (error) {
    console.error("Update article error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid input data",
          details: error.errors,
        },
        { status: 400 },
      );
    }
    return NextResponse.json(
      {
        success: false,
        error: "Failed to update article",
      },
      { status: 500 },
    );
  }
}

// DELETE /api/articles/[id] - Delete article
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // Get current user from Clerk
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
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
        { success: false, error: "User not found" },
        { status: 404 },
      );
    }

    const { id } = await params;
    const articleId = parseInt(id);
    if (isNaN(articleId)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid article ID",
        },
        { status: 400 },
      );
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
      .where(
        and(eq(articles.id, articleId), eq(projects.userId, userRecord.id)),
      )
      .limit(1);

    if (existingArticle.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Article not found or access denied",
        },
        { status: 404 },
      );
    }

    // Prevent deleting while actively generating to avoid race conditions
    if (existingArticle[0]!.status === "generating") {
      return NextResponse.json(
        {
          success: false,
          error: "Cannot delete an article while it is generating",
        },
        { status: 409 },
      );
    }

    // Hard delete: remove dependent records first to satisfy FKs, then remove the article
    // Note: no generation_queue to clean up anymore
    await db
      .delete(articleGenerations)
      .where(eq(articleGenerations.articleId, articleId));
    await db.delete(webhookDeliveries).where(eq(webhookDeliveries.articleId, articleId));

    const [removed] = await db
      .delete(articles)
      .where(eq(articles.id, articleId))
      .returning({ id: articles.id, title: articles.title });

    return NextResponse.json({
      success: true,
      message: "Article permanently deleted",
      data: removed,
    });
  } catch (error) {
    console.error("Delete article error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to delete article",
      },
      { status: 500 },
    );
  }
}
