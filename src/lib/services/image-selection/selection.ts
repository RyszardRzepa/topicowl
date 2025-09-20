/**
 * Image selection service logic
 */

import { db } from "@/server/db";
import { articles, articleGenerations } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { env } from "@/env";
import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { MODELS } from "@/constants";
import { z } from "zod";
import type { ArticleGenerationArtifacts } from "@/types";
import type {
  ArticleImageSelectionRequest,
  ArticleImageSelectionResponse,
  ImageSearchResponse,
  CombinedImage,
  UnsplashImage,
  PexelsImage,
} from "./types";


// Helper functions for relevance scoring
const calculateTextRelevance = (text: string | null, searchTerms: string[]): number => {
  if (!text) return 0;
  const lowerText = text.toLowerCase();
  let relevance = 0;
  for (const term of searchTerms) {
    const lowerTerm = term.toLowerCase();
    if (lowerText.includes(lowerTerm)) {
      relevance += 1;
      const wordBoundaryRegex = new RegExp(`\\b${lowerTerm}\\b`);
      if (wordBoundaryRegex.test(lowerText)) relevance += 0.5;
    }
  }
  return Math.min(relevance / searchTerms.length, 1);
};

const normalizeMetric = (value: number, threshold: number): number => Math.min(value / threshold, 1);
const calculateAspectRatioScore = (width: number, height: number): number => {
  const aspectRatio = width / height;
  if (aspectRatio >= 1.3 && aspectRatio <= 1.8) return 1;
  if (aspectRatio >= 1.1 && aspectRatio <= 2.0) return 0.8;
  return 0.5;
};
const calculateResolutionScore = (width: number, height: number): number => {
  const pixels = width * height;
  if (pixels >= 2073600) return 1; // 1920x1080
  if (pixels >= 921600) return 0.8; // 1280x720
  if (pixels >= 307200) return 0.6; // 640x480
  return 0.3;
};

const calculateRelevance = (
  image: CombinedImage,
  searchTerms: string[],
): number => {
  let score = 0;
  score += calculateTextRelevance(image.description, searchTerms) * 0.4;
  score += calculateTextRelevance(image.altDescription, searchTerms) * 0.4;
  if (image.likes) score += normalizeMetric(image.likes, 100) * 0.05;
  if (image.downloads) score += normalizeMetric(image.downloads, 1000) * 0.05;
  score += calculateAspectRatioScore(image.width, image.height) * 0.05;
  score += calculateResolutionScore(image.width, image.height) * 0.05;
  return Math.min(score, 1);
};

// Transformation functions
const transformUnsplashImage = (
  image: UnsplashImage,
  relevanceScore: number,
): UnsplashImage => {
  return {
    ...image,
    relevanceScore,
    source: "unsplash",
  };
};

const transformPexelsImage = (
  image: PexelsImage,
  relevanceScore: number,
): PexelsImage => {
  return {
    ...image,
    relevanceScore,
    source: "pexels",
  };
};

// API fetch functions
const unsplashApiUrl = "https://api.unsplash.com";
const pexelsApiUrl = "https://api.pexels.com/v1";

const fetchFromUnsplash = async (
  query: string,
  options: Record<string, unknown>,
): Promise<{
  results: UnsplashImage[];
  total: number;
  total_pages: number;
}> => {
  const response = await fetch(
    `${unsplashApiUrl}/search/photos?${new URLSearchParams({
      query,
      ...options,
    } as Record<string, string>)}`,
    {
      headers: {
        Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}`,
      },
    },
  );
  if (!response.ok) {
    throw new Error(`Unsplash API error: ${response.statusText}`);
  }
  return response.json() as Promise<{
    results: UnsplashImage[];
    total: number;
    total_pages: number;
  }>;
};

const fetchFromPexels = async (
  query: string,
  options: Record<string, unknown>,
): Promise<{ photos: PexelsImage[]; total_results: number }> => {
  const response = await fetch(
    `${pexelsApiUrl}/search?${new URLSearchParams({
      query,
      ...options,
    } as Record<string, string>)}`,
    {
      headers: {
        Authorization: `${process.env.PEXELS_API_KEY}`,
      },
    },
  );
  if (!response.ok) {
    throw new Error(`Pexels API error: ${response.statusText}`);
  }
  return response.json() as Promise<{
    photos: PexelsImage[];
    total_results: number;
  }>;
};

// Zod schemas
const queryRefinementSchema = z.object({
  primaryQuery: z.string(),
  alternatives: z.array(z.string()).default([]),
});

const aiRankingSchema = z.object({
  scores: z.array(z.object({ id: z.string(), score: z.number(), reason: z.string().optional() })),
  bestId: z.string().optional(),
});

export async function searchForImages(
  query: string,
  keywords: string[] = [],
  options: {
    orientation?: "landscape" | "portrait" | "squarish";
    color?: string;
    contentFilter?: "low" | "high";
    count?: number;
    excludeIds?: string[];
    aiEnhance?: boolean;
  } = {},
): Promise<ImageSearchResponse> {
  console.log(
    "[IMAGE_SEARCH_SERVICE] Starting combined image search for query:",
    query,
  );

  if (!query?.trim()) {
    throw new Error("Search query is required");
  }

  const startTime = Date.now();
  let apiCallsUsed = 0;

  const totalCount = options.count ?? 100;
  const unsplashCount = Math.floor(totalCount / 2);
  const pexelsCount = totalCount - unsplashCount;

  const unsplashSearchParams: Record<string, string> = {
    per_page: Math.min(unsplashCount, 30).toString(),
    order_by: "relevant",
    content_filter: options.contentFilter ?? "low",
  };

  const pexelsSearchParams: Record<string, string> = {
    per_page: Math.min(pexelsCount, 80).toString(),
  };

  if (options.orientation) {
    unsplashSearchParams.orientation = options.orientation;
    if (options.orientation !== "squarish") {
      pexelsSearchParams.orientation = options.orientation;
    }
  }
  if (options.color) {
    unsplashSearchParams.color = options.color;
    pexelsSearchParams.color = options.color;
  }

  let aiQueries: string[] = [];
  let effectiveQueries: string[] = [query];
  let aiUsed = false;

  if (options.aiEnhance) {
    try {
      const refinementPrompt = `You are generating optimal photo search queries for an article title.
Return ONLY JSON: {"primaryQuery":"...","alternatives":["...", "..."]}
Instructions:
- Extract any specific place names or proper nouns from the title and KEEP them intact in queries.
- Use 1-3 word visually concrete phrases (nouns/adjectives only).
- Remove filler words (guide, how to, tips, strategy, introduction, ultimate).
- Prefer plural for generic scene subjects (e.g. "museums", "solar panels").
- If title is abstract, choose a concrete visual proxy.
- Each alternative must be distinct (different focus or synonym).

Title: ${query}
Keywords: ${keywords.join(", ")}`;

      const { object: refinementObj } = await generateObject({
        model: google(MODELS.GEMINI_2_5_FLASH),
        prompt: refinementPrompt,
        schema: queryRefinementSchema,
        temperature: 0.2,
      });

      if (refinementObj.primaryQuery.trim()) {
        aiUsed = true;
        aiQueries = [
          refinementObj.primaryQuery.trim(),
          ...refinementObj.alternatives.filter((q) => q?.trim()),
        ];
        const seen = new Set<string>();
        effectiveQueries = [];
        for (const q of aiQueries) {
          const cleaned = q.toLowerCase();
          if (!seen.has(cleaned)) {
            seen.add(cleaned);
            effectiveQueries.push(q);
          }
          if (effectiveQueries.length >= 4) break;
        }
      } else {
        console.log(
          "[IMAGE_SEARCH_SERVICE] AI refinement parse failed, falling back to original query",
        );
      }
    } catch (aiRefineError) {
      console.warn(
        "[IMAGE_SEARCH_SERVICE] AI refinement error, continuing without it:",
        aiRefineError,
      );
    }
  }

  console.log("[IMAGE_SEARCH_SERVICE] Effective queries:", effectiveQueries);

  type SearchResult =
    | {
        source: "unsplash";
        query: string;
        images: UnsplashImage[];
      }
    | {
        source: "pexels";
        query: string;
        images: PexelsImage[];
      }
    | {
        source: "unsplash" | "pexels";
        query: string;
        error: Error;
      };

  const searchPromises: Promise<SearchResult>[] = effectiveQueries.flatMap(
    (q: string) => [
      fetchFromUnsplash(q, unsplashSearchParams)
        .then((res) => ({
          source: "unsplash" as const,
          query: q,
          images: res.results,
        }))
        .catch((error: Error) => ({
          source: "unsplash" as const,
          query: q,
          error,
        })),
      fetchFromPexels(q, pexelsSearchParams)
        .then((res) => ({
          source: "pexels" as const,
          query: q,
          images: res.photos,
        }))
        .catch((error: Error) => ({
          source: "pexels" as const,
          query: q,
          error,
        })),
    ],
  );

  const results = await Promise.all(searchPromises);

  let allTransformedImages: CombinedImage[] = [];
  const searchTerms = [...(keywords ?? []), query];

  results.forEach((result) => {
    if ("images" in result && result.images) {
      if (result.source === "unsplash") {
        result.images.forEach((img) => {
          const relevanceScore = calculateRelevance(img, searchTerms);
          allTransformedImages.push(
            transformUnsplashImage(img, relevanceScore),
          );
        });
      } else if (result.source === "pexels") {
        result.images.forEach((img) => {
          const relevanceScore = calculateRelevance(img, searchTerms);
          allTransformedImages.push(transformPexelsImage(img, relevanceScore));
        });
      }
    }
  });

  allTransformedImages.sort((a, b) => b.relevanceScore - a.relevanceScore);

  if (options.excludeIds?.length) {
    allTransformedImages = allTransformedImages.filter(
      (img) => !options.excludeIds!.includes(String(img.id)),
    );
    console.log(
      "[IMAGE_SEARCH_SERVICE] Filtered excluded images, remaining:",
      allTransformedImages.length,
    );
  }

  let rankingMode: "algorithm" | "hybrid-ai" = "algorithm";
  if (options.aiEnhance && allTransformedImages.length > 1) {
    try {
      const candidateCount = Math.min(12, allTransformedImages.length);
      const candidates = allTransformedImages
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, candidateCount);

      const aiRankingPrompt = `You are selecting the best image for an article.
Article topic: ${query}
Keywords: ${keywords.join(", ")}

Rate each candidate image from 0-100 (higher is better) based on semantic relevance, descriptive clarity, likely usefulness as a blog cover, composition quality implied by description, and general professionalism.
Return ONLY JSON in the structure: {"scores":[{"id":"<id>","score":90,"reason":"short reason"},...],"bestId":"<id>"}
Be concise. If unsure, approximate.

Candidates:\n${candidates.map((c) => `ID:${c.id}\nAlt:${c.altDescription ?? ""}\nDesc:${c.description ?? ""}\nSource:${c.source}\n`).join("\n")}`;

      const { object: ranking } = await generateObject({
        model: google(MODELS.GEMINI_2_5_FLASH),
        prompt: aiRankingPrompt,
        schema: aiRankingSchema,
        temperature: 0.1,
      });

      if (ranking.scores.length) {
        rankingMode = "hybrid-ai";
        const aiScoreMap = new Map<string, number>();
        ranking.scores.forEach((s) => {
          if (typeof s.score === "number")
            aiScoreMap.set(String(s.id), Math.max(0, Math.min(100, s.score)));
        });
        allTransformedImages = allTransformedImages.map((img) => {
          const aiScore = aiScoreMap.get(String(img.id));
          if (aiScore !== undefined) {
            const combined = img.relevanceScore * 0.4 + (aiScore / 100) * 0.6;
            return { ...img, relevanceScore: combined };
          }
          return img;
        });
        console.log("[IMAGE_SEARCH_SERVICE] Applied AI ranking to images");
      }
    } catch (aiRankError) {
      console.warn(
        "[IMAGE_SEARCH_SERVICE] AI ranking error, continuing with algorithmic ranking:",
        aiRankError,
      );
    }
  }

  allTransformedImages = allTransformedImages
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, totalCount);

  const unsplashCount_actual = allTransformedImages.filter(
    (i) => i.source === "unsplash",
  ).length;
  const pexelsCount_actual = allTransformedImages.filter(
    (i) => i.source === "pexels",
  ).length;

  console.log("[IMAGE_SEARCH_SERVICE] Combined results:", {
    unsplash: unsplashCount_actual,
    pexels: pexelsCount_actual,
    total: allTransformedImages.length,
  });

  const selectedImage = allTransformedImages[0];
  const totalResults = allTransformedImages.length;

  let attribution:
    | { photographer: string; sourceUrl: string; downloadUrl: string }
    | undefined = undefined;
  if (selectedImage) {
    try {
      if (selectedImage.source === "unsplash") {
        await fetch(selectedImage.links.downloadLocation, {
          headers: {
            Authorization: `Client-ID ${env.UNSPLASH_ACCESS_KEY}`,
          },
        });
        apiCallsUsed++;
      }

      attribution = {
        photographer: selectedImage.user.name,
        sourceUrl: selectedImage.links.html,
        downloadUrl: selectedImage.links.downloadLocation,
      };
    } catch (downloadError) {
      console.error(
        "[IMAGE_SEARCH_SERVICE] Failed to track attribution:",
        downloadError,
      );
    }
  }

  const processingTime = Date.now() - startTime;
  console.log(
    "[IMAGE_SEARCH_SERVICE] Combined search completed successfully in",
    processingTime,
    "ms",
  );

  return {
    success: true,
    data: {
      images: allTransformedImages,
      selectedImage,
      totalResults,
      searchQuery: query,
      attribution,
      aiQueries: aiQueries.length > 0 ? aiQueries : undefined,
      aiUsed: aiUsed || (options.aiEnhance ?? false),
    },
    metadata: {
      searchTerms: [query, ...keywords],
      processingTime,
      apiCallsUsed,
      ranking: rankingMode,
      sources: {
        unsplash: unsplashCount_actual,
        pexels: pexelsCount_actual,
      },
    },
  };
}

export async function selectImageForArticle(
  request: ArticleImageSelectionRequest,
): Promise<ArticleImageSelectionResponse> {
  console.log("[IMAGE_SELECTION_SERVICE] Starting image selection", {
    articleId: request.articleId,
    generationId: request.generationId,
    title: request.title,
    keywordsCount: request.keywords.length,
  });

  if (!request.articleId || !request.generationId || !request.title?.trim()) {
    throw new Error("Article ID, generation ID, and title are required");
  }

  const generationRecords = await db
    .select()
    .from(articleGenerations)
    .where(eq(articleGenerations.id, request.generationId))
    .limit(1);

  const generationRecord =
    generationRecords.length > 0 ? generationRecords[0] : null;

  if (generationRecord) {
    console.log("[IMAGE_SELECTION_SERVICE] Found generation record");
  } else {
    console.log(
      "[IMAGE_SELECTION_SERVICE] No generation record found, proceeding without it",
    );
  }

  const imageData = await searchForImages(request.title, request.keywords, {
    orientation: request.orientation ?? "landscape",
    contentFilter: "low",
    count: 1,
    aiEnhance: false,
  });

  console.log("[IMAGE_SELECTION_SERVICE] Image search completed");

  if (!imageData.success || !imageData.data.selectedImage) {
    console.log("[IMAGE_SELECTION_SERVICE] No suitable image found");
    throw new Error("No suitable image found");
  }

  const selectedImage: CombinedImage = imageData.data.selectedImage;
  const attribution = imageData.data.attribution;

  if (!attribution) {
    throw new Error("Attribution data missing from image search response");
  }

  console.log(
    "[IMAGE_SELECTION_SERVICE] Selected image:",
    selectedImage.id,
    "from",
    selectedImage.source,
  );

  const legacyAttribution = {
    photographer: attribution.photographer,
    unsplashUrl: attribution.sourceUrl,
    downloadUrl: attribution.downloadUrl,
  };

  const imageAlt =
    selectedImage.altDescription ??
    selectedImage.description ??
    `Photo by ${attribution.photographer}`;

  if (generationRecord) {
    try {
      const [existingArtifacts] = await db
        .select({ artifacts: articleGenerations.artifacts })
        .from(articleGenerations)
        .where(eq(articleGenerations.id, request.generationId))
        .limit(1);

      const artifacts = existingArtifacts?.artifacts;
      const mergedArtifacts: ArticleGenerationArtifacts = {
        ...(artifacts ?? {}),
        coverImage: {
          ...(artifacts?.coverImage ?? {}),
          imageId: String(selectedImage.id),
          imageUrl: selectedImage.urls.regular,
          altText: imageAlt,
          attribution: {
            photographer: attribution.photographer,
            sourceUrl: attribution.sourceUrl,
            downloadUrl: attribution.downloadUrl,
          },
          query: request.title,
          keywords: request.keywords,
        },
      };

      await db
        .update(articleGenerations)
        .set({
          artifacts: mergedArtifacts,
          updatedAt: new Date(),
        })
        .where(eq(articleGenerations.id, request.generationId));

      console.log(
        "[IMAGE_SELECTION_SERVICE] Updated generation record with image data",
      );
    } catch (error) {
      console.warn(
        "[IMAGE_SELECTION_SERVICE] Failed to update generation record:",
        error,
      );
    }
  } else {
    console.log(
      "[IMAGE_SELECTION_SERVICE] Skipping generation record update (no record found)",
    );
  }

  const imageKeywords: string[] = [];
  if (selectedImage.description) {
    const descWords = selectedImage.description
      .toLowerCase()
      .replace(/[^\w\s]/gi, "")
      .split(/\s+/)
      .filter((word) => word.length > 3)
      .slice(0, 5);
    imageKeywords.push(...descWords);
  }
  if (selectedImage.user.name) {
    imageKeywords.push(selectedImage.user.name);
  }
  imageKeywords.push(selectedImage.source);

  await db
    .update(articles)
    .set({
      coverImageUrl: selectedImage.urls.regular,
      coverImageAlt: imageAlt,
      updatedAt: new Date(),
    })
    .where(eq(articles.id, request.articleId));

  console.log("[IMAGE_SELECTION_SERVICE] Updated article with cover image");

  const response: ArticleImageSelectionResponse = {
    success: true,
    data: {
      coverImageUrl: selectedImage.urls.regular,
      coverImageAlt: imageAlt,
      attribution: legacyAttribution,
      unsplashImageId: String(selectedImage.id),
    },
  };

  console.log(
    "[IMAGE_SELECTION_SERVICE] Image selection completed successfully",
  );
  return response;
}
