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
  researchAnalysisSummary: z.object({
    totalSourcesAnalyzed: z.number().describe("Number of sources analyzed from research data"),
    keyThemesIdentified: z.number().describe("Number of key themes identified"),
  }).describe("Summary of research analysis process"),
  keyPoints: z
    .array(
      z.object({
        heading: z
          .string()
          .describe("Clear, descriptive heading for the key point"),
        summary: z
          .string()
          .min(150)
          .max(350)
          .describe(
            "Concise summary (150-350 characters) explaining what this section will cover",
          ),
        relevantLinks: z
          .array(z.string())
          .describe("Array of relevant URLs from the research data"),
        primaryKeywords: z
          .array(z.string())
          .describe("Primary keywords naturally integrated into this key point"),
        videoContext: z
          .string()
          .optional()
          .describe("Keywords/topics that would benefit from video demonstration in this section"),
      }),
    )
    .length(5)
    .describe("Exactly 5 key points for the article outline"),
  totalWords: z
    .number()
    .max(300)
    .describe("Total word count of the outline (must be under 300)"),
  videoIntegration: z.object({
    optimalSection: z.string().describe("Heading of section selected for video integration"),
    integrationRationale: z.string().describe("Why this section was selected for video demonstration"),
    matchedVideo: z.string().describe("Title and URL of best matching video"),
  }).optional().describe("Video integration details when videos are available"),
  videoMatchingSections: z
    .array(z.string())
    .max(1)
    .describe("Maximum one section should include video content"),
});

// Types colocated with this API route
export interface OutlineRequest {
  title: string;
  keywords: string[];
  researchData: string;
  generationId?: number; // Optional for backward compatibility
  videos?: Array<{
    title: string;
    url: string;
  }>;
  notes?: string; // User-provided context and requirements
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

    try {
      const { object: outlineData } = await generateObject({
        model: google(MODELS.GEMINI_2_5_FLASH),
        schema: outlineSchema,
        prompt: prompts.outline(body.title, body.keywords, body.researchData, body.videos, body.notes),
        maxRetries: 3,
      });

      return NextResponse.json({
        success: true,
        data: outlineData,
      } as ApiResponse<OutlineResponse>);
    } catch (error) {
      console.log("[OUTLINE_API] Schema validation failed, trying with relaxed schema", error);
      
      // Fallback schema with more lenient character limits
      const relaxedOutlineSchema = z.object({
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
                .min(100)
                .max(500)
                .describe(
                  "Concise summary explaining what this section will cover",
                ),
              relevantLinks: z
                .array(z.string())
                .describe("Array of relevant URLs from the research data"),
              primaryKeywords: z
                .array(z.string())
                .describe("Primary keywords naturally integrated into this key point"),
              videoContext: z
                .string()
                .optional()
                .describe("Keywords/topics that would benefit from video demonstration in this section"),
            }),
          )
          .length(5)
          .describe("Exactly 5 key points for the article outline"),
        totalWords: z
          .number()
          .max(400)
          .describe("Total word count of the outline"),
        videoMatchingSections: z
          .array(z.string())
          .max(1)
          .describe("Maximum one section should include video content"),
      });

      const { object: outlineData } = await generateObject({
        model: google(MODELS.GEMINI_2_5_FLASH),
        schema: relaxedOutlineSchema,
        prompt: prompts.outline(body.title, body.keywords, body.researchData, body.videos, body.notes) + 
          "\n\nIMPORTANT: Keep summaries under 350 characters to ensure proper formatting.",
        maxRetries: 2,
      });

      return NextResponse.json({
        success: true,
        data: outlineData,
      } as ApiResponse<OutlineResponse>);
    }
  } catch (error) {
    console.error("[OUTLINE_API] Outline generation error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to generate outline" } as ApiResponse,
      { status: 500 },
    );
  }
}
