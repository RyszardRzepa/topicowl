/**
 * Research service for article generation
 * Extracted from the research API route to allow direct function calls
 */

import { google } from "@ai-sdk/google";
import { generateText } from "ai";
import { prompts } from "@/prompts";
import { MODELS } from "@/constants";

// Re-export types from the API route
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

/**
 * Core research function that can be called directly without HTTP
 * Extracted from /api/articles/research/route.ts
 */
export async function performResearchDirect(request: ResearchRequest): Promise<ResearchResponse> {
  const { title, keywords, notes, excludedDomains } = request;

  // Validate required fields
  if (!title) {
    throw new Error("Title is required");
  }

  if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
    throw new Error("At least one keyword is required");
  }

  // Use provided excluded domains or empty array
  const domainsToExclude = excludedDomains ?? [];

  console.log(`[RESEARCH_SERVICE] Starting research for "${title}" with ${keywords.length} keywords`);
  if (domainsToExclude.length > 0) {
    console.log(`[RESEARCH_SERVICE] Excluding ${domainsToExclude.length} domains: ${domainsToExclude.join(', ')}`);
  }

  try {
    // Retry logic for when sources are empty or not returned
    let text: string;
    let sources: Array<{
      sourceType: string;
      url: string;
      title?: string;
    }> = [];
    let attempt = 1;
    const maxAttempts = 1;

    do {
      console.log(`[RESEARCH_SERVICE] Attempt ${attempt}/${maxAttempts}`);

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
        system: `Ensure the intent is current and based on real-time top results.`,
        prompt: prompts.research(title, keywords, notes, domainsToExclude),
      });

      text = result.text;

      // Get sources from result.sources or fallback to grounding metadata
      let resultSources = (result.sources ?? []) as Array<{
        sourceType: string;
        url: string;
        title?: string;
      }>;

      // Filter out excluded domains from sources
      if (domainsToExclude.length > 0) {
        const originalCount = resultSources.length;
        resultSources = resultSources.filter(source => {
          try {
            const url = new URL(source.url);
            const domain = url.hostname.toLowerCase().replace(/^www\./, '');
            
            const isExcluded = domainsToExclude.some(excludedDomain => {
              const normalizedExcluded = excludedDomain.toLowerCase().replace(/^www\./, '');
              return domain === normalizedExcluded || domain.endsWith('.' + normalizedExcluded);
            });
            
            if (isExcluded) {
              console.log(`[RESEARCH_SERVICE] Filtered out source: ${source.url}`);
            }
            
            return !isExcluded;
          } catch {
            return true; // Keep sources with invalid URLs
          }
        });
        
        const filteredCount = originalCount - resultSources.length;
        if (filteredCount > 0) {
          console.log(`[RESEARCH_SERVICE] Filtered out ${filteredCount} sources due to excluded domains`);
        }
      }

      sources = resultSources;
      attempt++;
      
    } while (sources.length === 0 && attempt <= maxAttempts);

    // Convert sources to the expected format
    const formattedSources = sources.map(source => ({
      url: source.url,
      title: source.title
    }));

    console.log(`[RESEARCH_SERVICE] Research completed successfully`, {
      researchDataLength: text.length,
      sourcesCount: formattedSources.length,
      excludedDomainsCount: domainsToExclude.length
    });

    return {
      researchData: text,
      sources: formattedSources,
      videos: [] // Videos would need additional logic from the original API
    };

  } catch (error) {
    console.error(`[RESEARCH_SERVICE] Research failed:`, error);
    throw new Error(`Research failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
