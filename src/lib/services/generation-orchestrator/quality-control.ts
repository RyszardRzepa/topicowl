import { logger } from "@/lib/utils/logger";
import { performQualityControlLogic as runQualityControl } from "@/lib/services/quality-control-service";
import type { QualityControlResponse } from "@/lib/services/quality-control-service";
import type { ArticleGenerationStatus } from "@/server/db/schema";
import { updateGenerationProgress } from "./utils";
import { mergeArtifacts } from "./utils";

interface QualityControlRunOptions {
  progress?: number;
  status?: ArticleGenerationStatus;
  skipProgressUpdate?: boolean;
  label?: "initial" | "post-update";
  runCount?: number;
}

async function performQualityControl(
  content: string,
  generationId: number,
  userId: string,
  projectId: number,
  originalPrompt: string,
  options?: QualityControlRunOptions,
): Promise<QualityControlResponse> {
  const startTime = Date.now();
  logger.debug("quality-control:start", { generationId });
  try {
    if (!options?.skipProgressUpdate) {
      const status = options?.status ?? "quality-control";
      const progress = options?.progress ?? 75;
      await updateGenerationProgress(generationId, status, progress);
    }
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
        runLabel: options?.label ?? "initial",
        runCount: options?.runCount,
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
