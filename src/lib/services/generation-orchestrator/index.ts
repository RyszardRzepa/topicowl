import { db } from "@/server/db";
import {
  articleGenerations,
  articles,
  projects,
} from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { logger } from "@/lib/utils/logger";
import type { ArticleGenerationStatus } from "@/server/db/schema";
import type { ResearchResponse } from "@/lib/services/research-service";

import { updateGenerationProgress } from "./utils";
import { mergeArtifacts } from "./utils";
import { handleGenerationError } from "./utils";
import { createOrResetArticleGeneration, type GenerationContext } from "./validation";
import { performResearch } from "./research";
import { selectCoverImage } from "./image-selection";
import { writeArticle } from "./writing";
import { performQualityControl } from "./quality-control";
import { validateArticle, finalizeArticle } from "./finalization";
import { enhanceArticleWithScreenshots } from "./screenshots";
import { performGenericUpdate } from "@/lib/services/update-service";

export {
  validateAndSetupGeneration,
  createOrResetArticleGeneration,
  claimArticleForGeneration,
} from "./validation";

export { handleGenerationError } from "./utils";

export async function generateArticle(
  context: GenerationContext,
): Promise<void> {
  const { articleId, userId, article, keywords } = context;
  let generationRecord: typeof articleGenerations.$inferSelect | null = null;

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
    // The webhook handler will call continueGenerationFromPhase once data arrives.
    const [latestGeneration] = await db
      .select({ artifacts: articleGenerations.artifacts })
      .from(articleGenerations)
      .where(eq(articleGenerations.id, generationId))
      .limit(1);
    const latestArtifacts = latestGeneration?.artifacts ?? undefined;
    if (typeof latestArtifacts?.research_run_id === "string") {
      logger.debug("research:async_pending", {
        articleId,
        generationId,
        runId: latestArtifacts.research_run_id,
      });
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
  startFromPhase: ArticleGenerationStatus,
  researchData?: ResearchResponse,
): Promise<void> {
  try {
    const [genRecord] = await db
      .select()
      .from(articleGenerations)
      .where(eq(articleGenerations.id, generationId))
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
        .from(articleGenerations)
        .where(eq(articleGenerations.id, genId))
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
    const [projectSettings] = await db
      .select({
        toneOfVoice: projects.toneOfVoice,
        articleStructure: projects.articleStructure,
        maxWords: projects.maxWords,
      })
      .from(projects)
      .where(eq(projects.id, article.projectId))
      .limit(1);

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

    const screenshotEnhancement = await enhanceArticleWithScreenshots({
      content: writeResult.content,
      sources: researchData.sources ?? [],
      articleId,
      projectId: article.projectId,
      generationId,
      articleTitle: article.title,
    });

    let enhancedWriteResult =
      screenshotEnhancement?.content !== undefined
        ? { ...writeResult, content: screenshotEnhancement.content }
        : writeResult;

    if (screenshotEnhancement) {
      await mergeArtifacts(generationId, {
        screenshots: screenshotEnhancement.artifacts,
        screenshotUsageStats: screenshotEnhancement.usageStats,
      });
    }

    const [artifactsRecord] = await db
      .select({ artifacts: articleGenerations.artifacts })
      .from(articleGenerations)
      .where(eq(articleGenerations.id, generationId))
      .limit(1);
    const artifacts = artifactsRecord?.artifacts ?? undefined;
    const storedPrompt = artifacts?.write?.prompt;

    if (!storedPrompt) {
      logger.warn("quality-control:missing_prompt", { generationId });
    }
    const originalPrompt =
      storedPrompt?.trim() && storedPrompt.trim().length > 0
        ? storedPrompt.trim()
        : `Article generation prompt for "${article.title}"`;

    const qcResult = await performQualityControl(
      enhancedWriteResult.content,
      generationId,
      userId,
      article.projectId,
      originalPrompt,
    );

    let finalContent = enhancedWriteResult.content;

    const validationResult = await validateArticle(finalContent, generationId);

    const combinedIssueSections: string[] = [];
    const validationText = (validationResult.rawValidationText ?? "").trim();
    const hasValidationIssues =
      !validationResult.isValid || validationResult.issues.length > 0;
    if (hasValidationIssues && validationText.length > 0) {
      combinedIssueSections.push(`## Validation Issues\n\n${validationText}`);
    }

    const qualityControlIssues =
      typeof qcResult.issues === "string" ? qcResult.issues.trim() : "";
    if (qualityControlIssues.length > 0) {
      combinedIssueSections.push(
        `## Quality Control Issues\n\n${qualityControlIssues}`,
      );
    }

    if (combinedIssueSections.length > 0) {
      const updateSettings = {
        toneOfVoice: projectSettings?.toneOfVoice ?? undefined,
        articleStructure: projectSettings?.articleStructure ?? undefined,
        maxWords:
          typeof projectSettings?.maxWords === "number"
            ? projectSettings?.maxWords
            : undefined,
      };

      await updateGenerationProgress(generationId, "updating", 90);
      const updateResult = await performGenericUpdate({
        article: finalContent,
        validationText: combinedIssueSections.join("\n\n"),
        settings: updateSettings,
      });

      finalContent = updateResult.updatedContent;
      enhancedWriteResult = { ...enhancedWriteResult, content: finalContent };
    }

    await mergeArtifacts(generationId, {
      write: enhancedWriteResult,
    });

    const publishReady = qcResult.isValid && validationResult.isValid;
    await finalizeArticle(
      articleId,
      enhancedWriteResult,
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
