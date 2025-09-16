import { db } from "@/server/db";
import {
  articleGeneration,
  articles,
  projects,
  users,
  type ArticleStatus,
} from "@/server/db/schema";
import { eq, and, desc, ne } from "drizzle-orm";
import type { VideoEmbed } from "@/types";

import { getProjectExcludedDomains } from "@/lib/utils/article-generation";
import { getRelatedArticles } from "@/lib/utils/related-articles";
import { hasEnoughCredits, deductCredits } from "@/lib/utils/credits";
import { getCreditCost } from "@/lib/utils/credit-costs";
import { logger } from "@/lib/utils/logger";

import {
  createParallelResearchTask,
} from "@/lib/services/research-service";
import type { ResearchResponse } from "@/lib/services/research-service";
import { performWriteLogic as performWrite } from "@/lib/services/write-service";
import type { WriteResponse } from "@/lib/services/write-service";
import { performQualityControlLogic as runQualityControl } from "@/lib/services/quality-control-service";
import type { QualityControlResponse } from "@/lib/services/quality-control-service";
import { performValidateLogic as runValidation } from "@/lib/services/validation-service";
import type { ValidateResponse } from "@/lib/services/validation-service";
import { performImageSelectionLogic as findCoverImage } from "@/lib/services/image-selection-service";

export interface GenerationContext {
  articleId: number;
  userId: string;
  article: typeof articles.$inferSelect;
  keywords: string[];
  relatedArticles: string[];
}

async function mergeArtifacts(
  generationId: number,
  fragment: Record<string, unknown>,
): Promise<void> {
  const [current] = await db
    .select({ artifacts: articleGeneration.artifacts })
    .from(articleGeneration)
    .where(eq(articleGeneration.id, generationId))
    .limit(1);
  const next = { ...(current?.artifacts ?? {}), ...fragment } as Record<
    string,
    unknown
  >;
  await db
    .update(articleGeneration)
    .set({ artifacts: next, updatedAt: new Date(), lastUpdated: new Date() })
    .where(eq(articleGeneration.id, generationId));
}

export async function claimArticleForGeneration(
  articleId: number,
): Promise<"claimed" | "already_generating" | "not_claimable"> {
  const [updated] = await db
    .update(articles)
    .set({ status: "generating", updatedAt: new Date() })
    .where(
      and(
        eq(articles.id, articleId),
        ne(articles.status, "generating"),
        ne(articles.status, "published"),
        // Note: removed "deleted" status check since we do hard deletes
      ),
    )
    .returning({ id: articles.id });

  if (updated) return "claimed";

  const [current] = await db
    .select({ status: articles.status })
    .from(articles)
    .where(eq(articles.id, articleId))
    .limit(1);
  if (!current) return "not_claimable";
  if (current.status === "generating") return "already_generating";
  return "not_claimable";
}

export async function validateAndSetupGeneration(
  userId: string,
  articleId: string,
  forceRegenerate?: boolean,
): Promise<GenerationContext> {
  const [userRecord] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!userRecord) throw new Error("User not found");

  const requiredCredits = getCreditCost("ARTICLE_GENERATION");
  const userHasEnoughCredits = await hasEnoughCredits(
    userRecord.id,
    requiredCredits,
  );
  if (!userHasEnoughCredits)
    throw new Error(
      `Insufficient credits for article generation (requires ${requiredCredits} credits)`,
    );

  if (!articleId || isNaN(parseInt(articleId)))
    throw new Error("Invalid article ID");
  const id = parseInt(articleId);

  const [result] = await db
    .select()
    .from(articles)
    .innerJoin(projects, eq(articles.projectId, projects.id))
    .where(and(eq(articles.id, id), eq(projects.userId, userRecord.id)))
    .limit(1);

  if (!result) throw new Error("Article not found or access denied");

  const existingArticle = result.articles;

  if (existingArticle.status === "generating" && !forceRegenerate)
    throw new Error("Article generation already in progress");

  const keywords = Array.isArray(existingArticle.keywords)
    ? (existingArticle.keywords as string[])
    : [];
  const effectiveKeywords =
    keywords.length > 0 ? keywords : [existingArticle.title];

  const relatedArticles = await getRelatedArticles(
    existingArticle.projectId,
    existingArticle.title,
    effectiveKeywords,
  );

  return {
    articleId: id,
    userId: userRecord.id,
    article: existingArticle,
    keywords: effectiveKeywords,
    relatedArticles,
  };
}

export async function createOrResetArticleGeneration(
  articleId: number,
  userId: string,
): Promise<typeof articleGeneration.$inferSelect> {
  const [article] = await db
    .select({ projectId: articles.projectId })
    .from(articles)
    .where(eq(articles.id, articleId))
    .limit(1);
  if (!article) throw new Error(`Article ${articleId} not found`);

  const [existingRecord] = await db
    .select()
    .from(articleGeneration)
    .where(eq(articleGeneration.articleId, articleId))
    .orderBy(desc(articleGeneration.createdAt))
    .limit(1);

  if (existingRecord) {
    const existingRelated = Array.isArray(existingRecord.relatedArticles)
      ? existingRecord.relatedArticles
      : [];

    const [updatedRecord] = await db
      .update(articleGeneration)
      .set({
        status: "scheduled",
        progress: 0,
        startedAt: null,
        completedAt: null,
        error: null,
        errorDetails: null,
        draftContent: null,
        validationReport: {},
        qualityControlReport: null,
        researchData: {},
        seoReport: {},
        imageKeywords: [],
        relatedArticles: existingRelated.length > 0 ? existingRelated : [],
        updatedAt: new Date(),
      })
      .where(eq(articleGeneration.id, existingRecord.id))
      .returning();

    if (!updatedRecord) throw new Error("Failed to reset generation record");
    return updatedRecord;
  }

  const result = await db
    .insert(articleGeneration)
    .values({
      articleId,
      userId,
      projectId: article.projectId,
      status: "scheduled",
      progress: 0,
      startedAt: null,
      validationReport: {},
      researchData: {},
      seoReport: {},
      imageKeywords: [],
      relatedArticles: [],
    })
    .returning();

  const record = result[0];
  if (!record) throw new Error("Failed to create generation record");
  return record;
}

export async function updateGenerationProgress(
  generationId: number,
  status: ArticleStatus,
  progress: number,
  additionalData?: Record<string, unknown>,
): Promise<void> {
  await db
    .update(articleGeneration)
    .set({ status, progress, updatedAt: new Date(), ...additionalData })
    .where(eq(articleGeneration.id, generationId));
}

async function performResearch(
  title: string,
  keywords: string[],
  generationId: number,
  projectId: number,
  notes?: string,
): Promise<ResearchResponse> {
  await updateGenerationProgress(generationId, "research", 10);
  logger.debug("research:start", { title, keywordsCount: keywords.length });

  const excludedDomains = await getProjectExcludedDomains(projectId);

  // Try using Parallel API with webhook
  try {
    const task = await createParallelResearchTask(
      title,
      keywords,
      notes,
      excludedDomains,
    );
    await mergeArtifacts(generationId, { research_run_id: task.run_id });
    // Webhook will handle the rest
    return {
      researchData:
        "Research is in progress and will be delivered via webhook.",
      sources: [],
      videos: [],
    };
  } catch (error) {
    logger.error("research:parallel_failed", error);
    try {
      await updateGenerationProgress(generationId, "failed", 100, {
        error:
          error instanceof Error ? error.message : "Unknown research error",
      });
    } catch (updateError) {
      logger.error("research:status_update_failed", updateError);
    }
    throw new Error(
      `Research failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

async function selectCoverImage(
  articleId: number,
  generationId: number,
  title: string,
  keywords: string[],
  userId: string,
  projectId: number,
): Promise<{ coverImageUrl: string; coverImageAlt: string }> {
  try {
    await updateGenerationProgress(generationId, "image", 30);
    const imageResult = await findCoverImage({
      articleId,
      generationId,
      title,
      keywords,
      orientation: "landscape",
      userId,
      projectId,
    });
    if (imageResult.success && imageResult.data?.coverImageUrl) {
      await mergeArtifacts(generationId, {
        coverImage: {
          imageUrl: imageResult.data.coverImageUrl,
          altText: imageResult.data.coverImageAlt,
        },
      });
      return {
        coverImageUrl: imageResult.data.coverImageUrl,
        coverImageAlt: imageResult.data.coverImageAlt ?? "",
      };
    }
  } catch (error) {
    logger.warn("image:selection_failed", error);
  }
  return { coverImageUrl: "", coverImageAlt: "" };
}

async function writeArticle(
  researchData: ResearchResponse,
  title: string,
  keywords: string[],
  coverImageUrl: string,
  generationId: number,
  userId: string,
  projectId: number,
  relatedArticles: string[],
  videos?: Array<{ title: string; url: string }>,
  notes?: string,
  outlineMarkdown?: string,
  sourcesOverride?: Array<{ url: string; title?: string }>,
  screenshotsForWriter?: Array<{
    url: string;
    alt?: string;
    sectionHeading?: string;
    placement?: "start" | "middle" | "end";
  }>,
): Promise<WriteResponse> {
  await updateGenerationProgress(generationId, "writing", 35);
  logger.debug("ai-first-writing:start", {
    title,
    hasCoverImage: !!coverImageUrl,
    hasOutline: !!outlineMarkdown,
  });

  try {
    const writeResult = await performWrite({
      researchData,
      title,
      keywords,
      coverImage: coverImageUrl,
      videos,
      userId,
      projectId,
      relatedArticles,
      generationId,
      sources:
        sourcesOverride && sourcesOverride.length > 0
          ? sourcesOverride
          : (researchData.sources ?? []),
      notes: notes ?? undefined,
      outlineMarkdown,
      screenshots: screenshotsForWriter,
    });
    await mergeArtifacts(generationId, { write: writeResult });
    return writeResult;
  } catch (error) {
    logger.error("ai-first-writing:failed", error);
    await updateGenerationProgress(generationId, "failed", 100, {
      error: "Failed to write article",
    });
    throw new Error(
      `Failed to write article: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

async function performQualityControl(
  content: string,
  generationId: number,
  userId: string,
  projectId: number,
): Promise<QualityControlResponse> {
  const startTime = Date.now();
  logger.debug("quality-control:start", { generationId });
  try {
    await updateGenerationProgress(generationId, "quality-control", 75);
    const qcResult = await runQualityControl({
      articleContent: content,
      userSettings: undefined,
      originalPrompt: "",
      userId,
      projectId,
      generationId,
    });
    const duration = Date.now() - startTime;
    logger.debug("quality-control:complete", {
      duration,
      issues: qcResult.issues?.length,
    });
    await db
      .update(articleGeneration)
      .set({
        qualityControlReport:
          typeof qcResult.issues === "string" ? qcResult.issues : null,
      })
      .where(eq(articleGeneration.id, generationId));
    return qcResult;
  } catch (error) {
    logger.error("quality-control:failed", error);
    await updateGenerationProgress(generationId, "failed", 100, {
      error: "Quality control check failed",
    });
    throw new Error(
      `Quality control failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

async function validateArticle(
  content: string,
  generationId: number,
): Promise<ValidateResponse> {
  logger.debug("validation:start", { generationId });
  try {
    await updateGenerationProgress(generationId, "validating", 85);
    const validationResult = await runValidation(content);
    await mergeArtifacts(generationId, { validation: validationResult });
    return validationResult;
  } catch (error) {
    logger.error("validation:failed", error);
    await updateGenerationProgress(generationId, "failed", 100, {
      error: "Article validation failed",
    });
    throw new Error(
      `Article validation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

async function finalizeArticle(
  articleId: number,
  writeData: WriteResponse,
  content: string,
  coverImageUrl: string,
  coverImageAlt: string,
  generationId: number,
  userId: string,
  publishReady: boolean,
  videos?: VideoEmbed[],
): Promise<void> {
  // Ensure intro paragraph exists immediately after H1
  const intro = (writeData.introParagraph ?? "").trim();
  const finalContentWithIntro = intro
    ? ensureSingleIntro(content, intro)
    : content;

  const updateData: {
    draft: string;
    videos?: VideoEmbed[];
    slug?: string;
    metaDescription: string;
    metaKeywords?: string[];
    status: "wait_for_publish" | "scheduled";
    updatedAt: Date;
    coverImageUrl?: string;
    coverImageAlt?: string;
    introParagraph?: string;
  } = {
    draft: finalContentWithIntro,
    videos: videos ?? [],
    metaDescription: writeData.metaDescription ?? "",
    status: publishReady ? "wait_for_publish" : "scheduled",
    updatedAt: new Date(),
  };
  if (writeData.slug) updateData.slug = writeData.slug;
  if (writeData.tags && writeData.tags.length > 0)
    updateData.metaKeywords = writeData.tags;
  if (coverImageUrl) {
    updateData.coverImageUrl = coverImageUrl;
    updateData.coverImageAlt = coverImageAlt;
  }

  // Persist intro paragraph to articles if provided by AI
  if (intro) {
    updateData.introParagraph = intro;
  }

  await db.update(articles).set(updateData).where(eq(articles.id, articleId));

  const generationUpdate: Record<string, unknown> = {
    status: "completed",
    progress: 100,
    completedAt: new Date(),
    draftContent: finalContentWithIntro,
    updatedAt: new Date(),
  };
  if (writeData.relatedPosts && writeData.relatedPosts.length > 0) {
    generationUpdate.relatedArticles = writeData.relatedPosts;
  }
  await db
    .update(articleGeneration)
    .set(generationUpdate)
    .where(eq(articleGeneration.id, generationId));

  const creditsToDeduct = getCreditCost("ARTICLE_GENERATION");
  const creditDeducted = await deductCredits(userId, creditsToDeduct);
  if (!creditDeducted)
    logger.warn("credits:deduct_failed", {
      userId,
      articleId,
      amount: creditsToDeduct,
    });
}

// Ensure exactly one intro paragraph exists between H1 and TL;DR (or first H2 if TL;DR missing)
function ensureSingleIntro(markdown: string, intro: string): string {
  const lines = markdown.split(/\r?\n/);
  if (lines.length === 0) return intro;

  // Find H1
  let h1Idx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i]?.startsWith("# ")) {
      h1Idx = i;
      break;
    }
  }
  if (h1Idx === -1) {
    // No H1 found, prepend intro to be safe
    const existingContent = lines.join("\n").trim();
    if (
      !existingContent
        .toLowerCase()
        .includes(intro.substring(0, 20).toLowerCase())
    ) {
      return `${intro}\n\n${existingContent}`;
    }
    return existingContent;
  }
  if (h1Idx === -1) return markdown; // can't enforce safely

  // Find TL;DR heading after H1 (case-insensitive)
  const tldrIdx = lines.findIndex(
    (l, idx) => idx > h1Idx && /^\s*##\s*TL;DR\s*$/i.test(l),
  );

  // Fallback: first H2+ heading after H1 if TL;DR not found
  const firstH2Idx = lines.findIndex(
    (l, idx) => idx > h1Idx && /^\s*##\s+/.test(l),
  );
  const stopIdx =
    tldrIdx !== -1 ? tldrIdx : firstH2Idx !== -1 ? firstH2Idx : -1;

  const head = lines.slice(0, h1Idx + 1).join("\n");
  const tail =
    stopIdx !== -1
      ? lines.slice(stopIdx).join("\n")
      : lines.slice(h1Idx + 1).join("\n");

  // Rebuild so that between H1 and stopIdx there is exactly one intro paragraph
  const rebuilt = `${head}\n\n${intro.trim()}\n\n${tail}`.replace(
    /\n{3,}/g,
    "\n\n",
  );
  return rebuilt;
}

export async function handleGenerationError(
  articleId: number,
  generationId: number | null,
  error: Error,
): Promise<void> {
  logger.error("generation:error", error.message);
  try {
    // Update main article status to "failed"
    await db
      .update(articles)
      .set({ status: "failed", updatedAt: new Date() })
      .where(eq(articles.id, articleId));

    if (generationId) {
      // Update generation record with error details
      await db
        .update(articleGeneration)
        .set({
          status: "failed",
          progress: 100,
          error: error.message,
          errorDetails:
            error instanceof Error
              ? {
                  name: error.name,
                  stack: error.stack,
                  cause: error.cause,
                }
              : { info: "Non-error object thrown" },
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(articleGeneration.id, generationId));
    }
  } catch (dbError) {
    logger.error("generation:db_error_on_error_handling", dbError);
  }
}

export async function generateArticle(
  context: GenerationContext,
): Promise<void> {
  const { articleId, userId, article, keywords } = context;
  let generationRecord: typeof articleGeneration.$inferSelect | null = null;

  try {
    generationRecord = await createOrResetArticleGeneration(articleId, userId);
    const generationId = generationRecord.id;

    await updateGenerationProgress(generationId, "research", 5);

    const researchResult = await performResearch(
      article.title,
      keywords,
      generationId,
      article.projectId,
      article.notes ?? undefined,
    );

    // If research is async (webhook), the process stops here.
    // The webhook handler will call continueGenerationFromPhase.
    const artifacts = (generationRecord.artifacts ?? {}) as Record<
      string,
      unknown
    >;
    if (artifacts.research_run_id) {
      logger.debug("research:async_started", { articleId, generationId });
      return;
    }

    // For sync research, continue the pipeline
    await continueGenerationPipeline(generationId, context, researchResult);
  } catch (error) {
    logger.error("generateArticle:error", error);
    if (articleId && generationRecord) {
      await handleGenerationError(
        articleId,
        generationRecord.id,
        error instanceof Error ? error : new Error("Unknown generation error"),
      );
    }
  }
}

/**
 * Helper function to continue generation after async research completion
 */
export async function continueGenerationFromPhase(
  generationId: number,
  startFromPhase: ArticleStatus,
  researchData?: ResearchResponse,
): Promise<void> {
  try {
    const [genRecord] = await db
      .select()
      .from(articleGeneration)
      .where(eq(articleGeneration.id, generationId))
      .limit(1);

    if (!genRecord)
      throw new Error(`Generation record ${generationId} not found`);

    const [articleRecord] = await db
      .select()
      .from(articles)
      .where(eq(articles.id, genRecord.articleId))
      .limit(1);

    if (!articleRecord)
      throw new Error(`Article ${genRecord.articleId} not found`);

    const context: GenerationContext = {
      articleId: articleRecord.id,
      userId: genRecord.userId,
      article: articleRecord,
      keywords: Array.isArray(articleRecord.keywords)
        ? (articleRecord.keywords as string[])
        : [articleRecord.title],
      relatedArticles: [], // This can be enriched if needed
    };

    let currentResearchData = researchData;
    if (!currentResearchData) {
      const artifacts = (genRecord.artifacts ?? {}) as Record<string, unknown>;
      if (artifacts.research) {
        currentResearchData = artifacts.research as ResearchResponse;
      } else {
        // If no research data, we might need to re-run research
        if (startFromPhase !== "research") {
          logger.warn("continue:no_research_data", {
            generationId,
            startFromPhase,
          });
          // Decide if we should throw an error or re-initiate research
        }
      }
    }

    switch (startFromPhase) {
      case "research":
        // This would typically re-initiate the full process
        await generateArticle(context);
        break;

      case "outline":
        // Assuming research is complete, generate outline
        // This phase is currently integrated into writing, so we proceed to write
        logger.debug("continue:outline_phase", { generationId });
        if (currentResearchData) {
          await continueGenerationPipeline(
            generationId,
            context,
            currentResearchData,
          );
        } else {
          throw new Error("Cannot proceed to outline without research data");
        }
        break;

      case "image":
        logger.debug("continue:image_phase", { generationId });
        if (currentResearchData) {
          await continueGenerationPipeline(
            generationId,
            context,
            currentResearchData,
          );
        } else {
          throw new Error(
            "Cannot proceed to image selection without research data",
          );
        }
        break;

      // Other phases can be added here
      default:
        logger.debug("continue:default_phase", {
          generationId,
          startFromPhase,
        });
        if (currentResearchData) {
          await continueGenerationPipeline(
            generationId,
            context,
            currentResearchData,
          );
        } else {
          throw new Error(
            `Cannot proceed to ${startFromPhase} without research data`,
          );
        }
    }
  } catch (error) {
    logger.error("continueGeneration:error", error);
    const genId = generationId;
    if (genId) {
      const [genRecord] = await db
        .select()
        .from(articleGeneration)
        .where(eq(articleGeneration.id, genId))
        .limit(1);
      if (genRecord) {
        await handleGenerationError(
          genRecord.articleId,
          genId,
          error instanceof Error
            ? error
            : new Error("Unknown continuation error"),
        );
      }
    }
  }
}

/**
 * Continue the generation pipeline from image selection onward
 */
async function continueGenerationPipeline(
  generationId: number,
  context: GenerationContext,
  researchData: ResearchResponse,
): Promise<void> {
  const { articleId, userId, article, keywords } = context;

  try {
    const { coverImageUrl, coverImageAlt } = await selectCoverImage(
      articleId,
      generationId,
      article.title,
      keywords,
      userId,
      article.projectId,
    );

    const writeResult = await writeArticle(
      researchData,
      article.title,
      keywords,
      coverImageUrl,
      generationId,
      userId,
      article.projectId,
      context.relatedArticles,
      researchData.videos,
      article.notes ?? undefined,
    );

    const qcResult = await performQualityControl(
      writeResult.content,
      generationId,
      userId,
      article.projectId,
    );

    const finalContent = writeResult.content;

    const validationResult = await validateArticle(finalContent, generationId);

    const publishReady =
      article.status === "wait_for_publish" &&
      qcResult.isValid &&
      validationResult.isValid;
    await finalizeArticle(
      articleId,
      writeResult,
      finalContent,
      coverImageUrl,
      coverImageAlt,
      generationId,
      userId,
      publishReady,
      researchData.videos
        ? researchData.videos.map((v) => ({
            url: v.url,
            title: v.title,
            source: "youtube",
          }))
        : [],
    );

    logger.debug("generateArticle:success", { articleId, generationId });
  } catch (error) {
    logger.error("continueGenerationPipeline:error", error);
    await handleGenerationError(
      articleId,
      generationId,
      error instanceof Error
        ? error
        : new Error("Unknown pipeline continuation error"),
    );
  }
}
