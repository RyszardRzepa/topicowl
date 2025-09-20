/**
 * Content update service
 */

import { anthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import { MODELS } from "@/constants";
import { blogPostSchema } from "@/types";
import update from "@/prompts/update";
import { updateWithQualityControl } from "@/prompts/update-with-quality-control";
import type { UpdateRequest, UpdateResponse } from "./types";

export async function performQualityControlUpdate(
  article: string,
  qualityControlIssues: string,
  settings?: {
    toneOfVoice?: string;
    articleStructure?: string;
    maxWords?: number;
  },
): Promise<UpdateResponse> {
  if (!article) throw new Error("Article is required");
  if (!qualityControlIssues) throw new Error("Quality control issues are required");

  const model = anthropic(MODELS.CLAUDE_SONNET_4);
  const { object: articleObject } = await generateObject({
    model,
    schema: blogPostSchema,
    prompt: updateWithQualityControl(article, qualityControlIssues, settings),
    maxOutputTokens: 20000,
  });

  return { updatedContent: articleObject.content };
}

export async function performGenericUpdate(
  request: UpdateRequest,
): Promise<UpdateResponse> {
  console.log("[UPDATE_SERVICE] Starting generic update", {
    hasCorrections: !!request.corrections,
    hasValidationIssues: !!request.validationIssues,
    hasValidationText: !!request.validationText,
    hasQualityControlIssues: !!request.qualityControlIssues,
  });

  if (!request.article) throw new Error("Article is required");
  if (
    !request.corrections &&
    !request.validationIssues &&
    !request.validationText &&
    !request.qualityControlIssues
  ) {
    throw new Error("At least one correction type is required");
  }

  const model = anthropic(MODELS.CLAUDE_SONNET_4);
  const correctionsOrValidationText =
    request.validationText ??
    request.qualityControlIssues ??
    (request.corrections ?? request.validationIssues?.map(issue => ({
      fact: issue.fact,
      issue: issue.issue,
      correction: issue.correction,
    })) ?? []);

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
