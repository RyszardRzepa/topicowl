import { google } from "@ai-sdk/google";
import { generateText, generateObject } from "ai";
import { z } from "zod";
import { NextResponse } from "next/server";
import { prompts } from "@/constants";
import { MODELS } from "@/constants";

// Types colocated with this API route
export interface ValidateRequest {
  article: string;
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

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ValidateRequest;

    if (!body.article) {
      return NextResponse.json(
        { error: "Article content is required" },
        { status: 400 },
      );
    }

    // First get raw validation text for debugging/update purposes
    const { text: rawValidationText } = await generateText({
      model: google(MODELS.GEMINI_2_5_FLASH, {
        useSearchGrounding: true,
        dynamicRetrievalConfig: {
          mode: "MODE_UNSPECIFIED",
        },
      }),
      prompt: `
        You are an expert fact-checker. Analyze this article and identify factual issues.
        
        Article: ${body.article}
        
        Return results in this format:
        VALIDATION RESULTS:
        
        CLAIM: [Exact text from article]
        STATUS: [UNVERIFIED or CONTRADICTED]
        REASON: [One sentence explaining the issue]
        
        If no issues: "VALIDATION RESULTS: No factual issues identified."
      `,
    });

    // Then get structured validation using the main prompt
    const { object } = await generateObject({
      model: google(MODELS.GEMINI_2_5_FLASH, {
        useSearchGrounding: true,
        dynamicRetrievalConfig: {
          mode: "MODE_UNSPECIFIED",
        },
      }),
      schema: validationResponseSchema,
      prompt: prompts.validation(body.article),
    });

    // Return both structured data and raw validation text
    const response: ValidateResponse = {
      ...object,
      rawValidationText,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Validation endpoint error:", error);
    return NextResponse.json(
      { error: "Failed to validate article" },
      { status: 500 },
    );
  }
}
