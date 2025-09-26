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
  ImageSummary,
  UnsplashApiImage,
  PexelsApiImage,
} from "./types";


type CandidateImage = {
  id: string;
  provider: "unsplash" | "pexels";
  url: string;
  previewUrl: string;
  altText: string | null;
  width: number;
  height: number;
  authorName: string;
  authorProfileUrl?: string;
  downloadLocation?: string;
};

const normalizeUnsplashImage = (image: UnsplashApiImage): CandidateImage => {
  return {
    id: image.id,
    provider: "unsplash",
    url: image.urls.regular,
    previewUrl: image.urls.small,
    altText: image.alt_description ?? image.description,
    width: image.width,
    height: image.height,
    authorName: image.user.name,
    authorProfileUrl: image.user.portfolio_url ?? undefined,
    downloadLocation: image.links.download_location,
  };
};

const normalizePexelsImage = (image: PexelsApiImage): CandidateImage => {
  const displayUrl = image.src.large ?? image.src.medium ?? image.src.original;
  const previewUrl = image.src.small ?? image.src.medium ?? image.src.original;
  return {
    id: String(image.id),
    provider: "pexels",
    url: displayUrl,
    previewUrl,
    altText: image.alt ?? null,
    width: image.width,
    height: image.height,
    authorName: image.photographer,
    authorProfileUrl: image.photographer_url ?? undefined,
  };
};

// API fetch functions
const unsplashApiUrl = "https://api.unsplash.com";
const pexelsApiUrl = "https://api.pexels.com/v1";

const fetchFromUnsplash = async (
  query: string,
  options: Record<string, unknown>,
): Promise<{
  results: UnsplashApiImage[];
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
        Authorization: `Client-ID ${env.UNSPLASH_ACCESS_KEY}`,
      },
    },
  );
  if (!response.ok) {
    throw new Error(`Unsplash API error: ${response.statusText}`);
  }
  return response.json() as Promise<{
    results: UnsplashApiImage[];
    total: number;
    total_pages: number;
  }>;
};

const fetchFromPexels = async (
  query: string,
  options: Record<string, unknown>,
): Promise<{ photos: PexelsApiImage[]; total_results: number }> => {
  const response = await fetch(
    `${pexelsApiUrl}/search?${new URLSearchParams({
      query,
      ...options,
    } as Record<string, string>)}`,
    {
      headers: {
        Authorization: `${env.PEXELS_API_KEY}`,
      },
    },
  );
  if (!response.ok) {
    throw new Error(`Pexels API error: ${response.statusText}`);
  }
  return response.json() as Promise<{
    photos: PexelsApiImage[];
    total_results: number;
  }>;
};

const aiSelectionSchema = z.object({
  bestId: z.string(),
});

export async function searchForImages(
  query: string,
  keywords: string[] = [],
  options: {
    orientation?: "landscape" | "portrait" | "squarish";
    limit?: number;
    aiSelect?: boolean;
  } = {},
): Promise<ImageSearchResponse> {
  console.log(
    "[IMAGE_SEARCH_SERVICE] Starting combined image search for query:",
    query,
  );

  if (!query?.trim()) {
    throw new Error("Search query is required");
  }

  const aiSelect = options.aiSelect ?? true;
  const limit = Math.max(1, options.limit ?? (aiSelect ? 12 : 100));

  const unsplashTarget = aiSelect
    ? Math.min(12, 30)
    : Math.min(Math.ceil(limit / 2), 30);
  const remainingForPexels = Math.max(limit - unsplashTarget, 0);
  const pexelsTarget = aiSelect
    ? Math.min(12, 80)
    : Math.min(remainingForPexels, 80);

  const unsplashParams: Record<string, string> = {
    per_page: Math.max(1, unsplashTarget).toString(),
    order_by: "relevant",
  };

  const pexelsParams: Record<string, string> = {
    per_page: Math.max(1, pexelsTarget).toString(),
  };

  if (options.orientation) {
    unsplashParams.orientation = options.orientation;
    if (options.orientation !== "squarish") {
      pexelsParams.orientation = options.orientation;
    }
  }

  const fetchPromises: Promise<
    | { source: "unsplash"; images: UnsplashApiImage[] }
    | { source: "pexels"; images: PexelsApiImage[] }
  >[] = [];

  if (unsplashTarget > 0) {
    fetchPromises.push(
      fetchFromUnsplash(query, unsplashParams)
        .then((res) => ({ source: "unsplash" as const, images: res.results }))
        .catch((error: Error) => {
          console.warn("[IMAGE_SEARCH_SERVICE] Unsplash search failed", error);
          return { source: "unsplash" as const, images: [] };
        }),
    );
  }

  if (pexelsTarget > 0) {
    fetchPromises.push(
      fetchFromPexels(query, pexelsParams)
        .then((res) => ({ source: "pexels" as const, images: res.photos }))
        .catch((error: Error) => {
          console.warn("[IMAGE_SEARCH_SERVICE] Pexels search failed", error);
          return { source: "pexels" as const, images: [] };
        }),
    );
  }

  const providerResults = await Promise.all(fetchPromises);

  const candidates: CandidateImage[] = [];

  providerResults.forEach((result) => {
    if (result.source === "unsplash") {
      result.images.forEach((image) => {
        candidates.push(normalizeUnsplashImage(image));
      });
    } else {
      result.images.forEach((image) => {
        candidates.push(normalizePexelsImage(image));
      });
    }
  });

  if (!candidates.length) {
    return {
      success: false,
      error: "No images found",
    };
  }

  const createSummary = (candidate: CandidateImage): ImageSummary => {
    const altText = candidate.altText?.trim()
      ? candidate.altText
      : `Photo by ${candidate.authorName}`;
    return {
      id: candidate.id,
      provider: candidate.provider,
      url: candidate.url,
      previewUrl: candidate.previewUrl,
      alt: altText,
      width: candidate.width,
      height: candidate.height,
      author: {
        name: candidate.authorName,
        profileUrl: candidate.authorProfileUrl,
      },
    };
  };

  if (!aiSelect) {
    const summaries = candidates
      .slice(0, limit)
      .map((candidate) => createSummary(candidate));

    return {
      success: true,
      images: summaries,
    };
  }

  const initialCandidate = candidates[0]!;

  const candidatePrompt = candidates
    .slice(0, 12)
    .map((candidate, index) => {
      const fallbackAlt = keywords.join(", ") ?? "";
      return `Candidate ${index + 1}:\nID: ${candidate.id}\nAuthor: ${candidate.authorName}\nAlt: ${candidate.altText ?? fallbackAlt}\nSource: ${candidate.provider}`;
    })
    .join("\n\n");

  const aiPrompt = `You are selecting a single photo that best matches an article topic.
Article title: ${query}
Keywords: ${keywords.join(", ")}

Pick the most relevant and high-quality option from the list.
Return ONLY JSON: {"bestId":"<ID>"}.

${candidatePrompt}`;

  let selected: CandidateImage = initialCandidate;

  try {
    const { object: selection } = await generateObject({
      model: google(MODELS.GEMINI_2_5_FLASH),
      prompt: aiPrompt,
      schema: aiSelectionSchema,
      temperature: 0.1,
    });

    const aiChoice = candidates.find((candidate) => candidate.id === selection.bestId);
    if (aiChoice) {
      selected = aiChoice;
    }
  } catch (aiError) {
    console.warn("[IMAGE_SEARCH_SERVICE] AI selection failed, using first candidate", aiError);
  }

  if (selected.provider === "unsplash" && selected.downloadLocation) {
    try {
      await fetch(selected.downloadLocation, {
        headers: {
          Authorization: `Client-ID ${env.UNSPLASH_ACCESS_KEY}`,
        },
      });
    } catch (downloadError) {
      console.error(
        "[IMAGE_SEARCH_SERVICE] Failed to track Unsplash download",
        downloadError,
      );
    }
  }

  const summaries: ImageSummary[] = candidates.map(createSummary);

  const selectedSummary =
    summaries.find((img) => img.id === selected.id) ?? summaries[0]!;

  let images = summaries.slice(0, limit);
  if (!images.some((img) => img.id === selectedSummary.id)) {
    images = [selectedSummary, ...images].slice(0, limit);
  }

  return {
    success: true,
    images,
    selected: selectedSummary,
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

  const imageResult = await searchForImages(request.title, request.keywords, {
    orientation: request.orientation ?? "landscape",
  });

  console.log("[IMAGE_SELECTION_SERVICE] Image search completed");

  if (!imageResult.success || !imageResult.selected) {
    console.log("[IMAGE_SELECTION_SERVICE] No suitable image found");
    throw new Error("No suitable image found");
  }

  const fallbackImage = imageResult.selected ?? (imageResult.images?.[0] ?? undefined);

  if (!fallbackImage) {
    throw new Error("No suitable image found");
  }

  const imageSummary: ImageSummary = fallbackImage;

  console.log("[IMAGE_SELECTION_SERVICE] Selected image:", imageSummary.url);

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
          imageId: imageSummary.id,
          imageUrl: imageSummary.url,
          altText: imageSummary.alt,
          attribution: imageSummary.author.name
            ? {
                photographer: imageSummary.author.name,
                sourceUrl: imageSummary.author.profileUrl,
              }
            : undefined,
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

  await db
    .update(articles)
    .set({
      coverImageUrl: imageSummary.url,
      coverImageAlt: imageSummary.alt,
      updatedAt: new Date(),
    })
    .where(eq(articles.id, request.articleId));

  console.log("[IMAGE_SELECTION_SERVICE] Updated article with cover image");

  const response: ArticleImageSelectionResponse = {
    success: true,
    data: {
      coverImageUrl: imageSummary.url,
      coverImageAlt: imageSummary.alt,
      width: imageSummary.width,
      height: imageSummary.height,
      author: imageSummary.author,
    },
  };

  console.log(
    "[IMAGE_SELECTION_SERVICE] Image selection completed successfully",
  );
  return response;
}
