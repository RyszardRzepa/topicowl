import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { NextResponse } from "next/server";
import { MODELS } from "@/constants";
import { prompts } from "@/prompts";
import type { ApiResponse } from "@/types";
import { z } from "zod";
import { getUserExcludedDomains } from "@/lib/utils/article-generation";

// Set maximum duration for AI operations to prevent timeouts
export const maxDuration = 800;

// Simplified schema that returns a markdown string outline
const outlineSchema = z.object({
  markdownOutline: z
    .string()
    .describe("Complete article outline in markdown format with full article structure including H1 title, introduction, TL;DR section, main content sections with H2 headings, and FAQ section"),
});

// Types colocated with this API route
export interface OutlineRequest {
  title: string;
  keywords: string[];
  researchData: string;
  userId: string; // Pass user ID from generate API
  sources?: Array<{
    url: string;
    title?: string;
  }>;
  generationId?: number; // Optional for backward compatibility
  videos?: Array<{
    title: string;
    url: string;
  }>;
  notes?: string; // User-provided context and requirements
  excludedDomains?: string[]; // Pass excluded domains from generate API
}

export type OutlineResponse = string;

export async function POST(request: Request) {
  try {
    console.log("[OUTLINE_API] POST request received");

    const body = (await request.json()) as OutlineRequest;
    const {
      title,
      keywords,
      researchData,
      userId,
      sources,
      videos,
      notes,
      excludedDomains,
    } = body;

    console.log("[OUTLINE_LOGIC] Starting outline generation", {
      title,
      keywords,
    });

    // Validate required fields
    if (!title) {
      throw new Error("Title is required");
    }

    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
      throw new Error("Keywords must be a non-empty array");
    }

    if (!researchData || typeof researchData !== "string") {
      throw new Error("Research data is required");
    }

    if (!userId) {
      throw new Error("User ID is required");
    }

    console.log(
      "[OUTLINE_LOGIC] Validation passed, filtering sources and generating outline",
    );

    // Use excluded domains from request or get from user settings as fallback
    const finalExcludedDomains =
      excludedDomains ?? (await getUserExcludedDomains(userId));

    // Log the sources before filtering
    console.log(`[OUTLINE_LOGIC] Sources before filtering:`, {
      sourcesCount: sources?.length ?? 0,
      sources: sources?.map((s) => ({
        url: s.url.substring(0, 50) + "...",
        title: s.title,
      })),
    });

    // Filter sources to remove excluded domains - inline the filtering logic
    const filteredSources =
      sources && finalExcludedDomains.length > 0
        ? sources.filter((source) => {
            try {
              const url = new URL(source.url);
              const domain = url.hostname;
              const isExcluded = finalExcludedDomains.some((excludedDomain) =>
                domain.toLowerCase().includes(excludedDomain.toLowerCase()),
              );

              if (isExcluded) {
                console.log(
                  `[OUTLINE_LOGIC] Filtered out source: ${source.url} (domain: ${domain})`,
                );
              }

              return !isExcluded;
            } catch (error) {
              // If URL parsing fails, keep the source (don't filter invalid URLs)
              console.warn(
                `[OUTLINE_LOGIC] Could not parse URL for filtering: ${source.url}`,
                error,
              );
              return true;
            }
          })
        : sources;

    console.log(
      `[OUTLINE_LOGIC] Calling generateObject with ${filteredSources?.length ?? 0} sources`,
    );

    const { object: outlineData } = await generateObject({
      model: google(MODELS.GEMINI_2_5_FLASH),
      schema: outlineSchema,
      prompt: prompts.outline(
        title,
        keywords,
        researchData,
        videos,
        notes,
        filteredSources,
        finalExcludedDomains,
      ),
      maxRetries: 3,
    });

    return NextResponse.json({
      success: true,
      data: outlineData.markdownOutline,
    } as ApiResponse<string>);
  } catch (error) {
    console.error("[OUTLINE_API] Outline generation error:", error);

    if (error instanceof Error) {
      return NextResponse.json(
        { success: false, error: error.message } as ApiResponse,
        { status: 500 },
      );
    }
    return NextResponse.json(
      { success: false, error: "Error in outline api" } as ApiResponse,
      { status: 500 },
    );
  }
}
