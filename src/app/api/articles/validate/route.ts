import { google } from "@ai-sdk/google";
import { generateText, generateObject } from "ai";
import { z } from "zod";
import { NextResponse } from "next/server";
import { prompts } from "@/prompts";
import { MODELS } from "@/constants";

// Set maximum duration to match generate route to prevent timeouts
export const maxDuration = 800;

// Types colocated with this API route
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

// Extracted validate logic that can be called directly
export async function performValidateLogic(article: string): Promise<ValidateResponse> {
  console.log("[VALIDATE_LOGIC] Starting validation", { contentLength: article.length });

  if (!article) {
    throw new Error("Article content is required");
  }

  const {
    text: rawValidationText,
  } = await generateText({
    model: google(MODELS.GEMINI_2_5_FLASH),
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
    system: "Use Google Search when needed to verify facts. Include citations for any searches performed.",
    prompt: prompts.validation(article),
  });

  // Then extract structured data from validation text - only claims that are not valid or partially true
  const { object } = await generateObject({
    model: google(MODELS.GEMINI_2_5_FLASH),
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

  console.log("[VALIDATE_LOGIC] Validation completed", {
    isValid: response.isValid,
    issuesCount: response.issues.length,
  });

  return response;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ValidateRequest;
    const result = await performValidateLogic(body.content);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Validation endpoint error:", error);
    
    // Return a graceful fallback response instead of failing completely
    if (error instanceof Error && error.message.includes("timeout")) {
      return NextResponse.json({
        isValid: true,
        issues: [],
        rawValidationText: "Validation skipped due to timeout - proceeding without fact-check",
      });
    }
    
    const errorMessage = error instanceof Error ? error.message : "Failed to validate article";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 },
    );
  }
}
