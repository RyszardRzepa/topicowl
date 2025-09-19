/**
 * Quality control service for article generation
 * Extracted from the quality-control API route to allow direct function calls
 */

import { google } from "@ai-sdk/google";
import { generateText } from "ai";
import { prompts } from "@/prompts";
import { MODELS } from "@/constants";
import { db } from "@/server/db";
import { users, projects } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import type {
  QualityControlCategory,
  QualityControlCategoryResult,
  QualityControlIssue,
  QualityControlSeverity,
} from "@/types";

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
  issues: QualityControlIssue[];
  categories: QualityControlCategoryResult[];
  isValid: boolean;
  rawReport: string;
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

    // Fetch project-level settings (canonical source)
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

/**
 * Core quality control function that can be called directly without HTTP
 * Extracted from /api/articles/quality-control/route.ts
 */
export async function performQualityControlLogic(
  request: QualityControlRequest,
): Promise<QualityControlResponse> {
  console.log("[QUALITY_CONTROL_SERVICE] Starting quality control");

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

  const qualityControlResult = result.text.trim();

  const parsed = parseQualityControlOutput(qualityControlResult);

  const issues = parsed?.issues ?? [];
  const categories = parsed?.categories ?? [];
  const isValid = parsed?.overallStatus === "pass";

  console.log("[QUALITY_CONTROL_SERVICE] QUALITY_CONTROL_PROCESSING", {
    timestamp: new Date().toISOString(),
    generationId,
    userId,
    rawResult: qualityControlResult,
    rawResultLength: qualityControlResult.length,
    parsedIssueCount: issues.length,
    parsedCategoryCount: categories.length,
    isValid,
    hasGenerationId: !!generationId,
  });

  if (!parsed) {
    const fallbackIssue: QualityControlIssue = {
      id: "qc-parse",
      category: "requirements",
      severity: "high",
      summary: "Quality control output could not be parsed",
      location: "quality-control",
      requiredFix: "Inspect rawReport and adjust parsing or prompt formatting.",
    };
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
      rawReport: qualityControlResult,
    };
  }

  return {
    issues,
    categories,
    isValid,
    rawReport: qualityControlResult,
  };
}

const allowedCategories: QualityControlCategory[] = [
  "seo",
  "writing",
  "structure",
  "requirements",
];

const allowedSeverities: QualityControlSeverity[] = [
  "critical",
  "high",
  "medium",
  "low",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function extractJsonString(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("```") || !trimmed.endsWith("```")) {
    return trimmed;
  }
  const lines = trimmed.split(/\r?\n/);
  if (lines.length <= 2) {
    return trimmed;
  }
  return lines.slice(1, -1).join("\n").trim();
}

function parseQualityControlOutput(
  raw: string,
):
  | {
      categories: QualityControlCategoryResult[];
      issues: QualityControlIssue[];
      overallStatus: "pass" | "fail";
    }
  | null {
  try {
    const jsonText = extractJsonString(raw);
    const parsed: unknown = JSON.parse(jsonText);
    if (!isRecord(parsed)) {
      throw new Error("QC output is not an object");
    }

    const categoriesField = parsed.categories;
    const categories: QualityControlCategoryResult[] = [];
    const allIssues: QualityControlIssue[] = [];

    if (Array.isArray(categoriesField)) {
      for (const entry of categoriesField) {
        if (!isRecord(entry)) {
          continue;
        }

        const categoryValue = entry.category;
        if (typeof categoryValue !== "string") {
          continue;
        }

        if (!allowedCategories.includes(categoryValue as QualityControlCategory)) {
          continue;
        }
        const issuesField = Array.isArray(entry.issues) ? entry.issues : [];
        const categoryIssues: QualityControlIssue[] = [];

        for (const issueEntry of issuesField) {
          if (!isRecord(issueEntry)) {
            continue;
          }

          const severityValue = issueEntry.severity;
          const summaryValue = issueEntry.summary;
          const requiredFixValue = issueEntry.requiredFix;

          if (
            typeof severityValue !== "string" ||
            !allowedSeverities.includes(severityValue as QualityControlSeverity) ||
            typeof summaryValue !== "string" ||
            typeof requiredFixValue !== "string"
          ) {
            continue;
          }

          const idValue =
            typeof issueEntry.id === "string"
              ? issueEntry.id
              : `${categoryValue}-${categoryIssues.length + 1}`;
          const locationValue =
            typeof issueEntry.location === "string"
              ? issueEntry.location
              : undefined;

          const issue: QualityControlIssue = {
            id: idValue,
            // Type assertion to handle database jsonb parsing
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            category: categoryValue as QualityControlCategory,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            severity: severityValue as QualityControlSeverity,
            summary: summaryValue,
            location: locationValue,
            requiredFix: requiredFixValue,
          };

          categoryIssues.push(issue);
        }

        const statusValue =
          entry.status === "fail" || entry.status === "pass"
            ? entry.status
            : categoryIssues.length > 0
            ? "fail"
            : "pass";

        categories.push({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          category: categoryValue as QualityControlCategory,
          status: statusValue,
          issues: categoryIssues,
        });

        for (const issue of categoryIssues) {
          allIssues.push(issue);
        }
      }
    }

    const overallStatusField = parsed.overallStatus;
    const overallStatus: "pass" | "fail" =
      overallStatusField === "pass" || overallStatusField === "fail"
        ? overallStatusField
        : allIssues.length === 0
        ? "pass"
        : "fail";

    return {
      categories,
      issues: allIssues,
      overallStatus,
    };
  } catch (error) {
    console.error("[QUALITY_CONTROL_SERVICE] FAILED_TO_PARSE_QC_OUTPUT", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }

  return null;
}
