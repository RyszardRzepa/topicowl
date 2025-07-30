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
      prompt: prompts.validation(body.article),
    });

    // Then extract structured data from validation text - only claims that are not valid or partially true
    const { object } = await generateObject({
      model: google(MODELS.GEMINI_2_5_FLASH, {
        useSearchGrounding: true,
        dynamicRetrievalConfig: {
          mode: "MODE_UNSPECIFIED",
        },
      }),
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
        
        If no issues are found in the validation results, return: {"isValid": true, "issues": []}
      `,
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
