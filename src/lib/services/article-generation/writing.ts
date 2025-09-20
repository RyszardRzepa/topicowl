import { performWriteLogic as performWrite } from "@/lib/services/content-generation";
import type {
  WriteResponse,
  ResearchResponse,
} from "@/lib/services/content-generation";
import { logger } from "@/lib/utils/logger";
import { updateGenerationProgress } from "./progress";

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

export { writeArticle };