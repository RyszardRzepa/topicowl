import { getProjectExcludedDomains } from "@/lib/utils/article-generation";
import { logger } from "@/lib/utils/logger";
import {
  searchYoutubeVideos,
  createParallelResearchTask,
} from "@/lib/services/research";
import type {
  ResearchVideo,
  ResearchResponse,
} from "@/lib/services/research";
import { updateGenerationProgress } from "./progress";
import { mergeArtifacts } from "./artifacts";

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
    const [task, videoResults] = await Promise.all([
      createParallelResearchTask(title, keywords, notes, excludedDomains),
      searchYoutubeVideos(title, keywords),
    ]);

    const videos: ResearchVideo[] = videoResults;

    await mergeArtifacts(generationId, {
      research_run_id: task.run_id,
      researchVideos: videos,
    });

    logger.debug("research:videos_attached", {
      generationId,
      videoCount: videos.length,
    });
    // Webhook will handle the rest
    return {
      researchData:
        "Research is in progress and will be delivered via webhook.",
      sources: [],
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

export { performResearch };
