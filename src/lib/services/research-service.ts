/**
 * Research service for article generation
 * Extracted from the research API route to allow direct function calls
 */

import { google } from "@ai-sdk/google";
import { generateText, generateObject } from "ai";
import { prompts } from "@/prompts";
import { MODELS } from "@/constants";
import { z } from "zod";

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

// Helper function to extract sources from grounding metadata
function extractSourcesFromGroundingMetadata(
  chunks: GroundingChunk[],
  supports: GroundingSupport[],
): Array<{ sourceType: string; url: string; title?: string }> {
  if (chunks.length === 0 || supports.length === 0) {
    return [];
  }

  const idx = new Set<number>();
  for (const s of supports) {
    (s.groundingChunkIndices ?? []).forEach((i: number) => idx.add(i));
  }

  return [...idx]
    .map((i) => chunks[i]?.web)
    .filter(Boolean)
    .map((w) => ({
      sourceType: "web",
      url: w!.uri,
      title: w!.title,
    }));
}

// Helper function to extract sources from text
function extractSourcesFromText(
  text: string,
): Array<{ sourceType: string; url: string; title?: string }> {
  // Look for Google Vertex AI search redirect URLs in the text
  const vertexUrlRegex =
    /https:\/\/vertexaisearch\.cloud\.google\.com\/grounding-api-redirect\/[^\s<>"{}|\\^`[\]]+/g;
  const vertexUrls = text.match(vertexUrlRegex);

  if (vertexUrls) {
    const uniqueVertexUrls = [...new Set(vertexUrls)];
    console.log(
      `[RESEARCH_LOGIC] Extracted ${uniqueVertexUrls.length} Vertex AI redirect URLs from text`,
    );
    return uniqueVertexUrls.map((url) => ({
      sourceType: "web",
      url,
      title: undefined,
    }));
  }

  // Fallback: extract any URLs from the text
  const urlMatches = text.match(/https?:\/\/[^\s<>"{}|\\^`[\]]+/g);
  if (urlMatches) {
    const uniqueUrls = [...new Set(urlMatches)];
    console.log(
      `[RESEARCH_LOGIC] Extracted ${uniqueUrls.length} URLs as fallback sources`,
    );
    return uniqueUrls.map((url) => ({
      sourceType: "web",
      url,
      title: undefined,
    }));
  }

  return [];
}

// Helper function to resolve and validate sources
async function resolveAndValidateSources(
  sources: Array<{ sourceType: string; url: string; title?: string }>,
): Promise<Array<{ url: string; title?: string; isValid: boolean }>> {
  const resolvedSources = await Promise.allSettled(
    sources.map(async (source) => {
      let resolvedUrl = source.url;
      let resolvedTitle = source.title;
      let isValid = false;

      // Check if it's a Google redirect URL and resolve it
      if (
        source.url.includes(
          "vertexaisearch.cloud.google.com/grounding-api-redirect/",
        )
      ) {
        try {
          console.log(
            `[RESEARCH_API] Resolving Vertex AI redirect: ${source.url.substring(0, 80)}...`,
          );

          const response = await fetch(source.url, {
            method: "HEAD",
            redirect: "manual",
            headers: {
              "User-Agent": "ContentBot Research/1.0",
            },
            signal: AbortSignal.timeout(5000),
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
                "User-Agent": "ContentBot Research/1.0",
              },
              signal: AbortSignal.timeout(5000),
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
              resolvedTitle = urlObj.hostname.replace(/^www\./, "");
              console.log(
                `[RESEARCH_API] Set title to domain: ${resolvedTitle}`,
              );
            } catch (error) {
              console.warn(
                `[RESEARCH_API] Could not extract domain from ${resolvedUrl}:`,
                error,
              );
              resolvedTitle = "Unknown Source";
            }
          }
        } catch (error) {
          console.error(
            `[RESEARCH_API] Failed to resolve redirect URL: ${source.url.substring(0, 80)}...`,
            error,
          );
          return {
            url: source.url,
            title: "Invalid Source",
            isValid: false,
          };
        }
      }

      // Validate the final URL
      if (
        resolvedUrl !== source.url ||
        !source.url.includes("vertexaisearch.cloud.google.com")
      ) {
        try {
          const validationResponse = await fetch(resolvedUrl, {
            method: "HEAD",
            headers: {
              "User-Agent": "ContentBot Research/1.0",
            },
            signal: AbortSignal.timeout(5000),
          });

          isValid = validationResponse.ok || validationResponse.status === 405;

          if (!isValid) {
            console.warn(
              `[RESEARCH_API] Source returned status ${validationResponse.status}: ${resolvedUrl}`,
            );
          } else {
            console.log(
              `[RESEARCH_API] Validated source: ${resolvedUrl} (${validationResponse.status})`,
            );
          }
        } catch (error) {
          console.error(
            `[RESEARCH_API] Failed to validate source: ${resolvedUrl}`,
            error,
          );
          isValid = false;
        }
      } else {
        isValid = false;
      }

      return {
        url: resolvedUrl,
        title: resolvedTitle,
        isValid,
      };
    }),
  );

  return resolvedSources
    .filter((result) => result.status === "fulfilled")
    .map(
      (result) =>
        (
          result as PromiseFulfilledResult<{
            url: string;
            title?: string;
            isValid: boolean;
          }>
        ).value,
    );
}

// Helper function to filter text content
function filterTextContent(text: string, excludedDomains: string[]): string {
  let filteredText = text;

  // Always remove vertexaisearch.cloud.google.com URLs from text
  const vertexUrlRegex =
    /https:\/\/vertexaisearch\.cloud\.google\.com\/grounding-api-redirect\/[^\s<>"{}|\\^`[\]]+/g;
  const vertexMatches = filteredText.match(vertexUrlRegex);

  if (vertexMatches) {
    vertexMatches.forEach((url) => {
      filteredText = filteredText.replace(url, "");
      console.log(
        `[TEXT_FILTER] Removed Vertex AI URL from text: ${url.substring(0, 80)}...`,
      );
    });
    console.log(
      `[TEXT_FILTER] Removed ${vertexMatches.length} Vertex AI redirect URLs from text`,
    );
  }

  // Filter out URLs from excluded domains
  if (excludedDomains.length > 0) {
    const urlRegex = /https?:\/\/[^\s<>"{}|\\^`[\]]+/g;
    const matches = filteredText.match(urlRegex);

    if (matches) {
      let filteredCount = 0;

      matches.forEach((url) => {
        try {
          const urlObj = new URL(url);
          const domain = urlObj.hostname;

          if (
            excludedDomains.some((excludedDomain) =>
              domain.toLowerCase().includes(excludedDomain.toLowerCase()),
            )
          ) {
            filteredText = filteredText.replace(url, "");
            filteredCount++;
            console.log(
              `[DOMAIN_FILTER] Removed URL from text: ${url} (domain: ${domain})`,
            );
          }
        } catch (error) {
          console.warn(
            `[DOMAIN_FILTER] Could not parse URL in text: ${url}`,
            error,
          );
        }
      });

      if (filteredCount > 0) {
        console.log(
          `[DOMAIN_FILTER] Filtered out ${filteredCount} URLs from text content`,
        );
      }
    }
  }

  // Clean up any double spaces or line breaks left by URL removal
  return filteredText.replace(/\s+/g, " ").trim();
}

// Helper function to extract YouTube video ID from URL
function extractYouTubeVideoId(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const host = urlObj.hostname.replace(/^www\./, "");
    const path = urlObj.pathname;

    let videoId: string | null = null;

    if (host.includes("youtube.com")) {
      if (path === "/watch") {
        videoId = urlObj.searchParams.get("v");
      } else if (path.startsWith("/embed/")) {
        videoId =
          path.split("/embed/")[1]?.split("/")[0]?.split("?")[0] ?? null;
      } else if (path.startsWith("/shorts/")) {
        videoId =
          path.split("/shorts/")[1]?.split("/")[0]?.split("?")[0] ?? null;
      } else if (path.startsWith("/live/")) {
        // live URLs sometimes look like /live/VIDEOID?feature=share
        videoId = path.split("/live/")[1]?.split("/")[0]?.split("?")[0] ?? null;
      }
    } else if (host.includes("youtu.be")) {
      videoId = path.slice(1).split("/")[0]?.split("?")[0] ?? null;
    }

    if (!videoId) {
      return null;
    }

    // YouTube video IDs are 11 chars base64url-like
    const idPattern = /^[A-Za-z0-9_-]{11}$/;
    if (!idPattern.test(videoId)) {
      return null;
    }
    return videoId;
  } catch (error) {
    console.error(
      `[YOUTUBE_VALIDATION] Failed to parse YouTube URL: ${url}`,
      error,
    );
    return null;
  }
}

// Helper function to validate YouTube video exists and is accessible
async function validateYouTubeVideo(
  url: string,
): Promise<{ isValid: boolean; title?: string; error?: string }> {
  try {
    const videoId = extractYouTubeVideoId(url);
    if (!videoId) {
      return { isValid: false, error: "Invalid YouTube URL format" };
    }
    const canonicalUrl = `https://www.youtube.com/watch?v=${videoId}`;
    console.log(
      `[YOUTUBE_VALIDATION] (oEmbed only) Validating video ID: ${videoId}`,
    );
    const resp = await fetch(
      `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(canonicalUrl)}`,
      {
        method: "GET",
        headers: { "User-Agent": "Mozilla/5.0 (compatible; ContentBot/1.0)" },
        signal: AbortSignal.timeout(6000),
      },
    );
    if (resp.ok) {
      const data = (await resp.json()) as { title?: string };
      return { isValid: true, title: data.title?.trim() ?? "YouTube Video" };
    }
    if (resp.status === 400) {
      return { isValid: false, error: "Invalid video ID (400)" };
    }
    if (resp.status === 404) {
      return { isValid: false, error: "Video not found (404)" };
    }
    if (resp.status === 401 || resp.status === 403) {
      return {
        isValid: false,
        error: `Video access restricted (${resp.status})`,
      };
    }
    return { isValid: false, error: `oEmbed HTTP ${resp.status}` };
  } catch (error) {
    console.error(
      `[YOUTUBE_VALIDATION] Error validating YouTube video via oEmbed: ${url}`,
      error,
    );
    if (error instanceof Error) {
      if (error.name === "AbortError") {
        return { isValid: false, error: "Validation timeout" };
      }
      if (error.message.toLowerCase().includes("fetch")) {
        return { isValid: false, error: "Network error during validation" };
      }
    }
    return { isValid: false, error: "Unknown validation error" };
  }
}

// Helper function to search and validate YouTube videos
async function searchAndValidateYouTubeVideos(
  title: string,
): Promise<{ title: string; url: string; reason: string } | null> {
  try {
    console.log("[YOUTUBE_SEARCH] Starting YouTube video search for:", title);
    // Retry generateText ONLY if no sources are returned (max 3 attempts)
    const maxAttempts = 3;
    let attempt = 1;
    let youtubeSearchResult = await generateText({
      model: google(MODELS.GEMINI_2_5_FLASH),
      providerOptions: {
        google: {
          thinkingConfig: {
            thinkingBudget: 0,
          },
        },
      },
      tools: {
        googleSearch: google.tools.googleSearch({}),
      },
      system:
        "Search the web for YouTube links. Return only valid YouTube links.",
      prompt: `Search the web for youtube links about topic: ${title}. Return only valid youtube links.`,
    });
    while (
      (youtubeSearchResult.sources ?? []).length === 0 &&
      attempt < maxAttempts
    ) {
      attempt++;
      console.log(
        `[YOUTUBE_SEARCH] No sources returned, retrying attempt ${attempt}/${maxAttempts}`,
      );
      youtubeSearchResult = await generateText({
        model: google(MODELS.GEMINI_2_5_FLASH),
        providerOptions: {
          google: {
            thinkingConfig: {
              thinkingBudget: 0,
            },
          },
        },
        tools: {
          googleSearch: google.tools.googleSearch({}),
        },
        system:
          "Search the web for YouTube links. Return only valid YouTube links.",
        prompt: `Search the web for youtube links about topic: ${title}. Return only valid youtube links.`,
      });
    }
    const youtubeSearchSources = (youtubeSearchResult.sources ?? []) as Array<{
      sourceType: string;
      url: string;
      title?: string;
    }>;

    if (youtubeSearchSources.length === 0) {
      console.log(
        `[YOUTUBE_SEARCH] No sources returned after ${attempt} attempt(s); returning null (no fallback extraction)`,
      );
      return null;
    }

    console.log(
      `[YOUTUBE_SEARCH] Received ${youtubeSearchSources.length} sources after ${attempt} attempt(s)`,
    );

    const uniqueUrls = [
      ...new Set(youtubeSearchSources.map((s) => s.url).filter(Boolean)),
    ];
    console.log(
      `[YOUTUBE_SEARCH] Found ${uniqueUrls.length} unique URLs to resolve`,
    );

    // Resolve URLs and filter for YouTube videos
    const resolvedYoutubeUrls = await Promise.allSettled(
      uniqueUrls.map(async (url) => {
        let resolvedUrl = url;

        // Check if it's a Google redirect URL and resolve it
        if (
          url.includes(
            "vertexaisearch.cloud.google.com/grounding-api-redirect/",
          )
        ) {
          try {
            console.log(
              `[YOUTUBE_SEARCH] Resolving redirect: ${url.substring(0, 80)}...`,
            );

            const response = await fetch(url, {
              method: "HEAD",
              redirect: "manual",
              headers: {
                "User-Agent": "ContentBot Research/1.0",
              },
              signal: AbortSignal.timeout(5000),
            });

            const location = response.headers.get("location");
            if (location) {
              resolvedUrl = location;
              console.log(`[YOUTUBE_SEARCH] Resolved to: ${resolvedUrl}`);
            } else {
              // Try GET request
              const getResponse = await fetch(url, {
                redirect: "manual",
                headers: {
                  "User-Agent": "ContentBot Research/1.0",
                },
                signal: AbortSignal.timeout(5000),
              });

              const getLocation = getResponse.headers.get("location");
              if (getLocation) {
                resolvedUrl = getLocation;
                console.log(
                  `[YOUTUBE_SEARCH] Resolved via GET to: ${resolvedUrl}`,
                );
              }
            }
          } catch (error) {
            console.error(
              `[YOUTUBE_SEARCH] Failed to resolve redirect: ${url.substring(0, 80)}...`,
              error,
            );
            return null;
          }
        }

        // Check if the resolved URL is a YouTube URL
        const isYouTube =
          resolvedUrl.includes("youtube.com") ||
          resolvedUrl.includes("youtu.be");
        return isYouTube ? resolvedUrl : null;
      }),
    );

    const youtubeUrls = resolvedYoutubeUrls
      .filter(
        (result) => result.status === "fulfilled" && result.value !== null,
      )
      .map((result) => (result as PromiseFulfilledResult<string | null>).value!)
      .filter(Boolean);

    const uniqueYoutubeUrls = [...new Set(youtubeUrls)];
    console.log(
      `[YOUTUBE_SEARCH] Found ${uniqueYoutubeUrls.length} unique YouTube URLs after resolution`,
    );

    if (uniqueYoutubeUrls.length === 0) {
      console.log("[YOUTUBE_SEARCH] No YouTube URLs found after resolution");
      return null;
    }

    // Enhanced YouTube URL validation
    console.log(
      `[YOUTUBE_SEARCH] Validating ${uniqueYoutubeUrls.length} YouTube URLs with enhanced validation`,
    );

    const validatedYoutubeUrls = await Promise.allSettled(
      uniqueYoutubeUrls.map(async (url) => {
        const validation = await validateYouTubeVideo(url);

        if (validation.isValid) {
          console.log(`[YOUTUBE_SEARCH] ✅ Validated YouTube URL: ${url}`, {
            title: validation.title,
          });
          return { url, title: validation.title };
        } else {
          console.warn(
            `[YOUTUBE_SEARCH] ❌ Invalid YouTube URL: ${url} - ${validation.error}`,
          );
          return null;
        }
      }),
    );

    const validYoutubeUrls = validatedYoutubeUrls
      .filter(
        (result) => result.status === "fulfilled" && result.value !== null,
      )
      .map(
        (result) =>
          (
            result as PromiseFulfilledResult<{
              url: string;
              title?: string;
            } | null>
          ).value!,
      )
      .filter(Boolean);

    console.log(
      `[YOUTUBE_SEARCH] ${validYoutubeUrls.length} valid YouTube URLs after enhanced validation`,
    );

    if (validYoutubeUrls.length === 0) {
      console.log(
        "[YOUTUBE_SEARCH] No valid YouTube URLs found after enhanced validation",
      );
      return null;
    }

    // Use AI to select the best YouTube video from validated URLs
    const videoSelectionSchema = z.object({
      selectedVideo: z.object({
        title: z.string().describe("The title of the selected YouTube video"),
        url: z.string().describe("The URL of the selected YouTube video"),
        reason: z
          .string()
          .describe(
            "Brief explanation of why this video was selected as the best match for the article topic",
          ),
      }),
    });

    const urlsForSelection = validYoutubeUrls
      .map(
        (item, index) =>
          `${index + 1}. ${item.url}${item.title ? ` (Title: ${item.title})` : ""}`,
      )
      .join("\n");

    const selectionResult = await generateObject({
      model: google(MODELS.GEMINI_2_5_FLASH),
      schema: videoSelectionSchema,
      prompt: `From the following validated and accessible YouTube URLs, select the ONE best video that is most relevant to the article topic "${title}".
          YouTube URLs found (all verified as accessible):
          ${urlsForSelection}

          Original search context:
          ${youtubeSearchResult.text}

          Select the most relevant video and provide a title, URL, and brief reason for your selection. The URL must be exactly one of the URLs listed above.`,
      maxOutputTokens: 20000,
    });

    // Verify the selected URL is in our validated list
    const selectedUrl = selectionResult.object.selectedVideo.url;
    const isValidSelection = validYoutubeUrls.some(
      (item) => item.url === selectedUrl,
    );

    if (!isValidSelection) {
      console.warn(
        `[YOUTUBE_SEARCH] AI selected invalid URL: ${selectedUrl}, using first valid URL instead`,
      );
      const fallbackVideo = {
        title: validYoutubeUrls[0]!.title ?? "YouTube Video",
        url: validYoutubeUrls[0]!.url,
        reason: "Selected as the first available valid video for the topic",
      };
      console.log("[YOUTUBE_SEARCH] Using fallback video:", fallbackVideo);
      return fallbackVideo;
    }

    console.log(
      "[YOUTUBE_SEARCH] Selected video:",
      selectionResult.object.selectedVideo,
    );
    return selectionResult.object.selectedVideo;
  } catch (error) {
    console.error("[YOUTUBE_SEARCH] Error during YouTube search:", error);
    return null;
  }
}

/**
 * Core research function that can be called directly without HTTP
 * Extracted from /api/articles/research/route.ts
 */
export async function performResearchDirect(
  request: ResearchRequest,
): Promise<ResearchResponse> {
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

  console.log(
    `[RESEARCH_SERVICE] Starting research for "${title}" with ${keywords.length} keywords`,
  );
  if (domainsToExclude.length > 0) {
    console.log(
      `[RESEARCH_SERVICE] Excluding ${domainsToExclude.length} domains: ${domainsToExclude.join(", ")}`,
    );
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
        system: `Ensure the intent is current and based on real-time latest top results. Today is ${new Date().toISOString()}`,
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
        console.log(
          "[RESEARCH_SERVICE] Sources empty, checking grounding metadata and text",
        );

        const meta = result.providerMetadata?.google?.groundingMetadata as
          | GroundingMetadata
          | undefined;
        const chunks = meta?.groundingChunks ?? [];
        const supports = meta?.groundingSupports ?? [];

        // First try grounding metadata
        const derivedSources = extractSourcesFromGroundingMetadata(
          chunks,
          supports,
        );
        if (derivedSources.length > 0) {
          console.log(
            `[RESEARCH_SERVICE] Derived ${derivedSources.length} sources from grounding metadata`,
          );
          resultSources = derivedSources;
        } else {
          // If still no sources, try to extract from text
          console.log(
            "[RESEARCH_SERVICE] Attempting to extract sources from response text",
          );
          resultSources = extractSourcesFromText(text);
        }
      }

      sources = resultSources;

      console.log(
        `[RESEARCH_SERVICE] Attempt ${attempt} - sources count:`,
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
      console.error("[RESEARCH_SERVICE] No sources found after all attempts");
      throw new Error(
        "Failed to find any sources for research after multiple attempts",
      );
    }

    console.log("[RESEARCH_SERVICE] Final sources:", sources);

    // Resolve Google redirect URLs and validate source availability
    const processedSources = await resolveAndValidateSources(sources);

    // Separate valid and invalid sources
    const validSources = processedSources.filter((source) => source.isValid);
    const invalidSources = processedSources.filter((source) => !source.isValid);

    if (invalidSources.length > 0) {
      console.warn(
        `[RESEARCH_SERVICE] Found ${invalidSources.length} invalid sources:`,
        invalidSources.map((s) => ({
          url: s.url.substring(0, 50) + "...",
          title: s.title,
        })),
      );
    }

    // Only use valid sources - if no valid sources, return empty array rather than invalid ones
    const finalResolvedSources = validSources.map(({ url, title }) => ({
      url,
      title,
    }));

    console.log(
      `[RESEARCH_SERVICE] Resolved and validated sources: ${validSources.length} valid, ${invalidSources.length} invalid`,
    );

    // Log the final valid sources
    if (finalResolvedSources.length > 0) {
      console.log(
        `[RESEARCH_SERVICE] Final valid sources:`,
        finalResolvedSources.map((s) => ({ title: s.title, url: s.url })),
      );
    } else {
      console.warn(
        `[RESEARCH_SERVICE] No valid sources found after resolution and validation`,
      );
    }

    // Filter sources to remove excluded domains
    const filteredSources =
      domainsToExclude.length === 0
        ? finalResolvedSources
        : finalResolvedSources.filter((source) => {
            try {
              const url = new URL(source.url);
              const domain = url.hostname;
              const isExcluded = domainsToExclude.some((excludedDomain) =>
                domain.toLowerCase().includes(excludedDomain.toLowerCase()),
              );

              if (isExcluded) {
                console.log(
                  `[RESEARCH_SERVICE] Filtered out source: ${source.url} (domain: ${domain})`,
                );
              }

              return !isExcluded;
            } catch (error) {
              // If URL parsing fails, keep the source (don't filter invalid URLs)
              console.warn(
                `[RESEARCH_SERVICE] Could not parse URL for filtering: ${source.url}`,
                error,
              );
              return true;
            }
          });

    // Filter research text to remove vertex AI URLs and excluded domains
    const filteredText = filterTextContent(text, domainsToExclude);

    // Search for YouTube videos specifically for the article title
    const selectedVideo = await searchAndValidateYouTubeVideos(title);

    console.log(
      "[RESEARCH_SERVICE] Sources processed:",
      `${finalResolvedSources.length} total, ${filteredSources.length} after filtering, video search: ${selectedVideo ? "found" : "none"}`,
    );

    const result: ResearchResponse = {
      researchData: filteredText,
      sources: filteredSources,
      videos: selectedVideo ? [selectedVideo] : [],
    };

    console.log(`[RESEARCH_SERVICE] Research completed successfully`, {
      researchDataLength: result.researchData.length,
      sourcesCount: result.sources.length,
      videosCount: result.videos?.length ?? 0,
    });

    return result;
  } catch (error) {
    console.error(`[RESEARCH_SERVICE] Research failed:`, error);
    throw new Error(
      `Research failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}
