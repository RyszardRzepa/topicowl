import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { NextResponse } from "next/server";
import { prompts, MODELS } from "@/constants";
import type { ApiResponse } from "@/types";
import { z } from "zod";

// Zod schema for outline generation
const outlineSchema = z.object({
  title: z.string().describe("The article title"),
  keywords: z.array(z.string()).describe("Array of target keywords"),
  keyPoints: z
    .array(
      z.object({
        heading: z
          .string()
          .describe("Clear, descriptive heading for the key point"),
        summary: z
          .string()
          .min(200)
          .max(400)
          .describe(
            "40-60 word summary explaining what this section will cover",
          ),
        relevantLinks: z
          .array(z.string())
          .describe("Array of relevant URLs from the research data"),
      }),
    )
    .length(5)
    .describe("Exactly 5 key points for the article outline"),
  totalWords: z
    .number()
    .max(300)
    .describe("Total word count of the outline (must be under 300)"),
});

// Types colocated with this API route
export interface OutlineRequest {
  title: string;
  keywords: string[];
  researchData: string;
}

export type OutlineResponse = z.infer<typeof outlineSchema>;

export async function POST(request: Request) {
  try {
    console.log("[OUTLINE_API] POST request received");
    const body = (await request.json()) as OutlineRequest;

    // Validate required fields
    if (!body.title) {
      console.log("[OUTLINE_API] Missing title field");
      return NextResponse.json(
        { success: false, error: "Title is required" } as ApiResponse,
        { status: 400 },
      );
    }

    if (
      !body.keywords ||
      !Array.isArray(body.keywords) ||
      body.keywords.length === 0
    ) {
      console.log("[OUTLINE_API] Invalid keywords field");
      return NextResponse.json(
        {
          success: false,
          error: "Keywords must be a non-empty array",
        } as ApiResponse,
        { status: 400 },
      );
    }

    if (!body.researchData || typeof body.researchData !== "string") {
      console.log("[OUTLINE_API] Missing or invalid research data");
      return NextResponse.json(
        { success: false, error: "Research data is required" } as ApiResponse,
        { status: 400 },
      );
    }

    console.log("[OUTLINE_API] Validation passed, generating outline");

    const { object: outlineData } = await generateObject({
      model: google(MODELS.GEMINI_2_5_FLASH),
      schema: outlineSchema,
      prompt: prompts.outline(body.title, body.keywords, body.researchData),
      maxRetries: 3,
    });

    return NextResponse.json({
      success: true,
      data: outlineData,
    } as ApiResponse<OutlineResponse>);
  } catch (error) {
    console.error("[OUTLINE_API] Outline generation error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to generate outline" } as ApiResponse,
      { status: 500 },
    );
  }
}
