import { google } from "@ai-sdk/google";
import { generateText } from "ai";
import { NextResponse } from "next/server";
import { prompts } from "@/prompts";
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

// Function to resolve Google redirect URLs to actual destinations
async function resolveGoogleRedirectUrl(url: string): Promise<string> {
  try {
    // Check if it's a Google redirect URL
    if (!url.includes('vertexaisearch.cloud.google.com/grounding-api-redirect/')) {
      return url;
    }

    const response = await fetch(url, {
      method: 'HEAD',
      redirect: 'manual'
    });

    // Check for redirect location
    const location = response.headers.get('location');
    if (location) {
      return location;
    }

    // If no redirect header, try GET request
    const getResponse = await fetch(url, {
      redirect: 'manual'
    });
    
    const getLocation = getResponse.headers.get('location');
    if (getLocation) {
      return getLocation;
    }

    // Fallback to original URL if no redirect found
    return url;
  } catch (error) {
    console.error(`[RESEARCH_API] Failed to resolve redirect URL: ${url}`, error);
    return url; // Return original URL on error
  }
}

// Function to resolve all source URLs
async function resolveSources(sources: Array<{
  sourceType: string;
  url: string;
  title?: string;
}>): Promise<Array<{
  url: string;
  title?: string;
}>> {
  const resolvedSources = await Promise.allSettled(
    sources.map(async (source) => {
      const resolvedUrl = await resolveGoogleRedirectUrl(source.url);
      return {
        url: resolvedUrl,
        title: source.title
      };
    })
  );

  return resolvedSources
    .filter((result) => result.status === 'fulfilled')
    .map((result) => (result as PromiseFulfilledResult<{url: string; title?: string}>).value);
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

    // Retry logic for when sources are empty or not returned
    let text: string;
    let sources: Array<{
      sourceType: string;
      url: string;
      title?: string;
    }> = [];
    let attempt = 1;
    const maxAttempts = 3; // Initial attempt + 2 retries

    do {
      console.log(`[RESEARCH_API] Attempt ${attempt}/${maxAttempts}`);
      
      const result = await generateText({
        model: google(MODELS.GEMINI_2_5_FLASH),
        providerOptions: {
          google: {
            thinkingConfig: {
              thinkingBudget: 0,
            },
          },
        },
        tools: {
          google_search: google.tools.googleSearch({}),
        },
        toolChoice: { type: "tool", toolName: "google_search" }, // force it
        system:
          "Always call tool google_search for web search.",
        prompt: prompts.research(body.title, body.keywords, body.notes),
      });

      text = result.text;
      sources = (result.sources ?? []) as Array<{
        sourceType: string;
        url: string;
        title?: string;
      }>;

      console.log(`[RESEARCH_API] Attempt ${attempt} - sources count:`, sources.length);

      // Break if we have sources or reached max attempts
      if (sources.length > 0 || attempt >= maxAttempts) {
        break;
      }

      attempt++;
    } while (attempt <= maxAttempts);

    // Throw error if no sources found after all attempts
    if (sources.length === 0) {
      console.error("[RESEARCH_API] No sources found after all attempts");
      return NextResponse.json(
        { error: "Failed to find any sources for research after multiple attempts" },
        { status: 500 }
      );
    }

    console.log("[RESEARCH_API] Final sources:", sources);

    // Resolve Google redirect URLs to actual destinations
    const resolvedSources = await resolveSources(sources);
    console.log("[RESEARCH_API] Resolved sources:", resolvedSources);

    // Extract YouTube videos from resolved sources
    const videos = resolvedSources
      .filter(
        (source) =>
          source.url.includes("youtube.com") ||
          source.url.includes("youtu.be")
      )
      .map((video) => ({
        title: video.title ?? "YouTube Video",
        url: video.url,
      }))
      .slice(0, 3); // Limit to top 3 videos for AI selection

    console.log(
      "[RESEARCH_API] Valid sources processed:",
      resolvedSources.length,
      "videos found:",
      videos.length,
    );

    return NextResponse.json({
      researchData: text,
      sources: resolvedSources,
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
