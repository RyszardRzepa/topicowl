import { db } from "@/server/db";
import {
  articles,
  articleGenerations,
} from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { logger } from "@/lib/utils/logger";
import { performValidation as runValidation } from "@/lib/services/content-validation";
import type { ValidateResponse } from "@/lib/services/content-validation";
import type { WriteResponse } from "@/lib/services/content-generation";
import type { VideoEmbed } from "@/types";
import type { ArticleGenerationStatus } from "@/types";
import { getCreditCost } from "@/lib/utils/credit-costs";
import { deductCredits } from "@/lib/utils/credits";
import { updateGenerationProgress } from "./progress";
import { mergeArtifacts } from "./artifacts";
import { ensureSingleIntro } from "./progress";

interface ValidationRunOptions {
  progress?: number;
  status?: ArticleGenerationStatus;
  skipProgressUpdate?: boolean;
  label?: "initial" | "post-update";
}

async function validateArticle(
  content: string,
  generationId: number,
  options?: ValidationRunOptions,
): Promise<ValidateResponse> {
  logger.debug("validation:start", { generationId });
  try {
    if (!options?.skipProgressUpdate) {
      const status = options?.status ?? "validating";
      const progress = options?.progress ?? 85;
      await updateGenerationProgress(generationId, status, progress);
    }
    const validationResult = await runValidation({ content });
    await mergeArtifacts(generationId, {
      validation: {
        ...validationResult,
        runLabel: options?.label ?? "initial",
      },
    });
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
  logger.debug("finalization:start", {
    articleId,
    generationId,
    publishReady,
    userId,
  });

  // Ensure intro paragraph exists immediately after H1
  const intro = (writeData.introParagraph ?? "").trim();
  const finalContentWithIntro = intro
    ? ensureSingleIntro(content, intro)
    : content;

  const updateData: {
    content: string;
    videos?: VideoEmbed[];
    slug?: string;
    metaDescription: string;
    metaKeywords?: string[];
    status: "scheduled";
    updatedAt: Date;
    coverImageUrl?: string;
    coverImageAlt?: string;
    introParagraph?: string;
  } = {
    content: finalContentWithIntro,
    videos: videos ?? [],
    metaDescription: writeData.metaDescription ?? "",
    status: "scheduled",
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

  const generationUpdate: Record<string, unknown> = {
    status: "completed",
    progress: 100,
    completedAt: new Date(),
    updatedAt: new Date(),
  };

  // Use database transaction to ensure atomicity between article update,
  // generation completion, and credit deduction
  try {
    await db.transaction(async (tx) => {
      // Update article with finalized content
      await tx.update(articles).set(updateData).where(eq(articles.id, articleId));

      // Mark generation as completed
      await tx
        .update(articleGenerations)
        .set(generationUpdate)
        .where(eq(articleGenerations.id, generationId));

      logger.debug("finalization:db_updates_complete", {
        articleId,
        generationId,
        status: updateData.status,
      });
    });

    // Only deduct credits for successful generations that are ready for publishing
    // Credits should only be charged when the user gets a complete, usable article
    if (publishReady) {
      const creditsToDeduct = getCreditCost("ARTICLE_GENERATION");
      logger.debug("finalization:deducting_credits", {
        userId,
        articleId,
        amount: creditsToDeduct,
        reason: "successful_generation_ready_for_publish",
      });

      const creditDeducted = await deductCredits(userId, creditsToDeduct);
      if (!creditDeducted) {
        logger.error("credits:deduct_failed", {
          userId,
          articleId,
          generationId,
          amount: creditsToDeduct,
          publishReady,
          status: updateData.status,
        });
        // Note: We don't throw here because the article generation was successful
        // The failure to deduct credits should be handled separately (e.g., admin notification)
      } else {
        logger.info("credits:deducted_successfully", {
          userId,
          articleId,
          amount: creditsToDeduct,
        });
      }
    } else {
      logger.debug("finalization:credits_not_deducted", {
        userId,
        articleId,
        generationId,
        publishReady,
        reason: "generation_not_ready_for_publish",
      });
    }

    logger.info("finalization:completed_successfully", {
      articleId,
      generationId,
      publishReady,
      creditsDeducted: publishReady,
    });
  } catch (error) {
    logger.error("finalization:transaction_failed", {
      articleId,
      generationId,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    throw new Error(
      `Article finalization failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

export { validateArticle, finalizeArticle };
