/**
 * Content validation service
 */

import { google } from "@ai-sdk/google";
import { generateObject, generateText, stepCountIs } from "ai";
import { z } from "zod";
import { prompts } from "@/prompts";
import { MODELS } from "@/constants";
import { getModel } from "@/lib/ai-models";
import type { ValidateRequest, ValidateResponse } from "./types";

const claimsSchema = z.object({
  claims: z.array(z.string()),
});

const incorrectClaimSchema = z.object({
  claim: z.string(),
  status: z.enum(["NOT_CORRECT", "PARTIALLY_CORRECT", "UNVERIFIED"]),
  issue: z.string(),
  correction: z.string(),
  evidence: z.array(
    z.object({
      source: z.string(),
      reliability: z.enum(["HIGH", "MEDIUM", "LOW"]),
      date: z.string(),
      finding: z.string(),
    }),
  ),
});

const validationResultSchema = z.object({
  incorrectClaims: z.array(incorrectClaimSchema),
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

  const { object: claimsObject } = await generateObject({
    model: await getModel(
      "google",
      MODELS.GEMINI_2_5_FLASH,
      "claims-extraction-service",
    ),
    schema: claimsSchema,
    prompt: prompts.extractClaimsPrompt(content),
  });

  if (claimsObject.claims.length === 0) {
    console.log("[VALIDATE_SERVICE] No claims extracted, skipping validation.");
    return {
      isValid: true,
      issues: [],
      rawValidationText: "No claims to validate.",
      validationResult: { incorrectClaims: [] },
    };
  }

  const { text: rawValidationText } = await generateText({
    model: await getModel(
      "google",
      MODELS.GEMINI_2_5_FLASH,
      "validation-service",
    ),
    providerOptions: {
      google: {
        thinkingConfig: {
          thinkingBudget: 0,
        },
      },
    },
    tools: {
      google_search: google.tools.googleSearch({}),
      url_context: google.tools.urlContext({}),
      // code_execution: google.tools.codeExecution({}),
    },
    system: prompts.verifyClaimsPrompt(claimsObject.claims),
    prompt: `Please verify the claims for the article.`,
    maxRetries: 3,
    stopWhen: stepCountIs(50),
  });

  const { object: validationResult } = await generateObject({
    model: await getModel(
      "google",
      MODELS.GEMINI_2_5_FLASH,
      "validation-service-extraction",
    ),
    schema: validationResultSchema,
    prompt: `Please extract the validation result from the following text: ${rawValidationText}`,
  });

  const parsedValidation = validationResultSchema.safeParse(validationResult);

  if (!parsedValidation.success) {
    console.error("Failed to validate schema for validation result", {
      error: parsedValidation.error,
      data: validationResult,
    });
    return {
      isValid: true, // Assume valid if schema fails
      issues: [],
      rawValidationText,
      validationResult: undefined,
    };
  }

  const issues = parsedValidation.data.incorrectClaims.map((claim) => ({
    fact: claim.claim,
    issue: claim.issue,
    correction: claim.correction,
  }));

  const response: ValidateResponse = {
    isValid: issues.length === 0,
    issues,
    rawValidationText,
    validationResult: parsedValidation.data,
  };

  return response;
}
