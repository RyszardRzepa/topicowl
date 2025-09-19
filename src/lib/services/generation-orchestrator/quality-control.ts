import { logger } from "@/lib/utils/logger";
import { performQualityControlLogic as runQualityControl } from "@/lib/services/quality-control-service";
import type { QualityControlResponse } from "@/lib/services/quality-control-service";
import { updateGenerationProgress } from "./utils";
import { mergeArtifacts } from "./utils";

async function performQualityControl(
  content: string,
  generationId: number,
  userId: string,
  projectId: number,
  originalPrompt: string,
): Promise<QualityControlResponse> {
  const startTime = Date.now();
  logger.debug("quality-control:start", { generationId });
  try {
    await updateGenerationProgress(generationId, "quality-control", 75);
    const qcResult = await runQualityControl({
      articleContent: content,
      userSettings: undefined,
      originalPrompt,
      userId,
      projectId,
      generationId,
    });
    const duration = Date.now() - startTime;
    logger.debug("quality-control:complete", {
      duration,
      issues: qcResult.issues?.length,
    });
    await mergeArtifacts(generationId, {
      qualityControl: {
        report:
          typeof qcResult.issues === "string" ? qcResult.issues : undefined,
        completedAt: new Date().toISOString(),
      },
    });
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

export { performQualityControl };