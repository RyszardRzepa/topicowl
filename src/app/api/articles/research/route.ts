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
  }>;
}

// Grounding metadata types for Gemini
interface GroundingChunk {
  web?: {
    uri: string;
    title?: string;
  };
}

interface GroundingSupport {
  groundingChunkIndices?: number[];
}

interface GroundingMetadata {
  groundingChunks?: GroundingChunk[];
  groundingSupports?: GroundingSupport[];
}

export async function POST(request: Request) {
  try {

    const body = (await request.json()) as ResearchRequest;

    const { title, keywords, notes, excludedDomains } = body;

    console.log("[RESEARCH_LOGIC] Starting research", {
      title,
      keywords,
      hasNotes: !!notes,
      excludedDomainsCount: excludedDomains?.length ?? 0,
    });

    // Validate required fields
    if (!title) {
      throw new Error("Title is required");
    }

    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
      throw new Error("At least one keyword is required");
    }

    // Use provided excluded domains or empty array
    const domainsToExclude = excludedDomains ?? [];

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
      console.log(`[RESEARCH_LOGIC] Attempt ${attempt}/${maxAttempts}`);

      const result = await generateText({
        model: google(MODELS.GEMINI_2_5_FLASH),
        providerOptions: {
          google: {
            thinkingConfig: {
              thinkingBudget: 5000,
            },
          },
        },
        tools: {
          google_search: google.tools.googleSearch({}),
        },
        system:
          `As of ${new Date().toISOString()} verify every factual claim using Google Search. For each claim, attach at least 2 grounding supports (with URL and title) drawn from groundingChunks and include a “Sources” section at the end listing those URLs`,
        prompt: prompts.research(title, keywords, notes, domainsToExclude),
      });

      text = result.text;
      
      // Get sources from result.sources or fallback to grounding metadata
      let resultSources = (result.sources ?? []) as Array<{
        sourceType: string;
        url: string;
        title?: string;
      }>;

      // Fallback to grounding metadata or text extraction when sources is empty
      if (resultSources.length === 0) {
        console.log("[RESEARCH_LOGIC] Sources empty, checking grounding metadata and text");
        
        const meta = result.providerMetadata?.google?.groundingMetadata as GroundingMetadata | undefined;
        const chunks = meta?.groundingChunks ?? [];
        const supports = meta?.groundingSupports ?? [];

        console.log(`[RESEARCH_LOGIC] Grounding metadata - chunks: ${chunks.length}, supports: ${supports.length}`);

        // First try grounding metadata
        if (chunks.length > 0 && supports.length > 0) {
          const idx = new Set<number>();
          for (const s of supports) {
            (s.groundingChunkIndices ?? []).forEach((i: number) => idx.add(i));
          }

          const derivedSources = [...idx]
            .map(i => chunks[i]?.web)
            .filter(Boolean)
            .map(w => ({ 
              sourceType: "web",
              url: w!.uri, 
              title: w!.title 
            }));

          console.log(`[RESEARCH_LOGIC] Derived ${derivedSources.length} sources from grounding metadata`);
          resultSources = derivedSources;
        }

        // If still no sources, try to extract from text
        if (resultSources.length === 0) {
          console.log("[RESEARCH_LOGIC] Attempting to extract sources from response text");
          
          // Look for Google Vertex AI search redirect URLs in the text
          const vertexUrlRegex = /https:\/\/vertexaisearch\.cloud\.google\.com\/grounding-api-redirect\/[^\s<>"{}|\\^`[\]]+/g;
          const vertexUrls = text.match(vertexUrlRegex);
          
          if (vertexUrls) {
            const uniqueVertexUrls = [...new Set(vertexUrls)];
            resultSources = uniqueVertexUrls.map(url => ({
              sourceType: "web",
              url,
              title: undefined
            }));
            console.log(`[RESEARCH_LOGIC] Extracted ${resultSources.length} Vertex AI redirect URLs from text`);
          } else {
            // Fallback: extract any URLs from the text
            const urlMatches = text.match(/https?:\/\/[^\s<>"{}|\\^`[\]]+/g);
            if (urlMatches) {
              const uniqueUrls = [...new Set(urlMatches)];
              resultSources = uniqueUrls.map(url => ({
                sourceType: "web",
                url,
                title: undefined
              }));
              console.log(`[RESEARCH_LOGIC] Extracted ${resultSources.length} URLs as fallback sources`);
            }
          }
        }
      }

      sources = resultSources;

      console.log(
        `[RESEARCH_LOGIC] Attempt ${attempt} - sources count:`,
        sources.length,
      );

      // Break if we have sources or reached max attempts
      if (sources.length > 0 || attempt >= maxAttempts) {
        break;
      }

      attempt++;
    } while (attempt <= maxAttempts);

    // Throw error if no sources found after all attempts
    if (sources.length === 0) {
      console.error("[RESEARCH_LOGIC] No sources found after all attempts");
      throw new Error(
        "Failed to find any sources for research after multiple attempts",
      );
    }

    console.log("[RESEARCH_LOGIC] Final sources:", sources);

    // Resolve Google redirect URLs and validate source availability
    const resolvedSources = await Promise.allSettled(
      sources.map(async (source) => {
        let resolvedUrl = source.url;
        let resolvedTitle = source.title;
        let isValid = false;
        
        // Check if it's a Google redirect URL and resolve it
        if (source.url.includes("vertexaisearch.cloud.google.com/grounding-api-redirect/")) {
          try {
            console.log(`[RESEARCH_API] Resolving Vertex AI redirect: ${source.url.substring(0, 80)}...`);
            
            const response = await fetch(source.url, {
              method: "HEAD",
              redirect: "manual",
              headers: {
                "User-Agent": "ContentBot Research/1.0"
              },
              signal: AbortSignal.timeout(5000) // 5 second timeout
            });

            // Check for redirect location
            const location = response.headers.get("location");
            if (location) {
              resolvedUrl = location;
              console.log(`[RESEARCH_API] Resolved to: ${resolvedUrl}`);
            } else {
              // If no redirect header, try GET request
              const getResponse = await fetch(source.url, {
                redirect: "manual",
                headers: {
                  "User-Agent": "ContentBot Research/1.0"
                },
                signal: AbortSignal.timeout(5000) // 5 second timeout
              });

              const getLocation = getResponse.headers.get("location");
              if (getLocation) {
                resolvedUrl = getLocation;
                console.log(`[RESEARCH_API] Resolved via GET to: ${resolvedUrl}`);
              }
            }
            
            // Extract domain from resolved URL as title
            if (resolvedUrl !== source.url) {
              try {
                const urlObj = new URL(resolvedUrl);
                resolvedTitle = urlObj.hostname.replace(/^www\./, '');
                console.log(`[RESEARCH_API] Set title to domain: ${resolvedTitle}`);
              } catch (error) {
                console.warn(`[RESEARCH_API] Could not extract domain from ${resolvedUrl}:`, error);
                resolvedTitle = "Unknown Source";
              }
            }
          } catch (error) {
            console.error(
              `[RESEARCH_API] Failed to resolve redirect URL: ${source.url.substring(0, 80)}...`,
              error,
            );
            // Keep original URL on error, but mark as invalid
            return {
              url: source.url,
              title: "Invalid Source",
              isValid: false
            };
          }
        }
        
        // Validate the final URL (only if we successfully resolved it or it wasn't a redirect)
        if (resolvedUrl !== source.url || !source.url.includes("vertexaisearch.cloud.google.com")) {
          try {
            const validationResponse = await fetch(resolvedUrl, {
              method: "HEAD",
              headers: {
                "User-Agent": "ContentBot Research/1.0"
              },
              signal: AbortSignal.timeout(5000) // 5 second timeout
            });
            
            isValid = validationResponse.ok || validationResponse.status === 405; // 405 Method Not Allowed is ok for HEAD requests
            
            if (!isValid) {
              console.warn(`[RESEARCH_API] Source returned status ${validationResponse.status}: ${resolvedUrl}`);
            } else {
              console.log(`[RESEARCH_API] Validated source: ${resolvedUrl} (${validationResponse.status})`);
            }
          } catch (error) {
            console.error(`[RESEARCH_API] Failed to validate source: ${resolvedUrl}`, error);
            isValid = false;
          }
        } else {
          // If we couldn't resolve a vertex redirect URL, mark as invalid
          isValid = false;
        }
        
        return {
          url: resolvedUrl,
          title: resolvedTitle,
          isValid
        };
      }),
    );

    const processedSources = resolvedSources
      .filter((result) => result.status === "fulfilled")
      .map(
        (result) =>
          (result as PromiseFulfilledResult<{ url: string; title?: string; isValid: boolean }>)
            .value,
      );

    // Separate valid and invalid sources
    const validSources = processedSources.filter(source => source.isValid);
    const invalidSources = processedSources.filter(source => !source.isValid);
    
    if (invalidSources.length > 0) {
      console.warn(`[RESEARCH_API] Found ${invalidSources.length} invalid sources:`, 
        invalidSources.map(s => ({ url: s.url.substring(0, 50) + '...', title: s.title })));
    }
    
    // Only use valid sources - if no valid sources, return empty array rather than invalid ones
    const finalResolvedSources = validSources.map(({ url, title }) => ({ url, title }));
    
    console.log(`[RESEARCH_LOGIC] Resolved and validated sources: ${validSources.length} valid, ${invalidSources.length} invalid`);
    
    // Log the final valid sources
    if (finalResolvedSources.length > 0) {
      console.log(`[RESEARCH_LOGIC] Final valid sources:`, 
        finalResolvedSources.map(s => ({ title: s.title, url: s.url })));
    } else {
      console.warn(`[RESEARCH_LOGIC] No valid sources found after resolution and validation`);
    }

    // Filter sources to remove excluded domains
    const filteredSources = domainsToExclude.length === 0 
      ? finalResolvedSources 
      : finalResolvedSources.filter(source => {
          try {
            const url = new URL(source.url);
            const domain = url.hostname;
            const isExcluded = domainsToExclude.some(excludedDomain => 
              domain.toLowerCase().includes(excludedDomain.toLowerCase())
            );
            
            if (isExcluded) {
              console.log(`[DOMAIN_FILTER] Filtered out source: ${source.url} (domain: ${domain})`);
            }
            
            return !isExcluded;
          } catch (error) {
            // If URL parsing fails, keep the source (don't filter invalid URLs)
            console.warn(`[DOMAIN_FILTER] Could not parse URL for filtering: ${source.url}`, error);
            return true;
          }
        });

    // Filter research text to remove any URLs from excluded domains
    let filteredText = text;
    if (domainsToExclude.length > 0) {
      // Regular expression to find URLs in text
      const urlRegex = /https?:\/\/[^\s<>"{}|\\^`[\]]+/g;
      
      const matches = text.match(urlRegex);
      
      if (matches) {
        let filteredCount = 0;
        
        matches.forEach(url => {
          try {
            const urlObj = new URL(url);
            const domain = urlObj.hostname;
            
            if (domainsToExclude.some(excludedDomain => 
              domain.toLowerCase().includes(excludedDomain.toLowerCase())
            )) {
              // Remove the URL from the text
              filteredText = filteredText.replace(url, '');
              filteredCount++;
              console.log(`[DOMAIN_FILTER] Removed URL from text: ${url} (domain: ${domain})`);
            }
          } catch (error) {
            // If URL parsing fails, leave it as is
            console.warn(`[DOMAIN_FILTER] Could not parse URL in text: ${url}`, error);
          }
        });
        
        if (filteredCount > 0) {
          console.log(`[DOMAIN_FILTER] Filtered out ${filteredCount} URLs from text content`);
          // Clean up any double spaces or line breaks left by URL removal
          filteredText = filteredText.replace(/\s+/g, ' ').trim();
        }
      }
    }

    // Extract YouTube videos from filtered sources
    const videos = filteredSources
      .filter(
        (source: { url: string; title?: string }) =>
          source.url.includes("youtube.com") ?? source.url.includes("youtu.be"),
      )
      .map((video: { url: string; title?: string }) => ({
        title: video.title ?? "YouTube Video",
        url: video.url,
      }))
      .slice(0, 3); // Limit to top 3 videos for AI selection

    console.log(
      "[RESEARCH_LOGIC] Sources processed:",
      `${finalResolvedSources.length} total, ${filteredSources.length} after filtering, ${videos.length} videos found`,
    );

    const result: ResearchResponse = {
      researchData: filteredText,
      sources: filteredSources,
      videos,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("Research endpoint error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Failed to conduct research";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}