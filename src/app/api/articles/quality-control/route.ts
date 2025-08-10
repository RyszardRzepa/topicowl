import { google } from "@ai-sdk/google";
import { generateText } from "ai";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prompts } from "@/prompts";
import { MODELS } from "@/constants";
import { db } from "@/server/db";
import { articleGeneration, articleSettings, users } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import type { ApiResponse } from "@/types";

export const maxDuration = 300;

// Types for this API route
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
}

export interface QualityControlResponse {
  issues: string | null; // Markdown-formatted issues or null if no issues
  isValid: boolean; // Quick boolean check
}

async function getUserSettings(userId: string) {
  try {
    // Get user record from database
    const [userRecord] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerk_user_id, userId))
      .limit(1);

    if (!userRecord) {
      return {};
    }

    // Fetch article settings
    const [settings] = await db
      .select()
      .from(articleSettings)
      .where(eq(articleSettings.user_id, userRecord.id))
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
    console.error("Failed to fetch user settings:", error);
    return {};
  }
}

async function saveQualityControlReport(
  generationId: number,
  qualityControlReport: string | null,
) {
  try {
    console.log("SAVING_QUALITY_CONTROL_REPORT", {
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

    console.log("QUALITY_CONTROL_REPORT_SAVED", {
      timestamp: new Date().toISOString(),
      generationId,
      savedData: result[0],
      success: true,
    });
  } catch (error) {
    console.error("FAILED_TO_SAVE_QUALITY_CONTROL_REPORT", {
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
    });
    // Don't throw - this is not critical for the quality control process
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" } as ApiResponse,
        { status: 401 },
      );
    }

    const body = (await req.json()) as QualityControlRequest;
    const { articleContent, originalPrompt, generationId } = body;

    // Input validation
    if (!articleContent || typeof articleContent !== "string") {
      return NextResponse.json(
        { success: false, error: "Article content is required" } as ApiResponse,
        { status: 400 },
      );
    }

    if (!originalPrompt || typeof originalPrompt !== "string") {
      return NextResponse.json(
        { success: false, error: "Original prompt is required" } as ApiResponse,
        { status: 400 },
      );
    }

    // Get user settings or use provided settings
    const userSettings = body.userSettings ?? (await getUserSettings(userId));

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
      qualityControlResult.toLowerCase() === "null"
        ? null
        : qualityControlResult;

    const isValid = issues === null;

    console.log("QUALITY_CONTROL_API_PROCESSING", {
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
      console.log("Saving quality control report to database", {
        generationId,
        issues,
        issuesLength: issues?.length ?? 0,
      });
      await saveQualityControlReport(generationId, issues);
    }

    const response: QualityControlResponse = {
      issues,
      isValid,
    };

    console.log("QUALITY_CONTROL_API_FINAL_RESPONSE", {
      timestamp: new Date().toISOString(),
      generationId,
      userId,
      response,
    });

    return NextResponse.json({
      success: true,
      data: response,
    } as ApiResponse<QualityControlResponse>);
  } catch (error) {
    console.error("Quality control API error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      } as ApiResponse,
      { status: 500 },
    );
  }
}
