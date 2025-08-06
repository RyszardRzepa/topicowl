import { anthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import { NextResponse } from "next/server";
import { prompts } from "@/prompts";
import { MODELS } from "@/constants";
import { blogPostSchema } from "@/types";

// Types colocated with this API route
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
  settings?: {
    toneOfVoice?: string;
    articleStructure?: string;
    maxWords?: number;
  };
}

export interface UpdateResponse {
  updatedContent: string;
}

// Extracted update logic that can be called directly
export async function performUpdateLogic(
  article: string,
  validationText: string,
  settings?: {
    toneOfVoice?: string;
    articleStructure?: string;
    maxWords?: number;
  },
): Promise<UpdateResponse> {
  console.log("[UPDATE_LOGIC] Starting update", { 
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
  });

  const response: UpdateResponse = {
    updatedContent: articleObject.content,
  };

  console.log("[UPDATE_LOGIC] Update completed", {
    updatedContentLength: response.updatedContent.length,
  });

  return response;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as UpdateRequest;

    if (!body.article) {
      return NextResponse.json(
        {
          error: "Article is required",
        },
        { status: 400 },
      );
    }

    if (!body.corrections && !body.validationIssues && !body.validationText) {
      return NextResponse.json(
        {
          error:
            "Either corrections, validationIssues, or validationText are required",
        },
        { status: 400 },
      );
    }

    const model = anthropic(MODELS.CLAUDE_SONET_4);

    let correctionsOrValidationText: Correction[] | string;

    if (body.validationText) {
      correctionsOrValidationText = body.validationText;
    } else {
      // Convert validationIssues to corrections format if provided
      correctionsOrValidationText =
        body.corrections ??
        body.validationIssues?.map((issue) => ({
          fact: issue.fact,
          issue: issue.issue,
          correction: issue.correction,
        })) ??
        [];
    }

    const { object: articleObject } = await generateObject({
      model,
      schema: blogPostSchema,
      prompt: prompts.update(body.article, correctionsOrValidationText, body.settings),
    });

    const response: UpdateResponse = {
      updatedContent: articleObject.content,
    };

    return NextResponse.json({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error("Update endpoint error:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to update article";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 },
    );
  }
}
