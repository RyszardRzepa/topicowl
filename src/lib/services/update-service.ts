/**
 * Update service for article generation
 * Extracted from the update API route to allow direct function calls
 */

import { anthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import { prompts } from "@/prompts";
import { MODELS } from "@/constants";
import { blogPostSchema } from "@/types";

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
 * Extracted from /api/articles/update/route.ts
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
  console.log("[UPDATE_SERVICE] Starting update", { 
    contentLength: article.length,
    validationTextLength: validationText.length,
  });

  if (!article || !validationText) {
    throw new Error("Article and validationText are required");
  }

  const model = anthropic(MODELS.CLAUDE_SONET_4);

  const { object: articleObject } = await generateObject({
    model,
    schema: blogPostSchema,
    prompt: prompts.update(article, validationText, settings),
    maxOutputTokens: 20000,
  });

  const response: UpdateResponse = {
    updatedContent: articleObject.content,
  };

  console.log("[UPDATE_SERVICE] Update completed", {
    updatedContentLength: response.updatedContent.length,
  });

  return response;
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
  console.log("[UPDATE_SERVICE] Starting quality control update", { 
    contentLength: article.length,
    issuesLength: qualityControlIssues.length,
  });

  if (!article || !qualityControlIssues) {
    throw new Error("Article and qualityControlIssues are required");
  }

  const model = anthropic(MODELS.CLAUDE_SONET_4);

  const { object: articleObject } = await generateObject({
    model,
    schema: blogPostSchema,
    prompt: prompts.updateWithQualityControl(article, qualityControlIssues, settings),
    maxOutputTokens: 20000,
  });

  const response: UpdateResponse = {
    updatedContent: articleObject.content,
  };

  console.log("[UPDATE_SERVICE] Quality control update completed", {
    updatedContentLength: response.updatedContent.length,
  });

  return response;
}

/**
 * Generic update function that handles different types of corrections
 */
export async function performGenericUpdate(request: UpdateRequest): Promise<UpdateResponse> {
  console.log("[UPDATE_SERVICE] Starting generic update", {
    hasCorrections: !!request.corrections,
    hasValidationIssues: !!request.validationIssues,
    hasValidationText: !!request.validationText,
    hasQualityControlIssues: !!request.qualityControlIssues,
  });

  if (!request.article) {
    throw new Error("Article is required");
  }

  if (!request.corrections && !request.validationIssues && !request.validationText && !request.qualityControlIssues) {
    throw new Error(
      "Either corrections, validationIssues, validationText, or qualityControlIssues are required",
    );
  }

  let response: UpdateResponse;

  // Handle quality control issues with specialized logic
  if (request.qualityControlIssues) {
    response = await performQualityControlUpdate(
      request.article,
      request.qualityControlIssues,
      request.settings
    );
  } else {
    // Handle other types of updates (existing logic)
    const model = anthropic(MODELS.CLAUDE_SONET_4);

    let correctionsOrValidationText: Correction[] | string;

    if (request.validationText) {
      correctionsOrValidationText = request.validationText;
    } else {
      // Convert validationIssues to corrections format if provided
      correctionsOrValidationText =
        request.corrections ??
        request.validationIssues?.map((issue) => ({
          fact: issue.fact,
          issue: issue.issue,
          correction: issue.correction,
        })) ??
        [];
    }

    const { object: articleObject } = await generateObject({
      model,
      schema: blogPostSchema,
      prompt: prompts.update(request.article, correctionsOrValidationText, request.settings),
    });

    response = {
      updatedContent: articleObject.content,
    };
  }

  console.log("[UPDATE_SERVICE] Generic update completed", {
    updatedContentLength: response.updatedContent.length,
  });

  return response;
}
