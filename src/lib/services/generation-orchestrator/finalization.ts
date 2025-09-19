import { db } from "@/server/db";
import {
  articles,
  articleGenerations,
} from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { logger } from "@/lib/utils/logger";
import { performValidateLogic as runValidation } from "@/lib/services/validation-service";
import type { ValidateResponse } from "@/lib/services/validation-service";
import type { WriteResponse } from "@/lib/services/write-service";
import type { VideoEmbed } from "@/types";
import { getCreditCost } from "@/lib/utils/credit-costs";
import { deductCredits } from "@/lib/utils/credits";
import { updateGenerationProgress } from "./utils";
import { mergeArtifacts } from "./utils";
import { ensureSingleIntro } from "./utils";

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
    content: string;
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
    content: finalContentWithIntro,
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
    updatedAt: new Date(),
  };
  await db
    .update(articleGenerations)
    .set(generationUpdate)
    .where(eq(articleGenerations.id, generationId));

  const creditsToDeduct = getCreditCost("ARTICLE_GENERATION");
  const creditDeducted = await deductCredits(userId, creditsToDeduct);
  if (!creditDeducted)
    logger.warn("credits:deduct_failed", {
      userId,
      articleId,
      amount: creditsToDeduct,
    });
}

export { validateArticle, finalizeArticle };