/**
 * Research service for article generation using Parallel AI
 * Updated to use Parallel API with webhook support instead of Gemini and Jina
 */

import { env } from "@/env";
import { logger } from "../utils/logger";
import { z } from "zod";

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
    article_outline: {
      type: "string",
      description: "Draft H2/H3 outline structure with max 12 items for the article"
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
    youtube_video_title: {
      type: "string",
      description: "Title of the most relevant YouTube video found, or empty string if none"
    },
    youtube_video_url: {
      type: "string", 
      description: "URL of the most relevant YouTube video found, or empty string if none"
    },
    youtube_selection_reason: {
      type: "string",
      description: "Brief explanation of why the YouTube video was selected, or empty string if none"
    },
    research_timestamp: {
      type: "string",
      description: "ISO timestamp when the research was conducted"
    }
  },
  required: [
    "executive_summary",
    "primary_intent", 
    "key_insights",
    "statistics_data",
    "content_gaps",
    "article_outline",
    "frequently_asked_questions",
    "source_urls",
    "research_timestamp"
  ],
  additionalProperties: false
} as const;

type ParallelResearchResponse = {
  executive_summary: string;
  primary_intent: string;
  secondary_intents: string;
  key_insights: string;
  statistics_data: string;
  content_gaps: string;
  article_outline: string;
  frequently_asked_questions: string;
  internal_linking_suggestions: string;
  risk_assessment: string;
  source_urls: string;
  youtube_video_title: string;
  youtube_video_url: string;
  youtube_selection_reason: string;
  research_timestamp: string;
};

// Export type for use in webhook handler
export type { ParallelResearchResponse };

/**
 * Converts Parallel API response to our existing ResearchResponse format
 */
export function convertParallelResponseToResearchResponse(
  parallelResponse: ParallelResearchResponse
): {
  researchData: string;
  sources: Array<{ url: string; title?: string }>;
  videos: Array<{ title: string; url: string; reason: string }>;
} {
  // Parse sources from the source_urls string
  const sources: Array<{ url: string; title?: string }> = [];
  const sourceLines = parallelResponse.source_urls.split('\n').filter(line => line.trim());
  
  const sourceRegex = /^S\d+:\s*(.+)$/;
  for (const line of sourceLines) {
    const match = sourceRegex.exec(line);
    if (match) {
      const url = match[1]?.trim();
      if (url) {
        sources.push({ url, title: undefined });
      }
    }
  }

  // Parse videos if available
  const videos: Array<{ title: string; url: string; reason: string }> = [];
  if (parallelResponse.youtube_video_url && parallelResponse.youtube_video_title) {
    videos.push({
      title: parallelResponse.youtube_video_title,
      url: parallelResponse.youtube_video_url,
      reason: parallelResponse.youtube_selection_reason || "Selected as most relevant video for the topic"
    });
  }

  // Construct comprehensive research data
  const researchData = `# Research Brief

## Executive Summary
${parallelResponse.executive_summary}

## Search Intent Analysis
**Primary Intent:** ${parallelResponse.primary_intent}
${parallelResponse.secondary_intents ? `**Secondary Intents:** ${parallelResponse.secondary_intents}` : ''}

## Key Findings
${parallelResponse.key_insights}

## Statistics & Data
${parallelResponse.statistics_data}

## Content Opportunities
${parallelResponse.content_gaps}

## Recommended Article Structure
${parallelResponse.article_outline}

## Frequently Asked Questions
${parallelResponse.frequently_asked_questions}

${parallelResponse.internal_linking_suggestions ? `## Internal Linking Opportunities
${parallelResponse.internal_linking_suggestions}` : ''}

${parallelResponse.risk_assessment ? `## Risk Assessment
${parallelResponse.risk_assessment}` : ''}

---
*Research conducted: ${parallelResponse.research_timestamp}*`;

  return {
    researchData,
    sources,
    videos
  };
}

// Re-export types for backward compatibility
export interface ResearchRequest {
  title: string;
  keywords: string[];
  notes?: string;
  excludedDomains?: string[];
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
    reason?: string;
  }>;
}

// New response structure for Parallel API
export interface ParallelResearchTaskResponse {
  run_id: string;
  status: "queued" | "running" | "completed" | "failed";
  is_active: boolean;
  created_at: string;
  modified_at: string;
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

// Configuration for Parallel API
const PARALLEL_CONFIG = {
  baseUrl: "https://api.parallel.ai/v1",
  processor: "ultra", // Use ultra processor for research tasks
} as const;

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
6. ARTICLE OUTLINE: H2/H3 structure (max 12 items) for comprehensive coverage
7. FAQ SECTION: 4-6 common questions with answers, each citing sources
8. INTERNAL LINKS: 3-5 suggestions for related content to link to
9. RISK ASSESSMENT: Any outdated info, conflicts, or ambiguities found
10. SOURCES: All URLs found during research in format "S1: <URL>"
11. YOUTUBE VIDEO: Find the most relevant YouTube video with title, URL, and selection reason

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

// Polling logic removed - webhook handles completion

/**
 * Simplified research function - just triggers Parallel API and returns run_id
 * Webhook handles completion and status updates
 */
export async function performResearchDirect(
  request: ResearchRequest
): Promise<{
  run_id: string;
  status: string;
}> {
  const { title, keywords, notes, excludedDomains } = request;

  // Validate required fields
  if (!title) {
    throw new Error("Title is required");
  }

  if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
    throw new Error("At least one keyword is required");
  }

  logger.info("[RESEARCH_SERVICE] Starting Parallel AI research", {
    title,
    keywordCount: keywords.length
  });

  // Create the research task with webhook
  const taskResult = await createParallelResearchTask(
    title, 
    keywords, 
    notes, 
    excludedDomains
  );

  logger.info("[RESEARCH_SERVICE] Task created with webhook", {
    run_id: taskResult.run_id
  });

  return {
    run_id: taskResult.run_id,
    status: taskResult.status
  };
}
