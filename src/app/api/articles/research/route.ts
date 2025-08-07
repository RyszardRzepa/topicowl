import { google } from "@ai-sdk/google";
import { generateText, generateObject } from "ai";
import { NextResponse } from "next/server";
import { prompts } from "@/prompts";
import { MODELS } from "@/constants";
import { z } from "zod";

// Set maximum duration for AI operations to prevent timeouts
export const maxDuration = 800;

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

    // Handle youtube.com/watch?v= format
    if (
      urlObj.hostname.includes("youtube.com") &&
      urlObj.pathname === "/watch"
    ) {
      return urlObj.searchParams.get("v");
    }

    // Handle youtu.be/ format
    if (urlObj.hostname.includes("youtu.be")) {
      return urlObj.pathname.slice(1); // Remove leading slash
    }

    // Handle youtube.com/embed/ format
    if (
      urlObj.hostname.includes("youtube.com") &&
      urlObj.pathname.startsWith("/embed/")
    ) {
      return urlObj.pathname.split("/embed/")[1]?.split("?")[0] ?? null;
    }

    return null;
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

    console.log(`[YOUTUBE_VALIDATION] Validating video ID: ${videoId}`);

    // Try a GET request to check if video exists and is accessible
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; ContentBot/1.0)",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (response.ok) {
      // Try to extract title from the response
      const html = await response.text();
      // Check for common error indicators in the HTML
      const errorIndicators = [
        "Video unavailable",
        "This video is not available",
        "Private video",
        "Video removed",
        "This video has been removed",
        "This video is private",
        "This video is unavailable",
      ];

      const hasError = errorIndicators.some((indicator) =>
        html.toLowerCase().includes(indicator.toLowerCase()),
      );

      if (hasError) {
        console.warn(
          `[YOUTUBE_VALIDATION] Video ${videoId} exists but is not accessible`,
        );
        return {
          isValid: false,
          error: "Video is private, removed, or unavailable",
        };
      }

      console.log(
        `[YOUTUBE_VALIDATION] Video ${videoId} validated successfully`,
      );
      return { isValid: true, title: "" };
    }

    // Check specific HTTP status codes
    if (response.status === 404) {
      return { isValid: false, error: "Video not found (404)" };
    } else if (response.status === 403) {
      return { isValid: false, error: "Video access forbidden (403)" };
    } else {
      return { isValid: false, error: `HTTP ${response.status}` };
    }
  } catch (error) {
    console.error(
      `[YOUTUBE_VALIDATION] Error validating YouTube video: ${url}`,
      error,
    );

    if (error instanceof Error) {
      if (error.name === "AbortError") {
        return { isValid: false, error: "Validation timeout" };
      } else if (error.message.includes("fetch")) {
        return { isValid: false, error: "Network error during validation" };
      }
    }

    return { isValid: false, error: "Unknown validation error" };
  }
}

// Helper function to search and validate YouTube videos
async function searchAndValidateYouTubeVideos(
  title: string,
): Promise<{ title: string; url: string; reason: string } | undefined> {
  try {
    console.log("[YOUTUBE_SEARCH] Starting YouTube video search for:", title);

    const youtubeSearchResult = await generateText({
      model: google(MODELS.GEMINI_2_5_FLASH),
      tools: {
        googleSearch: google.tools.googleSearch({}),
      },
      system:
        "Search the web for YouTube links. Return only valid YouTube links.",
      prompt: `Search the web for youtube links about topic: ${title}. Return only valid youtube links.`,
    });

    console.log("[YOUTUBE_SEARCH] Search completed, extracting YouTube URLs");

    // Get sources from result.sources first
    let youtubeSearchSources = (youtubeSearchResult.sources ?? []) as Array<{
      sourceType: string;
      url: string;
      title?: string;
    }>;

    // If no sources, try grounding metadata
    if (youtubeSearchSources.length === 0) {
      const meta = youtubeSearchResult.providerMetadata?.google
        ?.groundingMetadata as GroundingMetadata | undefined;
      const chunks = meta?.groundingChunks ?? [];
      const supports = meta?.groundingSupports ?? [];

      if (chunks.length > 0 && supports.length > 0) {
        youtubeSearchSources = extractSourcesFromGroundingMetadata(
          chunks,
          supports,
        );
        console.log(
          `[YOUTUBE_SEARCH] Derived ${youtubeSearchSources.length} sources from grounding metadata`,
        );
      }
    }

    // Extract YouTube URLs from text as fallback
    const youtubeUrlRegex =
      /https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)[\w-]+/g;
    const textYoutubeUrls =
      youtubeSearchResult.text.match(youtubeUrlRegex) ?? [];

    // Also extract any Google redirect URLs that might lead to YouTube
    const vertexUrlRegex =
      /https:\/\/vertexaisearch\.cloud\.google\.com\/grounding-api-redirect\/[^\s<>"{}|\\^`[\]]+/g;
    const vertexUrls = youtubeSearchResult.text.match(vertexUrlRegex) ?? [];

    // Combine all potential URLs
    const allPotentialUrls = [
      ...youtubeSearchSources.map((s) => s.url),
      ...textYoutubeUrls,
      ...vertexUrls,
    ];

    if (allPotentialUrls.length === 0) {
      console.log("[YOUTUBE_SEARCH] No URLs found to process");
      return undefined;
    }

    const uniqueUrls = [...new Set(allPotentialUrls)];
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
      return undefined;
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
      return undefined;
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
    return undefined;
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ResearchRequest;

    const { title, keywords, notes, excludedDomains } = body;

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

      // Fallback to grounding metadata or text extraction when sources is empty
      if (resultSources.length === 0) {
        console.log(
          "[RESEARCH_LOGIC] Sources empty, checking grounding metadata and text",
        );

        const meta = result.providerMetadata?.google?.groundingMetadata as
          | GroundingMetadata
          | undefined;
        const chunks = meta?.groundingChunks ?? [];
        const supports = meta?.groundingSupports ?? [];

        console.log(`[SOURCES!!!]`, result.sources);

        // First try grounding metadata
        const derivedSources = extractSourcesFromGroundingMetadata(
          chunks,
          supports,
        );
        if (derivedSources.length > 0) {
          console.log(
            `[RESEARCH_LOGIC] Derived ${derivedSources.length} sources from grounding metadata`,
          );
          resultSources = derivedSources;
        } else {
          // If still no sources, try to extract from text
          console.log(
            "[RESEARCH_LOGIC] Attempting to extract sources from response text",
          );
          resultSources = extractSourcesFromText(text);
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
    const processedSources = await resolveAndValidateSources(sources);

    // Separate valid and invalid sources
    const validSources = processedSources.filter((source) => source.isValid);
    const invalidSources = processedSources.filter((source) => !source.isValid);

    if (invalidSources.length > 0) {
      console.warn(
        `[RESEARCH_API] Found ${invalidSources.length} invalid sources:`,
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
      `[RESEARCH_LOGIC] Resolved and validated sources: ${validSources.length} valid, ${invalidSources.length} invalid`,
    );

    // Log the final valid sources
    if (finalResolvedSources.length > 0) {
      console.log(
        `[RESEARCH_LOGIC] Final valid sources:`,
        finalResolvedSources.map((s) => ({ title: s.title, url: s.url })),
      );
    } else {
      console.warn(
        `[RESEARCH_LOGIC] No valid sources found after resolution and validation`,
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
                  `[DOMAIN_FILTER] Filtered out source: ${source.url} (domain: ${domain})`,
                );
              }

              return !isExcluded;
            } catch (error) {
              // If URL parsing fails, keep the source (don't filter invalid URLs)
              console.warn(
                `[DOMAIN_FILTER] Could not parse URL for filtering: ${source.url}`,
                error,
              );
              return true;
            }
          });

    // Filter research text to remove vertex AI URLs and excluded domains
    const filteredText = filterTextContent(text, domainsToExclude);

    // Extract YouTube videos from filtered sources
    const videos = filteredSources
      .filter(
        (source: { url: string; title?: string }) =>
          source.url.includes("youtube.com") || source.url.includes("youtu.be"),
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

    // Search for YouTube videos specifically for the article title
    const selectedVideo = await searchAndValidateYouTubeVideos(title);

    const result: ResearchResponse = {
      researchData: filteredText,
      sources: filteredSources,
      videos: selectedVideo ? [selectedVideo] : [],
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("Research endpoint error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Failed to conduct research";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
