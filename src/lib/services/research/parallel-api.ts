/**
 * Parallel AI integration for research tasks
 */

import { env } from "@/env";
import { logger } from "@/lib/utils/logger";
import { z } from "zod";
import type { ResearchVideo, ParallelResearchTaskResponse } from "./types";

/**
 * Get the webhook URL based on environment
 */
function getWebhookUrl(): string {
  const isDevelopment = env.NODE_ENV === "development";
  
  if (isDevelopment) {
    return "https://tunnel.roomsdecor.com/api/webhooks/parallel";
  } else {
    // Production - use Vercel URL or custom domain
    const vercelUrl = process.env.VERCEL_URL;
    if (vercelUrl) {
      return `https://${vercelUrl}/api/webhooks/parallel`;
    }
    // Fallback to your production domain (replace with actual domain)
    return "https://topicowl.com/api/webhooks/parallel";
  }
}

/**
 * Parallel API JSON Schema for Research Tasks
 * Flat structure with max 15 properties as required by Parallel API
 */
const PARALLEL_RESEARCH_SCHEMA = {
  type: "object",
  properties: {
    executive_summary: {
      type: "string",
      description: "2-3 sentence summary of key findings and what the article should claim"
    },
    primary_intent: {
      type: "string", 
      description: "Primary search intent behind the topic (informational, commercial, navigational)"
    },
    secondary_intents: {
      type: "string",
      description: "Comma-separated list of secondary search intents and who currently ranks for them"
    },
    key_insights: {
      type: "string",
      description: "5-8 bullet points of key findings with source citations as [S1], [S2] format"
    },
    statistics_data: {
      type: "string", 
      description: "3-6 data points and statistics with exact figures and source citations"
    },
    content_gaps: {
      type: "string",
      description: "3-5 content opportunities and gaps identified with source references where relevant"
    },
    frequently_asked_questions: {
      type: "string",
      description: "4-6 Q&A pairs, each with source citations [S1], [S2] format"
    },
    internal_linking_suggestions: {
      type: "string", 
      description: "3-5 internal link suggestions with suggested anchor text and target pages"
    },
    risk_assessment: {
      type: "string",
      description: "Potential ambiguities, dated information, or conflicts identified with source references"
    },
    source_urls: {
      type: "string",
      description: "Newline-separated list of source URLs found during research, format: S1: <URL>"
    },
  },
  required: [
    "executive_summary",
    "primary_intent", 
    "key_insights",
    "statistics_data",
    "content_gaps",
    "frequently_asked_questions",
    "source_urls",
  ],
  additionalProperties: false
} as const;

const PARALLEL_SEARCH_ENDPOINT = "https://api.parallel.ai/v1beta/search" as const;

// Configuration for Parallel API
const PARALLEL_CONFIG = {
  baseUrl: "https://api.parallel.ai/v1",
  processor: "ultra", // Use ultra processor for research tasks
} as const;

interface ParallelSearchItem {
  url?: string;
  title?: string;
  excerpts?: string[];
}

interface ParallelSearchResponse {
  search_id: string;
  results: ParallelSearchItem[];
}

const parallelResearchTaskResponseSchema = z
  .object({
    run_id: z.string(),
    status: z.enum(["queued", "running", "completed", "failed"]),
    is_active: z.boolean(),
    created_at: z.string(),
    modified_at: z.string(),
  })
  .passthrough();



export const parallelRunResultSchema = z.object({
  output: z.object({
    type: z.string(),
    basis: z
      .array(
        z.object({
          field: z.string(),
          citations: z
            .array(
              z.object({
                title: z.string().optional(),
                url: z.string(),
                excerpts: z.array(z.string()).optional(),
              }),
            )
            .optional(),
          reasoning: z.string().optional(),
          confidence: z.string().optional(),
        }),
      )
      .optional(),
    content: z.any(), // Using z.any() to avoid circular dependency
  }),
});

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function firstExcerpt(excerpts: string[] | undefined): string | undefined {
  if (!Array.isArray(excerpts)) {
    return undefined;
  }
  for (const item of excerpts) {
    if (isNonEmptyString(item)) {
      return item.trim();
    }
  }
  return undefined;
}

function parseYouTubeWatchUrl(rawUrl: string): { canonicalUrl: string | null; videoId: string | null } {
  try {
    const parsed = new URL(rawUrl);
    const hostname = parsed.hostname.toLowerCase();
    if (!hostname.endsWith("youtube.com")) {
      return { canonicalUrl: null, videoId: null };
    }
    const pathname = parsed.pathname.toLowerCase();
    if (pathname !== "/watch") {
      return { canonicalUrl: null, videoId: null };
    }
    const videoId = parsed.searchParams.get("v");
    if (!videoId || videoId.trim().length === 0) {
      return { canonicalUrl: null, videoId: null };
    }
    const canonicalUrl = `https://www.youtube.com/watch?v=${videoId}`;
    return { canonicalUrl, videoId };
  } catch (error) {
    logger.debug("[PARALLEL_YOUTUBE] Skipping invalid URL", {
      url: rawUrl,
      error: error instanceof Error ? error.message : "unknown",
    });
    return { canonicalUrl: null, videoId: null };
  }
}

export async function searchYoutubeVideos(
  topic: string,
  keywords: string[],
  options?: { maxResults?: number },
): Promise<ResearchVideo[]> {
  if (!env.PARALLEL_API_KEY) {
    logger.warn("[PARALLEL_YOUTUBE] Missing Parallel API key, skipping search", {
      topic,
    });
    return [];
  }

  const maxResults = options?.maxResults ?? 5;
  const baseQueries = [topic, ...keywords.slice(0, 2)]
    .map((query) => query.trim())
    .filter((query) => query.length > 0);
  const searchQueries = Array.from(new Set(baseQueries));

  if (searchQueries.length === 0) {
    logger.debug("[PARALLEL_YOUTUBE] No valid queries provided", { topic });
    return [];
  }

  const objectiveLines = [
    `Search the web for YouTube links for topic "${topic}".`,
    " Return only valid YouTube video links that have '/watch' in url. Find videos with most views or likes.",
  ];

  const body = {
    search_queries: searchQueries,
    processor: "base",
    objective: objectiveLines.join("\n"),
  };

  try {
    const response = await fetch(PARALLEL_SEARCH_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": env.PARALLEL_API_KEY,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error("[PARALLEL_YOUTUBE] Search API error", {
        status: response.status,
        statusText: response.statusText,
        errorText,
      });
      return [];
    }

    const payload = (await response.json()) as ParallelSearchResponse;

    if (!Array.isArray(payload.results)) {
      logger.warn("[PARALLEL_YOUTUBE] Unexpected search response shape", {
        topic,
        payloadType: typeof payload.results,
      });
      return [];
    }

    const seenVideoIds = new Set<string>();
    const videos: ResearchVideo[] = [];

    for (const item of payload.results) {
      if (!item || typeof item !== "object") {
        continue;
      }

      if (!isNonEmptyString(item.url)) {
        continue;
      }

      const { canonicalUrl, videoId } = parseYouTubeWatchUrl(item.url);
      if (!canonicalUrl || !videoId) {
        continue;
      }

      if (seenVideoIds.has(videoId)) {
        continue;
      }
      seenVideoIds.add(videoId);

      const rawTitle = isNonEmptyString(item.title)
        ? item.title.trim()
        : "";
      const title = rawTitle.length > 0 ? rawTitle : canonicalUrl;
      const excerpt = firstExcerpt(item.excerpts);

      videos.push({
        title,
        url: canonicalUrl,
        excerpt,
      });

      if (videos.length >= maxResults) {
        break;
      }
    }

    logger.debug("[PARALLEL_YOUTUBE] Retrieved video results", {
      topic,
      keywordCount: keywords.length,
      videoCount: videos.length,
    });

    return videos;
  } catch (error) {
    logger.error("[PARALLEL_YOUTUBE] Failed to execute search", error);
    return [];
  }
}

/**
 * Creates a research task prompt for Parallel AI
 */
function createResearchPrompt(
  title: string,
  keywords: string[],
  notes?: string,
  excludedDomains?: string[]
): string {
  const excludedDomainsText = excludedDomains?.length 
    ? `\n\nEXCLUDED DOMAINS: Completely avoid information from these domains: ${excludedDomains.join(", ")}`
    : "";

  const notesText = notes 
    ? `\n\nADDITIONAL CONTEXT: ${notes}`
    : "";

 return `You are an expert content researcher analyzing the topic: "${title}"

TARGET KEYWORDS: ${keywords.join(", ")}${notesText}${excludedDomainsText}

Research this topic comprehensively and provide a structured analysis. Focus on:

1. EXECUTIVE SUMMARY: 2-3 sentences on key findings and main claims the article should make
2. SEARCH INTENT: Primary intent (informational/commercial/navigational) and secondary intents
3. KEY INSIGHTS: 5-8 bullet points with specific findings, include source citations as [S1], [S2]
4. STATISTICS: 3-6 concrete data points with exact figures and citations
5. CONTENT GAPS: 3-5 opportunities where competitors aren't covering topics well
6. FAQ SECTION: 4-6 common questions with answers, each citing sources
7. INTERNAL LINKS: 3-5 suggestions for related content to link to
8. RISK ASSESSMENT: Any outdated info, conflicts, or ambiguities found
9. SOURCES: All URLs found during research in format "S1: <URL>"

Use only authoritative sources and recent information. Cite everything with [S1], [S2] format. Be thorough but concise.`;
}

/**
 * Calls Parallel API to create a research task with webhook notification
 */
export async function createParallelResearchTask(
  title: string,
  keywords: string[],
  notes?: string,
  excludedDomains?: string[]
): Promise<ParallelResearchTaskResponse> {
  const prompt = createResearchPrompt(title, keywords, notes, excludedDomains);
  const webhookUrl = getWebhookUrl();
  
  const requestBody = {
    task_spec: {
      output_schema: {
        type: "json",
        json_schema: PARALLEL_RESEARCH_SCHEMA
      }
    },
    input: prompt,
    processor: PARALLEL_CONFIG.processor,
    metadata: {
      article_title: title,
      keywords: keywords.join(","),
      timestamp: new Date().toISOString()
    },
    webhook: {
      url: webhookUrl,
      event_types: ["task_run.status"]
    }
  };

  logger.debug("[PARALLEL_RESEARCH] Creating research task", {
    title,
    keywordCount: keywords.length,
    webhookUrl
  });

  try {
    const response = await fetch(`${PARALLEL_CONFIG.baseUrl}/tasks/runs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": env.PARALLEL_API_KEY,
        "parallel-beta": "webhook-2025-08-12"
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Parallel API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const parsedResult = parallelResearchTaskResponseSchema.parse(
      await response.json(),
    );
    const result: ParallelResearchTaskResponse = parsedResult;

    logger.info("[PARALLEL_RESEARCH] Task created successfully", {
      run_id: result.run_id,
      status: result.status
    });

    return result;
  } catch (error) {
    logger.error("[PARALLEL_RESEARCH] Failed to create task", error);
    throw new Error(
      `Failed to create research task: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}