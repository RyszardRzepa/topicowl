import { google } from "@ai-sdk/google";
import { generateText } from "ai";
import { NextResponse } from "next/server";
import { prompts } from "@/constants";
import { MODELS } from "@/constants";

// Types colocated with this API route
export interface ResearchRequest {
  title: string;
  keywords: string[];
  notes?: string;
}

export interface ResearchResponse {
  researchData: string;
  sources: Array<{
    url: string;
    title?: string;
  }>;
  videos?: Array<{
    title: string;
    url: string;
  }>;
}

export async function POST(request: Request) {
  try {
    console.log("[RESEARCH_API] POST request received");
    const body = (await request.json()) as ResearchRequest;
    console.log("[RESEARCH_API] Request body:", JSON.stringify(body, null, 2));

    // Validate required fields
    if (!body.title) {
      console.log("[RESEARCH_API] Missing title field");
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    if (!body.keywords) {
      console.log("[RESEARCH_API] Missing keywords field");
      return NextResponse.json(
        { error: "Keywords field is required" },
        { status: 400 },
      );
    }

    if (!Array.isArray(body.keywords)) {
      console.log(
        "[RESEARCH_API] Keywords is not an array:",
        typeof body.keywords,
      );
      return NextResponse.json(
        { error: "Keywords must be an array" },
        { status: 400 },
      );
    }

    if (body.keywords.length === 0) {
      console.log("[RESEARCH_API] Empty keywords array provided");
      return NextResponse.json(
        { error: "At least one keyword is required" },
        { status: 400 },
      );
    }

    console.log("[RESEARCH_API] Validation passed, proceeding with research");

    const { text, sources } = await generateText({
      model: google(MODELS.GEMINI_2_5_FLASH, {
        useSearchGrounding: true,
        dynamicRetrievalConfig: {
          mode: "MODE_UNSPECIFIED", // Always trigger grounding
        },
      }),
      prompt: prompts.research(body.title, body.keywords, body.notes),
    });

    // Extract YouTube videos from sources
    const videos = sources
      ?.filter(source => source.url?.includes('youtube.com') || source.url?.includes('youtu.be'))
      .map(video => ({
        title: video.title ?? 'YouTube Video',
        url: video.url,
      }))
      .slice(0, 3) ?? []; // Limit to top 3 videos for AI selection

    console.log(
      "[RESEARCH_API] Research completed successfully, sources found:",
      sources?.length ?? 0,
      "videos found:",
      videos.length,
    );

    return NextResponse.json({
      researchData: text,
      sources: sources ?? [],
      videos,
    });
  } catch (error) {
    console.error("Research endpoint error:", error);
    return NextResponse.json(
      { error: "Failed to conduct research" },
      { status: 500 },
    );
  }
}
