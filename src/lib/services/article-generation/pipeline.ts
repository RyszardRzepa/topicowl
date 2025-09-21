import { db } from "@/server/db";
import {
  articleGenerations,
  articles,
  projects,
} from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { logger } from "@/lib/utils/logger";
import type { ArticleGenerationStatus } from "@/server/db/schema";
import type {
  ResearchResponse,
  ResearchVideo,
} from "@/lib/services/research";
import type {
  ArticleGenerationArtifacts,
  QualityControlIssue,
  VideoEmbed,
} from "@/types";

import { updateGenerationProgress } from "./progress";
import { mergeArtifacts } from "./artifacts";
import { handleGenerationError } from "./progress";
import { createOrResetArticleGeneration, type GenerationContext } from "./validation";
import { performResearch } from "./research";
import { selectCoverImage } from "./image-selection";
import { writeArticle } from "./writing";
import { performQualityControl } from "./quality-control";
import type { QualityControlResponse } from "@/lib/services/quality-control";
import { validateArticle, finalizeArticle } from "./finalization";
import { enhanceArticleWithScreenshots } from "@/lib/services/screenshots/enhancement";
import {
  performGenericUpdate,
  performQualityControlUpdate,
} from "@/lib/services/content-updates";

interface QualityControlRunState {
  runs: number;
  latestResult: QualityControlResponse | null;
}

interface QualityControlLimiterInput {
  state: QualityControlRunState;
  maxRuns: number;
  content: string;
  generationId: number;
  articleId: number;
  userId: string;
  projectId: number;
  originalPrompt: string;
  options: { label: "initial" | "post-update"; progress?: number };
}

async function applyQualityControlWithLimit(
  input: QualityControlLimiterInput,
) {
  const {
    state,
    maxRuns,
    content,
    generationId,
    articleId,
    userId,
    projectId,
    originalPrompt,
    options,
  } = input;

  if (state.runs >= maxRuns) {
    logger.warn("quality-control:max_runs_reached", {
      generationId,
      articleId,
      maxRuns,
    });
    if (state.latestResult) {
      return state.latestResult;
    }
    const fallbackIssue: QualityControlIssue = {
      id: "qc-max-runs",
      category: "requirements",
      severity: "high",
      summary: "Maximum quality control attempts reached without a passing result.",
      location: "quality-control",
      requiredFix:
        "Resolve outstanding issues identified in prior quality control runs before retrying.",
    } as QualityControlIssue;
    return {
      issues: [fallbackIssue],
      categories: [
        {
          category: "requirements",
          status: "fail",
          issues: [fallbackIssue],
        },
      ],
      isValid: false,
      rawReport: "Max quality control attempts exceeded.",
    };
  }

  const nextRunCount = state.runs + 1;
  const qcResult = await performQualityControl(
    content,
    generationId,
    userId,
    projectId,
    originalPrompt,
    { ...options, runCount: nextRunCount },
  );
  state.runs = nextRunCount;
  state.latestResult = qcResult;
  return qcResult;
}

function formatQualityControlIssues(issues: QualityControlIssue[]): string {
  try {
    return issues
      .map((issue) => {
        // Handle potential type mismatch from database jsonb field
        const typedIssue = issue as unknown as {
          severity: string;
          category: string;
          summary: string;
          location?: string;
          requiredFix: string;
        };
        const severityLabel = typedIssue.severity;
        const locationLabel = typedIssue.location ? ` (Location: ${typedIssue.location})` : "";
        return `- **${severityLabel}** [${typedIssue.category}] ${typedIssue.summary}${locationLabel}\n  - Required fix: ${typedIssue.requiredFix}`;
      })
      .join("\n");
  } catch (error) {
    console.error("Error formatting quality control issues:", error);
    return "Quality control issues could not be formatted";
  }
}

export {
  validateAndSetupGeneration,
  createOrResetArticleGeneration,
  claimArticleForGeneration,
} from "./validation";

export { handleGenerationError } from "./progress";

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

    const latestArtifacts = latestGeneration?.artifacts as
      | Record<string, unknown>
      | undefined;
    const pendingRunIdRaw = (latestArtifacts as {
      research_run_id?: unknown;
    })?.research_run_id;
    const pendingRunId =
      typeof pendingRunIdRaw === "string" && pendingRunIdRaw.trim().length > 0
        ? pendingRunIdRaw
        : undefined;

    const pendingVideosRaw = (latestArtifacts as {
      researchVideos?: unknown;
    })?.researchVideos;
    const pendingVideos = Array.isArray(pendingVideosRaw)
      ? (pendingVideosRaw as ResearchVideo[])
      : [];

    if (pendingRunId) {
      logger.debug("research:async_pending", {
        articleId,
        generationId,
        runId: pendingRunId,
      });
      return;
    }

    // For sync research, continue the pipeline
    await continueGenerationPipeline(
      generationId,
      context,
      researchResult,
      pendingVideos,
    );
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

    const artifacts = (genRecord.artifacts ?? {}) as Record<string, unknown>;

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

    const storedResearchVideosRaw = (artifacts as {
      researchVideos?: unknown;
    }).researchVideos;
    const storedResearchVideos = Array.isArray(storedResearchVideosRaw)
      ? (storedResearchVideosRaw as ResearchVideo[])
      : [];

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
            storedResearchVideos,
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
            storedResearchVideos,
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
  researchVideos: ResearchVideo[] = [],
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

    const videosForWriting = researchVideos.length > 0
      ? researchVideos.map((video) => ({
          title: video.title,
          url: video.url,
        }))
      : undefined;

    const writeResult = await writeArticle(
      researchData,
      article.title,
      keywords,
      coverImageUrl,
      generationId,
      userId,
      article.projectId,
      context.relatedArticles,
      videosForWriting,
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

    let enhancedWriteResult = writeResult;
    if (screenshotEnhancement?.content) {
      enhancedWriteResult = { ...writeResult, content: screenshotEnhancement.content };
    }

    const [artifactsRecord] = await db
      .select({ artifacts: articleGenerations.artifacts })
      .from(articleGenerations)
      .where(eq(articleGenerations.id, generationId))
      .limit(1);
    const artifacts: ArticleGenerationArtifacts | undefined = artifactsRecord?.artifacts;
    const storedPrompt = artifacts?.write?.prompt;
    const qualityControlArtifact = artifacts?.qualityControl;

    const maxQualityControlRuns = 3;
    const qualityControlState: QualityControlRunState = {
      runs: typeof qualityControlArtifact?.runCount === "number" 
        ? qualityControlArtifact.runCount 
        : 0,
      latestResult: qualityControlArtifact
        ? {
            issues: qualityControlArtifact.issues ?? [],
            categories: qualityControlArtifact.categories ?? [],
            isValid: Boolean(qualityControlArtifact.isValid ?? false),
            rawReport: String(qualityControlArtifact.report ?? ""),
          }
        : null,
    };

    if (!storedPrompt) {
      logger.warn("quality-control:missing_prompt", { generationId });
    }
    const originalPrompt =
      storedPrompt?.trim() && storedPrompt.trim().length > 0
        ? storedPrompt.trim()
        : `Article generation prompt for "${article.title}"`;

    let qualityControlResult = await applyQualityControlWithLimit({
      state: qualityControlState,
      maxRuns: maxQualityControlRuns,
      content: enhancedWriteResult.content,
      generationId,
      articleId,
      userId,
      projectId: article.projectId,
      originalPrompt,
      options: { label: "initial" },
    });

    let finalContent = enhancedWriteResult.content;

    let validationResult = await validateArticle(finalContent, generationId);

    const initialValidationText =
      (validationResult.rawValidationText ?? "").trim();
    const initialQualityIssues = formatQualityControlIssues(
      qualityControlResult.issues,
    );
    const hasValidationIssues =
      !validationResult.isValid || validationResult.issues.length > 0;
    const hasQualityIssues = qualityControlResult.issues.length > 0;

    if (hasValidationIssues || hasQualityIssues) {
      const updateSettings = {
        toneOfVoice: projectSettings?.toneOfVoice ?? undefined,
        articleStructure: projectSettings?.articleStructure ?? undefined,
        maxWords:
          typeof projectSettings?.maxWords === "number"
            ? projectSettings?.maxWords
            : undefined,
      };

      await updateGenerationProgress(generationId, "updating", 90);

      if (hasValidationIssues) {
        const sections: string[] = [];
        if (initialValidationText.length > 0) {
          sections.push(`## Validation Issues\n\n${initialValidationText}`);
        }
        if (hasQualityIssues) {
          sections.push(`## Quality Control Issues\n\n${initialQualityIssues}`);
        }
        if (sections.length === 0) {
          const derivedIssues = validationResult.issues
            .map((issue) => {
              const factLine = `Fact: ${issue.fact}`;
              const issueLine = `Issue: ${issue.issue}`;
              const correctionLine = `Correction: ${issue.correction}`;
              return `${factLine}\n${issueLine}\n${correctionLine}`;
            })
            .join("\n\n");
          if (derivedIssues.trim().length > 0) {
            sections.push(`## Validation Issues\n\n${derivedIssues}`);
          }
        }
        if (sections.length === 0) {
          sections.push(
            "## Validation Issues\n\n- Validation issues detected but no descriptive details were returned.",
          );
        }
        const updateResult = await performGenericUpdate({
          article: finalContent,
          validationText: sections.join("\n\n"),
          settings: updateSettings,
        });
        finalContent = updateResult.updatedContent;
      } else if (hasQualityIssues) {
        const updateResult = await performQualityControlUpdate(
          finalContent,
          initialQualityIssues,
          updateSettings,
        );
        finalContent = updateResult.updatedContent;
      }

      enhancedWriteResult = { ...enhancedWriteResult, content: finalContent };

      qualityControlResult = await applyQualityControlWithLimit({
        state: qualityControlState,
        maxRuns: maxQualityControlRuns,
        content: finalContent,
        generationId,
        articleId,
        userId,
        projectId: article.projectId,
        originalPrompt,
        options: { progress: 96, label: "post-update" },
      });

      if (hasValidationIssues) {
        validationResult = await validateArticle(finalContent, generationId, {
          progress: 97,
          label: "post-update",
        });
      }
    }

    await mergeArtifacts(generationId, {
      write: enhancedWriteResult,
    });

    const publishReady =
      qualityControlResult.isValid && validationResult.isValid;

    const videoEmbeds: VideoEmbed[] = researchVideos.map((video) => ({
      title: video.title,
      url: video.url,
    }));
    await finalizeArticle(
      articleId,
      enhancedWriteResult,
      finalContent,
      coverImageUrl,
      coverImageAlt,
      generationId,
      userId,
      publishReady,
      videoEmbeds,
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
