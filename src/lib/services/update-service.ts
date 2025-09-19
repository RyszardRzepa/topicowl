/**
 * Update service for article generation
 * Extracted from the update API route to allow direct function calls
 */

import { anthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import { MODELS } from "@/constants";
import { blogPostSchema } from "@/types";
import update from "@/prompts/update";
import { updateWithQualityControl } from "@/prompts/update-with-quality-control";

// Re-export types from the API route
interface ValidationIssue {
  fact: string;
  issue: string;
  correction: string;
}

interface Correction {
  fact: string;
  issue: string;
  correction: string;
}

export interface UpdateRequest {
  article: string;
  corrections?: Correction[];
  validationIssues?: ValidationIssue[];
  validationText?: string; // Raw validation text from validation API
  qualityControlIssues?: string; // Markdown-formatted quality control feedback
  settings?: {
    toneOfVoice?: string;
    articleStructure?: string;
    maxWords?: number;
  };
}

export interface UpdateResponse {
  updatedContent: string;
}

/**
 * Core update function that can be called directly without HTTP
 */
export async function performUpdateLogic(
  article: string,
  validationText: string,
  settings?: {
    toneOfVoice?: string;
    articleStructure?: string;
    maxWords?: number;
  },
): Promise<UpdateResponse> {
  // Single update path
  return performGenericUpdate({ article, validationText, settings });
}

/**
 * Quality control specific update logic
 */
export async function performQualityControlUpdate(
  article: string,
  qualityControlIssues: string,
  settings?: {
    toneOfVoice?: string;
    articleStructure?: string;
    maxWords?: number;
  },
): Promise<UpdateResponse> {
  if (!article) {
    throw new Error("Article is required");
  }

  if (!qualityControlIssues) {
    throw new Error("Quality control issues are required");
  }

  const model = anthropic(MODELS.CLAUDE_SONNET_4);

  const { object: articleObject } = await generateObject({
    model,
    schema: blogPostSchema,
    prompt: updateWithQualityControl(article, qualityControlIssues, settings),
    maxOutputTokens: 20000,
  });

  return {
    updatedContent: articleObject.content,
  };
}

/**
 * Generic update function that handles different types of corrections
 */
export async function performGenericUpdate(
  request: UpdateRequest,
): Promise<UpdateResponse> {
  console.log("[UPDATE_SERVICE] Starting generic update", {
    hasCorrections: !!request.corrections,
    hasValidationIssues: !!request.validationIssues,
    hasValidationText: !!request.validationText,
    hasQualityControlIssues: !!request.qualityControlIssues,
  });

  if (!request.article) {
    throw new Error("Article is required");
  }

  if (
    !request.corrections &&
    !request.validationIssues &&
    !request.validationText &&
    !request.qualityControlIssues
  ) {
    throw new Error(
      "Either corrections, validationIssues, validationText, or qualityControlIssues are required",
    );
  }

  const model = anthropic(MODELS.CLAUDE_SONNET_4);

  let correctionsOrValidationText: Correction[] | string;
  if (request.validationText) {
    correctionsOrValidationText = request.validationText;
  } else if (request.qualityControlIssues) {
    correctionsOrValidationText = request.qualityControlIssues;
  } else {
    correctionsOrValidationText =
      request.corrections ??
      (request.validationIssues
        ? request.validationIssues.map((issue) => ({
            fact: issue.fact,
            issue: issue.issue,
            correction: issue.correction,
          }))
        : []);
  }

  const { object: articleObject } = await generateObject({
    model,
    schema: blogPostSchema,
    prompt: update(
      request.article,
      correctionsOrValidationText,
      request.settings,
    ),
    maxOutputTokens: 20000,
  });

  const response: UpdateResponse = {
    updatedContent: articleObject.content,
  };

  console.log("[UPDATE_SERVICE] Generic update completed", {
    updatedContentLength: response.updatedContent.length,
  });

  return response;
}
