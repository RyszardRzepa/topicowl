import { logger } from "@/lib/utils/logger";
import { performImageSelectionLogic as findCoverImage } from "@/lib/services/image-selection-service";
import { updateGenerationProgress } from "./utils";
import { mergeArtifacts } from "./utils";

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

export { selectCoverImage };