/**
 * Content validation service
 */

import { google } from "@ai-sdk/google";
import { generateText, generateObject } from "ai";
import { z } from "zod";
import { prompts } from "@/prompts";
import { MODELS } from "@/constants";
import { getModel } from "@/lib/ai-models";
import type { ValidateRequest, ValidateResponse } from "./types";

const validationResponseSchema = z.object({
  isValid: z.boolean(),
  issues: z.array(
    z.object({
      fact: z.string(),
      issue: z.string(),
      correction: z.string(),
    }),
  ),
});

export async function performValidation(
  request: ValidateRequest,
): Promise<ValidateResponse> {
  const { content } = request;
  console.log("[VALIDATE_SERVICE] Starting validation", {
    contentLength: content.length,
  });

  if (!content) {
    throw new Error("Article content is required");
  }

  const { text: rawValidationText } = await generateText({
    model: await getModel(
      "google",
      MODELS.GEMINI_2_5_FLASH,
      "research-service",
    ),
    providerOptions: {
      google: {
        thinkingConfig: {
          thinkingBudget: 5000,
          includeThoughts: false,
        },
      },
    },
    tools: {
      google_search: google.tools.googleSearch({}),
    },
    system:
      "Use Google Search when needed to verify facts. Include citations for any searches performed.",
    prompt: prompts.validation(content),
  });

  const { object } = await generateObject({
    model: await getModel('google', MODELS.GEMINI_2_5_FLASH, "validation-service"),
    schema: validationResponseSchema,
    prompt: `
      Extract structured validation data from the following fact-checking results.
      Focus ONLY on claims that are FALSE, UNVERIFIED or CONTRADICTED.
      Validation Results:
      ${rawValidationText}
      If no issues are found, return: {"isValid": true, "issues": []}.
    `,
  });

  const response: ValidateResponse = {
    ...object,
    rawValidationText,
  };

  console.log("[VALIDATE_SERVICE] Validation completed", {
    isValid: response.isValid,
    issuesCount: response.issues.length,
  });

  return response;
}