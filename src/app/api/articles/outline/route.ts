import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { NextResponse } from "next/server";
import { MODELS } from "@/constants";
import { prompts } from "@/prompts";
import type { ApiResponse } from "@/types";
import { z } from "zod";
import { getUserExcludedDomains } from "@/lib/utils/article-generation";

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
    .max(5)
    .describe("Sections that could benefit from video content integration"),
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

export type OutlineResponse = z.infer<typeof outlineSchema>;

export async function POST(request: Request) {
  try {
    console.log("[OUTLINE_API] POST request received");
    
    const body = (await request.json()) as OutlineRequest;
    const { title, keywords, researchData, userId, sources, videos, notes, excludedDomains } = body;

    console.log("[OUTLINE_LOGIC] Starting outline generation", { title, keywords });

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

    console.log("[OUTLINE_LOGIC] Validation passed, filtering sources and generating outline");

    // Use excluded domains from request or get from user settings as fallback
    const finalExcludedDomains = excludedDomains ?? (await getUserExcludedDomains(userId));
    
    // Log the sources before filtering
    console.log(`[OUTLINE_LOGIC] Sources before filtering:`, {
      sourcesCount: sources?.length ?? 0,
      sources: sources?.map(s => ({ url: s.url.substring(0, 50) + '...', title: s.title }))
    });
    
    // Filter sources to remove excluded domains - inline the filtering logic
    const filteredSources = sources && finalExcludedDomains.length > 0 
      ? sources.filter(source => {
          try {
            const url = new URL(source.url);
            const domain = url.hostname;
            const isExcluded = finalExcludedDomains.some(excludedDomain => 
              domain.toLowerCase().includes(excludedDomain.toLowerCase())
            );
            
            if (isExcluded) {
              console.log(`[OUTLINE_LOGIC] Filtered out source: ${source.url} (domain: ${domain})`);
            }
            
            return !isExcluded;
          } catch (error) {
            // If URL parsing fails, keep the source (don't filter invalid URLs)
            console.warn(`[OUTLINE_LOGIC] Could not parse URL for filtering: ${source.url}`, error);
            return true;
          }
        })
      : sources;
    
    // Log the sources after filtering
    console.log(`[OUTLINE_LOGIC] Sources after filtering:`, {
      excludedDomainsCount: finalExcludedDomains.length,
      filteredSourcesCount: filteredSources?.length ?? 0,
      filteredSources: filteredSources?.map(s => ({ url: s.url.substring(0, 50) + '...', title: s.title }))
    });

    try {
      console.log(`[OUTLINE_LOGIC] Calling generateObject with ${filteredSources?.length ?? 0} sources`);
      
      const { object: outlineData } = await generateObject({
        model: google(MODELS.GEMINI_2_5_FLASH),
        schema: outlineSchema,
        system: "Ensure the intent is current and based on real-time top results.",
        prompt: prompts.outline(title, keywords, researchData, videos, notes, filteredSources, finalExcludedDomains),
        maxRetries: 3,
      });

      console.log(`[OUTLINE_LOGIC] Successfully generated outline with ${outlineData.keyPoints?.length ?? 0} key points`);
      
      return NextResponse.json({
        success: true,
        data: outlineData,
      } as ApiResponse<OutlineResponse>);
    } catch (error) {
      console.log("[OUTLINE_LOGIC] Schema validation failed, trying with relaxed schema", error);
      
      // Fallback schema with more lenient character limits
      const relaxedOutlineSchema = z.object({
        title: z.string().describe("The article title"),
        keywords: z.array(z.string()).describe("Array of target keywords"),
        researchAnalysisSummary: z.object({
          totalSourcesAnalyzed: z.number().describe("Number of sources analyzed from research data"),
          keyThemesIdentified: z.number().describe("Number of key themes identified"),
        }).describe("Summary of research analysis process").optional(),
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
        videoIntegration: z.object({
          optimalSection: z.string().describe("Heading of section selected for video integration"),
          integrationRationale: z.string().describe("Why this section was selected for video demonstration"),
          matchedVideo: z.string().describe("Title and URL of best matching video"),
        }).optional().describe("Video integration details when videos are available"),
        videoMatchingSections: z
          .array(z.string())
          .max(5)
          .describe("Sections that could benefit from video content integration"),
      });

      console.log(`[OUTLINE_LOGIC] Using relaxed schema with ${filteredSources?.length ?? 0} sources`);

      const { object: relaxedOutlineData } = await generateObject({
        model: google(MODELS.GEMINI_2_5_FLASH),
        schema: relaxedOutlineSchema,
        prompt: prompts.outline(title, keywords, researchData, videos, notes, filteredSources, finalExcludedDomains) + 
          "\n\nIMPORTANT: Keep summaries under 350 characters to ensure proper formatting.",
        maxRetries: 2,
      });

      // Ensure the relaxed outline data matches the expected response type
      const outlineData: OutlineResponse = {
        ...relaxedOutlineData,
        researchAnalysisSummary: relaxedOutlineData.researchAnalysisSummary ?? {
          totalSourcesAnalyzed: filteredSources?.length ?? 0,
          keyThemesIdentified: 5,
        },
        videoIntegration: relaxedOutlineData.videoIntegration,
      };

      console.log(`[OUTLINE_LOGIC] Successfully generated relaxed outline with ${outlineData.keyPoints?.length ?? 0} key points`);
      
      return NextResponse.json({
        success: true,
        data: outlineData,
      } as ApiResponse<OutlineResponse>);
    }
  } catch (error) {
    console.error("[OUTLINE_API] Outline generation error:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to generate outline";
    return NextResponse.json(
      { success: false, error: errorMessage } as ApiResponse,
      { status: 500 },
    );
  }
}
