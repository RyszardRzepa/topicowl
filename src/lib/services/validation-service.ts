/**
 * Validation service for article generation
 * Extracted from the validate API route to allow direct function calls
 */

import { google } from "@ai-sdk/google";
import { generateText, generateObject } from "ai";
import { z } from "zod";
import { prompts } from "@/prompts";
import { MODELS } from "@/constants";
import { getModel } from "../ai-models";

// Re-export types from the API route
export interface ValidateRequest {
  content: string;
}

export interface ValidateResponse {
  isValid: boolean;
  issues: {
    fact: string;
    issue: string;
    correction: string;
  }[];
  rawValidationText: string;
}

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

/**
 * Core validation function that can be called directly without HTTP
 * Extracted from /api/articles/validate/route.ts
 */
export async function performValidateLogic(
  article: string,
): Promise<ValidateResponse> {
  console.log("[VALIDATE_SERVICE] Starting validation", {
    contentLength: article.length,
  });

  if (!article) {
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
          thinkingBudget: 5000, // Reduced thinking budget for faster processing
          includeThoughts: false,
        },
      },
    },
    tools: {
      google_search: google.tools.googleSearch({}),
    },
    // Remove forced tool usage to prevent unnecessary delays - let AI decide when to search
    system:
      "Use Google Search when needed to verify facts. Include citations for any searches performed.",
    prompt: prompts.validation(article),
  });

  // Then extract structured data from validation text - only claims that are not valid or partially true
  const { object } = await generateObject({
    model: await getModel('google',MODELS.GEMINI_2_5_FLASH, "validation-service"),
    schema: validationResponseSchema,
    prompt: `
      Extract structured validation data from the following fact-checking results.
      
      Focus ONLY on claims that are FALSE, UNVERIFIED or CONTRADICTED. Do not include verified claims.
      
      Validation Results:
      ${rawValidationText}
      
      Extract and return a JSON object with:
      - isValid: false if any issues are found, true if no issues
      - issues: array of only the problematic claims with:
        - fact: exact text from article that has an issue
        - issue: brief description of what's wrong
        - correction: suggested correction or "Needs verification"
      
      If no issues are found in the validation results, return: {"isValid": true, "issues": []}.

      Ensure the intent is current and based on real-time top results.
    `,
  });

  // Return both structured data and raw validation text
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
