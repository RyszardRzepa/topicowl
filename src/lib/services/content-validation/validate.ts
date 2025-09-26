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

  // Split claims into batches of 10 for parallel processing
  const batchSize = 10;
  const claimBatches: string[][] = [];
  for (let i = 0; i < claimsObject.claims.length; i += batchSize) {
    claimBatches.push(claimsObject.claims.slice(i, i + batchSize));
  }

  console.log("[VALIDATE_SERVICE] Processing claims in batches", {
    totalClaims: claimsObject.claims.length,
    batches: claimBatches.length,
    batchSize,
  });

  // Process all batches in parallel using Promise.allSettled for error resilience
  const batchPromises = claimBatches.map(async (batch, index) => {
    try {
      console.log(`[VALIDATE_SERVICE] Processing batch ${index + 1}/${claimBatches.length}`, {
        claimsInBatch: batch.length,
      });

      const { text: rawValidationText } = await generateText({
        model: await getModel(
          "google",
          MODELS.GEMINI_2_5_FLASH,
          `validation-service-batch-${index}`,
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
        system: prompts.verifyClaimsPrompt(batch),
        prompt: `Please verify the claims for the article.`,
        maxRetries: 3,
        stopWhen: stepCountIs(10),
      });

      const { object: validationResult } = await generateObject({
        model: await getModel(
          "google",
          MODELS.GEMINI_2_5_FLASH,
          `validation-service-extraction-batch-${index}`,
        ),
        schema: validationResultSchema,
        prompt: `Please extract the validation result from the following text: ${rawValidationText}`,
      });

      return {
        batchIndex: index,
        rawValidationText,
        validationResult,
        success: true,
      };
    } catch (error) {
      console.error(`[VALIDATE_SERVICE] Batch ${index + 1} failed`, {
        error: error instanceof Error ? error.message : String(error),
        claimsInBatch: batch.length,
      });
      return {
        batchIndex: index,
        rawValidationText: `Batch ${index + 1} validation failed: ${error instanceof Error ? error.message : String(error)}`,
        validationResult: { incorrectClaims: [] },
        success: false,
      };
    }
  });

  const batchResults = await Promise.allSettled(batchPromises);

  // Merge results from all batches
  const allIncorrectClaims: z.infer<typeof incorrectClaimSchema>[] = [];
  const allRawValidationTexts: string[] = [];
  let successfulBatches = 0;

  batchResults.forEach((result, index) => {
    if (result.status === "fulfilled") {
      const batch = result.value;
      allRawValidationTexts.push(`Batch ${batch.batchIndex + 1}: ${batch.rawValidationText}`);
      
      if (batch.success && batch.validationResult.incorrectClaims) {
        allIncorrectClaims.push(...batch.validationResult.incorrectClaims);
        successfulBatches++;
      }
    } else {
      console.error(`[VALIDATE_SERVICE] Promise failed for batch ${index + 1}`, {
        reason: result.reason,
      });
      allRawValidationTexts.push(`Batch ${index + 1}: Promise failed - ${result.reason}`);
    }
  });

  console.log("[VALIDATE_SERVICE] Batch processing completed", {
    totalBatches: claimBatches.length,
    successfulBatches,
    totalIncorrectClaims: allIncorrectClaims.length,
  });

  const rawValidationText = allRawValidationTexts.join("\n\n");
  const validationResult = { incorrectClaims: allIncorrectClaims };

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
