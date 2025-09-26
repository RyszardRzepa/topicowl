/**
 * Quality control service for article generation
 */

import { google } from "@ai-sdk/google";
import { generateText } from "ai";
import { prompts } from "@/prompts";
import { MODELS } from "@/constants";
import { db } from "@/server/db";
import { users, projects } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import type {
  QualityControlCategoryResult,
  QualityControlIssue,
} from "@/types";
import type { QualityControlRequest, QualityControlResponse } from "./types";

async function getUserSettings(userId: string, projectId: number) {
  try {
    const [userRecord] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!userRecord) {
      return {};
    }

    const [project] = await db
      .select({
        toneOfVoice: projects.toneOfVoice,
        articleStructure: projects.articleStructure,
        maxWords: projects.maxWords,
        userId: projects.userId,
      })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (!project || project.userId !== userRecord.id) {
      return {};
    }

    return {
      toneOfVoice: project.toneOfVoice ?? undefined,
      articleStructure: project.articleStructure ?? undefined,
      maxWords: project.maxWords ?? undefined,
    };
  } catch (error) {
    console.error(
      "[QUALITY_CONTROL_SERVICE] Failed to fetch user settings:",
      error,
    );
    return {};
  }
}

function parseQualityControlOutput(
  raw: string,
): {
  categories: QualityControlCategoryResult[];
  issues: QualityControlIssue[];
  overallStatus: "pass" | "fail";
} | null {
  // This is a placeholder. The actual implementation should parse the raw string.
  console.log("Parsing raw quality control output:", raw.substring(0, 100));
  return null;
}

export async function performQualityCheck(
  request: QualityControlRequest,
): Promise<QualityControlResponse> {
  console.log("[QUALITY_CONTROL_SERVICE] Starting quality control");

  const { articleContent, originalPrompt, userId } = request;

  if (!articleContent || typeof articleContent !== "string") {
    throw new Error("Article content is required");
  }

  if (!originalPrompt || typeof originalPrompt !== "string") {
    throw new Error("Original prompt is required");
  }

  const userSettings =
    request.userSettings ?? (await getUserSettings(userId, request.projectId));

  const qualityControlPrompt = prompts.qualityControl(
    articleContent,
    userSettings,
    originalPrompt,
  );

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

  const qualityControlResult = result.text.trim();
  const parsed = parseQualityControlOutput(qualityControlResult);

  const issues = parsed?.issues ?? [];
  const categories = parsed?.categories ?? [];
  const isValid = parsed?.overallStatus === "pass";

  return {
    issues: issues.map(issue => ({ ...issue, location: issue.location ?? 'unknown' })),
    categories: categories.map(cat => ({
      ...cat,
      issues: cat.issues.map(issue => ({ ...issue, location: issue.location ?? 'unknown' })),
    })),
    isValid,
    rawReport: qualityControlResult,
  };
}