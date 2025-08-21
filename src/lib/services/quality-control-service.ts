/**
 * Quality control service for article generation
 * Extracted from the quality-control API route to allow direct function calls
 */

import { google } from "@ai-sdk/google";
import { generateText } from "ai";
import { prompts } from "@/prompts";
import { MODELS } from "@/constants";
import { db } from "@/server/db";
import { articleGeneration, articleSettings, users } from "@/server/db/schema";
import { eq } from "drizzle-orm";

// Re-export types from the API route
interface QualityControlRequest {
  articleContent: string;
  userSettings?: {
    toneOfVoice?: string;
    articleStructure?: string;
    maxWords?: number;
    notes?: string;
  };
  originalPrompt: string;
  generationId?: number;
  userId: string;
  projectId: number;
}

export interface QualityControlResponse {
  issues: string | null; // Markdown-formatted issues or null if no issues
  isValid: boolean; // Quick boolean check
}

async function getUserSettings(userId: string, projectId: number) {
  try {
    // Get user record from database
    const [userRecord] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!userRecord) {
      return {};
    }

    // Fetch article settings for the project
    const [settings] = await db
      .select()
      .from(articleSettings)
      .where(eq(articleSettings.projectId, projectId))
      .limit(1);

    if (!settings) {
      return {};
    }

    return {
      toneOfVoice: settings.toneOfVoice ?? undefined,
      articleStructure: settings.articleStructure ?? undefined,
      maxWords: settings.maxWords ?? undefined,
    };
  } catch (error) {
    console.error(
      "[QUALITY_CONTROL_SERVICE] Failed to fetch user settings:",
      error,
    );
    return {};
  }
}

async function saveQualityControlReport(
  generationId: number,
  qualityControlReport: string | null,
) {
  try {
    console.log("[QUALITY_CONTROL_SERVICE] SAVING_QUALITY_CONTROL_REPORT", {
      timestamp: new Date().toISOString(),
      generationId,
      qualityControlReport,
      reportType: typeof qualityControlReport,
      reportIsNull: qualityControlReport === null,
      reportLength: qualityControlReport?.length ?? 0,
    });

    const result = await db
      .update(articleGeneration)
      .set({
        qualityControlReport,
        updatedAt: new Date(),
      })
      .where(eq(articleGeneration.id, generationId))
      .returning({
        id: articleGeneration.id,
        qualityControlReport: articleGeneration.qualityControlReport,
      });

    console.log("[QUALITY_CONTROL_SERVICE] QUALITY_CONTROL_REPORT_SAVED", {
      timestamp: new Date().toISOString(),
      generationId,
      savedData: result[0],
      success: true,
    });
  } catch (error) {
    console.error(
      "[QUALITY_CONTROL_SERVICE] FAILED_TO_SAVE_QUALITY_CONTROL_REPORT",
      {
        timestamp: new Date().toISOString(),
        generationId,
        qualityControlReport,
        error:
          error instanceof Error
            ? {
                name: error.name,
                message: error.message,
                stack: error.stack?.slice(0, 500),
              }
            : error,
      },
    );
    // Don't throw - this is not critical for the quality control process
  }
}

/**
 * Core quality control function that can be called directly without HTTP
 * Extracted from /api/articles/quality-control/route.ts
 */
export async function performQualityControlLogic(
  request: QualityControlRequest,
): Promise<QualityControlResponse> {
  console.log("[QUALITY_CONTROL_SERVICE] Starting quality control", {
    contentLength: request.articleContent.length,
    hasOriginalPrompt: !!request.originalPrompt,
    generationId: request.generationId,
  });

  const { articleContent, originalPrompt, generationId, userId } = request;

  // Input validation
  if (!articleContent || typeof articleContent !== "string") {
    throw new Error("Article content is required");
  }

  if (!originalPrompt || typeof originalPrompt !== "string") {
    throw new Error("Original prompt is required");
  }

  // Get user settings or use provided settings
  const userSettings =
    request.userSettings ?? (await getUserSettings(userId, request.projectId));

  // Generate quality control prompt
  const qualityControlPrompt = prompts.qualityControl(
    articleContent,
    userSettings,
    originalPrompt,
  );

  // Call AI for quality analysis
  const result = await generateText({
    model: google(MODELS.GEMINI_2_5_FLASH),
    prompt: qualityControlPrompt,
    maxRetries: 2,
    maxOutputTokens: 4000,
    providerOptions: {
      google: {
        thinkingConfig: {
          thinkingBudget: 2000,
        },
      },
    },
  });

  const qualityControlResult = result.text;

  // Parse the result - if it's "null" (case insensitive), return null
  const issues =
    qualityControlResult.toLowerCase() === "null" ? null : qualityControlResult;

  const isValid = issues === null;

  console.log("[QUALITY_CONTROL_SERVICE] QUALITY_CONTROL_PROCESSING", {
    timestamp: new Date().toISOString(),
    generationId,
    userId,
    rawResult: qualityControlResult,
    rawResultLength: qualityControlResult.length,
    parsedIssues: issues,
    parsedIssuesType: typeof issues,
    parsedIssuesIsNull: issues === null,
    isValid,
    willSaveToDb: !!generationId,
  });

  // Save quality control report to database if generationId is provided
  if (generationId) {
    console.log(
      "[QUALITY_CONTROL_SERVICE] Saving quality control report to database",
      {
        generationId,
        issues,
        issuesLength: issues?.length ?? 0,
      },
    );
    await saveQualityControlReport(generationId, issues);
  }

  const response: QualityControlResponse = {
    issues,
    isValid,
  };

  return response;
}
