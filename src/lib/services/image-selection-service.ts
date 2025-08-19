/**
 * Image selection service for article generation
 * Extracted from the image selection API route to allow direct function calls
 */

import { db } from '@/server/db';
import { articles, articleGeneration } from '@/server/db/schema';
import { eq } from 'drizzle-orm';
import { env } from '@/env';
import { google } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { MODELS } from '@/constants';
import { z } from 'zod';
import { createClient } from 'pexels';

// Types for image search - extracted from API route
export interface ImageSearchRequest {
  query: string;                    
  keywords?: string[];              
  orientation?: 'landscape' | 'portrait' | 'squarish';
  color?: 'black_and_white' | 'black' | 'white' | 'yellow' | 'orange' | 'red' | 'purple' | 'magenta' | 'green' | 'teal' | 'blue';
  contentFilter?: 'low' | 'high';  
  count?: number;                   
  excludeIds?: string[];            
  aiEnhance?: boolean;              
}

export interface UnsplashImage {
  id: string;
  description: string | null;
  altDescription: string | null;
  urls: {
    raw: string;
    full: string;
    regular: string;
    small: string;
    thumb: string;
  };
  width: number;
  height: number;
  color: string;
  blurHash: string;
  likes: number;
  downloads?: number;
  user: {
    id: string;
    username: string;
    name: string;
    portfolioUrl: string | null;
    profileImage: {
      small: string;
      medium: string;
      large: string;
    };
  };
  links: {
    self: string;
    html: string;
    download: string;
    downloadLocation: string;
  };
  relevanceScore: number;
  source: 'unsplash';
}

export interface PexelsImage {
  id: number;
  description: string | null;
  altDescription: string | null;
  urls: {
    raw: string;
    full: string;
    regular: string;
    small: string;
    thumb: string;
  };
  width: number;
  height: number;
  color: string;
  blurHash?: string;
  likes?: number;
  downloads?: number;
  user: {
    id: number;
    username: string;
    name: string;
    portfolioUrl: string | null;
    profileImage: {
      small: string;
      medium: string;
      large: string;
    };
  };
  links: {
    self: string;
    html: string;
    download: string;
    downloadLocation: string;
  };
  relevanceScore: number;
  source: 'pexels';
}

export type CombinedImage = UnsplashImage | PexelsImage;

export interface ImageSearchResponse {
  success: boolean;
  data: {
    images: CombinedImage[];
    selectedImage?: CombinedImage;
    totalResults: number;
    searchQuery: string;
    attribution?: {
      photographer: string;
      sourceUrl: string;
      downloadUrl: string;
    };
    aiQueries?: string[];           
    aiUsed?: boolean;               
  };
  metadata: {
    searchTerms: string[];
    processingTime: number;
    apiCallsUsed: number;
    ranking: 'algorithm' | 'hybrid-ai';
    sources: {
      unsplash: number;
      pexels: number;
    };
  };
}

export interface ImageAttribution {
  photographer: string;
  sourceUrl: string; // This will be used for both unsplashUrl and pexels url
  downloadUrl: string;
  source?: 'unsplash' | 'pexels'; // Optional field to identify the source
}

// Legacy interface for backward compatibility
export interface UnsplashAttribution {
  photographer: string;
  unsplashUrl: string;
  downloadUrl: string;
}

export interface ArticleImageSelectionRequest {
  articleId: number;
  generationId: number;
  title: string;
  keywords: string[];
  orientation?: 'landscape' | 'portrait' | 'squarish';
  userId: string;
  projectId: number;
}

export interface ArticleImageSelectionResponse {
  success: boolean;
  data: {
    coverImageUrl: string;       
    coverImageAlt?: string;      
    attribution: {
      photographer: string;
      unsplashUrl: string;
      downloadUrl: string;
    };
    unsplashImageId: string;     
  };
}

interface UnsplashPhoto {
  id: string;
  description: string | null;
  alt_description: string | null;
  urls: {
    raw: string;
    full: string;
    regular: string;
    small: string;
    thumb: string;
  };
  width: number;
  height: number;
  color: string;
  blur_hash: string;
  likes: number;
  downloads?: number;
  user: {
    id: string;
    username: string;
    name: string;
    portfolio_url: string | null;
    profile_image: {
      small: string;
      medium: string;
      large: string;
    };
    total_photos?: number;
    total_likes?: number;
  };
  links: {
    self: string;
    html: string;
    download: string;
    download_location: string;
  };
}

interface UnsplashSearchResult {
  total: number;
  total_pages: number;
  results: UnsplashPhoto[];
}

// Pexels API types
interface PexelsPhoto {
  id: number;
  width: number;
  height: number;
  url: string;
  photographer: string;
  photographer_url: string;
  photographer_id: number;
  avg_color: string;
  src: {
    original: string;
    large2x: string;
    large: string;
    medium: string;
    small: string;
    portrait: string;
    landscape: string;
    tiny: string;
  };
  liked: boolean;
  alt: string;
}

interface PexelsSearchResult {
  total_results: number;
  page: number;
  per_page: number;
  photos: PexelsPhoto[];
  next_page?: string;
  prev_page?: string;
}

// Helper functions for relevance scoring - extracted from API route
const calculateTextRelevance = (text: string | null, searchTerms: string[]): number => {
  if (!text) return 0;
  
  const lowerText = text.toLowerCase();
  let relevance = 0;
  
  for (const term of searchTerms) {
    const lowerTerm = term.toLowerCase();
    if (lowerText.includes(lowerTerm)) {
      relevance += 1;
      const wordBoundaryRegex = new RegExp(`\\b${lowerTerm}\\b`);
      if (wordBoundaryRegex.test(lowerText)) {
        relevance += 0.5;
      }
    }
  }
  
  return Math.min(relevance / searchTerms.length, 1);
};

const normalizeMetric = (value: number, threshold: number): number => {
  return Math.min(value / threshold, 1);
};

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

const calculateRelevanceScore = (image: UnsplashPhoto, searchTerms: string[]): number => {
  let score = 0;
  
  score += calculateTextRelevance(image.description, searchTerms) * 0.4;
  score += calculateTextRelevance(image.alt_description, searchTerms) * 0.4;
  
  score += normalizeMetric(image.likes, 100) * 0.05;
  if (image.downloads) {
    score += normalizeMetric(image.downloads, 1000) * 0.05;
  }
  
  score += calculateAspectRatioScore(image.width, image.height) * 0.05;
  score += calculateResolutionScore(image.width, image.height) * 0.05;
  
  return Math.min(score, 1);
};

const transformUnsplashImage = (photo: UnsplashPhoto): Omit<UnsplashImage, 'relevanceScore'> => ({
  id: photo.id,
  description: photo.description,
  altDescription: photo.alt_description,
  urls: photo.urls,
  width: photo.width,
  height: photo.height,
  color: photo.color,
  blurHash: photo.blur_hash,
  likes: photo.likes,
  downloads: photo.downloads,
  user: {
    id: photo.user.id,
    username: photo.user.username,
    name: photo.user.name,
    portfolioUrl: photo.user.portfolio_url,
    profileImage: photo.user.profile_image,
  },
  links: {
    self: photo.links.self,
    html: photo.links.html,
    download: photo.links.download,
    downloadLocation: photo.links.download_location,
  },
  source: 'unsplash'
});

const transformPexelsImage = (photo: PexelsPhoto): Omit<PexelsImage, 'relevanceScore'> => ({
  id: photo.id,
  description: null, // Pexels doesn't provide descriptions
  altDescription: photo.alt,
  urls: {
    raw: photo.src.original,
    full: photo.src.large2x,
    regular: photo.src.large,
    small: photo.src.medium,
    thumb: photo.src.tiny,
  },
  width: photo.width,
  height: photo.height,
  color: photo.avg_color,
  blurHash: undefined,
  likes: undefined, // Pexels doesn't provide likes count
  downloads: undefined, // Pexels doesn't provide download count
  user: {
    id: photo.photographer_id,
    username: photo.photographer.toLowerCase().replace(/\s+/g, ''),
    name: photo.photographer,
    portfolioUrl: photo.photographer_url,
    profileImage: {
      small: '',
      medium: '',
      large: '',
    },
  },
  links: {
    self: `https://www.pexels.com/photo/${photo.id}/`,
    html: photo.url,
    download: photo.src.original,
    downloadLocation: photo.src.original,
  },
  source: 'pexels'
});

const fetchUnsplashSearch = async (query: string, baseParams: URLSearchParams): Promise<UnsplashSearchResult> => {
  const searchParams = new URLSearchParams(baseParams);
  searchParams.set('query', query);
  
  const response = await fetch(
    `https://api.unsplash.com/search/photos?${searchParams}`,
    {
      headers: {
        'Authorization': `Client-ID ${env.UNSPLASH_ACCESS_KEY}`,
        'Accept-Version': 'v1'
      }
    }
  );
  
  if (!response.ok) {
    throw new Error(`Unsplash API error: ${response.status}`);
  }
  
  return response.json() as Promise<UnsplashSearchResult>;
};

const fetchPexelsSearch = async (query: string, count: number) => {
  const client = createClient(env.PEXELS_API_KEY);
  
  try {
    const response = await client.photos.search({
      query,
      per_page: Math.min(count, 80), // Pexels max is 80
      page: 1,
    });
    
    return response;
  } catch (error) {
    throw new Error(`Pexels API error: ${String(error)}`);
  }
};

// Zod schemas for AI structured outputs
const queryRefinementSchema = z.object({
  primaryQuery: z.string(),
  alternatives: z.array(z.string()).default([])
});

const aiRankingSchema = z.object({
  scores: z.array(z.object({
    id: z.string(),
    score: z.number(),
    reason: z.string().optional()
  })),
  bestId: z.string().optional()
});

// Search for images based on article content - now searches both Unsplash and Pexels
export async function searchForImages(
  query: string, 
  keywords: string[] = [],
  options: {
    orientation?: 'landscape' | 'portrait' | 'squarish';
    color?: string;
    contentFilter?: 'low' | 'high';
    count?: number;
    excludeIds?: string[];
    aiEnhance?: boolean;
  } = {}
): Promise<ImageSearchResponse> {
  console.log('[IMAGE_SEARCH_SERVICE] Starting combined image search for query:', query);
  
  if (!query?.trim()) {
    throw new Error('Search query is required');
  }
  
  const startTime = Date.now();
  let apiCallsUsed = 0;
  
  const totalCount = options.count ?? 100;
  const unsplashCount = Math.floor(totalCount / 2); // 50 images from Unsplash
  const pexelsCount = totalCount - unsplashCount; // 50 images from Pexels
  
  // Build base search parameters for Unsplash
  const searchParams = new URLSearchParams({
    per_page: Math.min(unsplashCount, 30).toString(),
    order_by: 'relevant',
    content_filter: options.contentFilter ?? 'low',
  });
  
  if (options.orientation) {
    searchParams.set('orientation', options.orientation);
  }
  if (options.color) {
    searchParams.set('color', options.color);
  }
  
  let aiQueries: string[] = [];
  let effectiveQueries: string[] = [query];
  let aiUsed = false;

  // Optional AI query refinement
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
Keywords: ${keywords.join(', ')}`;

      const { object: refinementObj } = await generateObject({
        model: google(MODELS.GEMINI_2_5_FLASH),
        prompt: refinementPrompt,
        schema: queryRefinementSchema,
        temperature: 0.2,
      });
      
      if (refinementObj.primaryQuery.trim()) {
        aiUsed = true;
        aiQueries = [refinementObj.primaryQuery.trim(), ...(refinementObj.alternatives.filter(q => q?.trim()))];
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
        console.log('[IMAGE_SEARCH_SERVICE] AI refinement parse failed, falling back to original query');
      }
    } catch (aiRefineError) {
      console.warn('[IMAGE_SEARCH_SERVICE] AI refinement error, continuing without it:', aiRefineError);
    }
  }

  console.log('[IMAGE_SEARCH_SERVICE] Effective queries:', effectiveQueries);

  // Search both Unsplash and Pexels concurrently
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const searchPromises: Promise<{ source: string; query: string; result?: any; error?: any }>[] = [];
  
  // Search Unsplash
  for (const q of effectiveQueries.slice(0, 2)) { // Limit Unsplash searches to avoid rate limits
    searchPromises.push(
      fetchUnsplashSearch(q, searchParams)
        .then(result => ({ source: 'unsplash', query: q, result }))
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        .catch(error => ({ source: 'unsplash', query: q, error }))
    );
  }
  
  // Search Pexels
  for (const q of effectiveQueries.slice(0, 2)) { // Limit Pexels searches
    searchPromises.push(
      fetchPexelsSearch(q, Math.min(pexelsCount, 40))
        .then(result => ({ source: 'pexels', query: q, result }))
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        .catch(error => ({ source: 'pexels', query: q, error }))
    );
  }

  const searchResults = await Promise.allSettled(searchPromises);
  
  // Process results
  const allUnsplashImages: UnsplashPhoto[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allPexelsImages: any[] = [];
  let totalResults = 0;
  let unsplashCount_actual = 0;
  let pexelsCount_actual = 0;
  
  for (const result of searchResults) {
    if (result.status === 'fulfilled' && result.value && !result.value.error) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
      const { source, result: searchResult } = result.value as any;
      apiCallsUsed++;
      
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (source === 'unsplash' && searchResult?.results) {
        const existingIds = new Set(allUnsplashImages.map(i => i.id));
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
        for (const img of searchResult.results as any[]) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument
          if (!existingIds.has(img.id)) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            allUnsplashImages.push(img);
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument
            existingIds.add(img.id);
            unsplashCount_actual++;
          }
        }
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        totalResults += searchResult.total;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      } else if (source === 'pexels' && searchResult?.photos) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access
        const existingIds = new Set(allPexelsImages.map(i => i.id));
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
        for (const img of searchResult.photos as any[]) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          if (!existingIds.has(img.id)) {
            allPexelsImages.push(img);
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            existingIds.add(img.id);
            pexelsCount_actual++;
          }
        }
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        totalResults += searchResult.total_results ?? 0;
      }
    } else {
      console.warn('[IMAGE_SEARCH_SERVICE] Search failed:', result);
    }
  }
  
  // Transform and combine images
  let allTransformedImages: CombinedImage[] = [];
  
  // Transform Unsplash images
  const unsplashTransformed = allUnsplashImages.slice(0, unsplashCount).map(img => ({
    ...transformUnsplashImage(img),
    relevanceScore: calculateRelevanceScore(img, [query, ...keywords])
  }));
  allTransformedImages.push(...unsplashTransformed);
  
  // Transform Pexels images
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pexelsTransformed = allPexelsImages.slice(0, pexelsCount).map((img: any) => ({
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    ...transformPexelsImage(img),
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument
    relevanceScore: calculateTextRelevance(img.alt ?? '', [query, ...keywords]) * 0.8 + 0.2 // Simple relevance for Pexels
  }));
  allTransformedImages.push(...pexelsTransformed);
  
  // Filter excluded images
  if (options.excludeIds?.length) {
    allTransformedImages = allTransformedImages.filter(img => 
      !options.excludeIds!.includes(String(img.id))
    );
    console.log('[IMAGE_SEARCH_SERVICE] Filtered excluded images, remaining:', allTransformedImages.length);
  }
  
  // Optional AI ranking (hybrid)
  let rankingMode: 'algorithm' | 'hybrid-ai' = 'algorithm';
  if (options.aiEnhance && allTransformedImages.length > 1) {
    try {
      const candidateCount = Math.min(12, allTransformedImages.length);
      const candidates = allTransformedImages
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, candidateCount);
        
      const aiRankingPrompt = `You are selecting the best image for an article.
Article topic: ${query}
Keywords: ${keywords.join(', ')}

Rate each candidate image from 0-100 (higher is better) based on semantic relevance, descriptive clarity, likely usefulness as a blog cover, composition quality implied by description, and general professionalism.
Return ONLY JSON in the structure: {"scores":[{"id":"<id>","score":90,"reason":"short reason"},...],"bestId":"<id>"}
Be concise. If unsure, approximate.

Candidates:\n${candidates.map(c => `ID:${c.id}\nAlt:${c.altDescription ?? ''}\nDesc:${c.description ?? ''}\nSource:${c.source}\n`).join('\n')}`;

      const { object: ranking } = await generateObject({
        model: google(MODELS.GEMINI_2_5_FLASH),
        prompt: aiRankingPrompt,
        schema: aiRankingSchema,
        temperature: 0.1,
      });
      
      if (ranking.scores.length) {
        rankingMode = 'hybrid-ai';
        const aiScoreMap = new Map<string, number>();
        ranking.scores.forEach(s => {
          if (typeof s.score === 'number') aiScoreMap.set(String(s.id), Math.max(0, Math.min(100, s.score)));
        });
        allTransformedImages = allTransformedImages.map(img => {
          const aiScore = aiScoreMap.get(String(img.id));
          if (aiScore !== undefined) {
            const combined = (img.relevanceScore * 0.4) + ((aiScore / 100) * 0.6);
            return { ...img, relevanceScore: combined };
          }
          return img;
        });
        console.log('[IMAGE_SEARCH_SERVICE] Applied AI ranking to images');
      }
    } catch (aiRankError) {
      console.warn('[IMAGE_SEARCH_SERVICE] AI ranking error, continuing with algorithmic ranking:', aiRankError);
    }
  }

  // Sort and limit results
  allTransformedImages = allTransformedImages
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, totalCount);

  console.log('[IMAGE_SEARCH_SERVICE] Combined results:', {
    unsplash: unsplashCount_actual,
    pexels: pexelsCount_actual,
    total: allTransformedImages.length
  });

  const selectedImage = allTransformedImages[0];
  
  // Track attribution
  let attribution: { photographer: string; sourceUrl: string; downloadUrl: string; } | undefined = undefined;
  if (selectedImage) {
    try {
      if (selectedImage.source === 'unsplash') {
        // Track download for Unsplash attribution compliance
        await fetch(selectedImage.links.downloadLocation, {
          headers: {
            'Authorization': `Client-ID ${env.UNSPLASH_ACCESS_KEY}`
          }
        });
        apiCallsUsed++;
      }
      
      attribution = {
        photographer: selectedImage.user.name,
        sourceUrl: selectedImage.links.html,
        downloadUrl: selectedImage.links.downloadLocation
      };
    } catch (downloadError) {
      console.error('[IMAGE_SEARCH_SERVICE] Failed to track attribution:', downloadError);
    }
  }
  
  const processingTime = Date.now() - startTime;
  console.log('[IMAGE_SEARCH_SERVICE] Combined search completed successfully in', processingTime, 'ms');
  
  return {
    success: true,
    data: {
      images: allTransformedImages,
      selectedImage,
      totalResults,
      searchQuery: query,
      attribution,
      aiQueries: aiQueries.length > 0 ? aiQueries : undefined,
      aiUsed: aiUsed || (options.aiEnhance ?? false)
    },
    metadata: {
      searchTerms: [query, ...keywords],
      processingTime,
      apiCallsUsed,
      ranking: rankingMode,
      sources: {
        unsplash: unsplashCount_actual,
        pexels: pexelsCount_actual,
      }
    }
  };
}

/**
 * Core image selection function that can be called directly without HTTP
 * Extracted from /api/articles/images/select-for-article/route.ts
 */
export async function performImageSelectionLogic(request: ArticleImageSelectionRequest): Promise<ArticleImageSelectionResponse> {
  console.log('[IMAGE_SELECTION_SERVICE] Starting image selection', {
    articleId: request.articleId,
    generationId: request.generationId,
    title: request.title,
    keywordsCount: request.keywords.length,
  });
  
  // Input validation
  if (!request.articleId || !request.generationId || !request.title?.trim()) {
    throw new Error('Article ID, generation ID, and title are required');
  }
  
  // Get generation record (optional - may not exist for articles without user_id)
  const generationRecords = await db.select()
    .from(articleGeneration)
    .where(eq(articleGeneration.id, request.generationId))
    .limit(1);
  
  const generationRecord = generationRecords.length > 0 ? generationRecords[0] : null;
  
  if (generationRecord) {
    console.log('[IMAGE_SELECTION_SERVICE] Found generation record');
  } else {
    console.log('[IMAGE_SELECTION_SERVICE] No generation record found, proceeding without it');
  }
  
  // Search for images using the combined search logic 
  const imageData = await searchForImages(
    request.title,
    request.keywords,
    {
      orientation: request.orientation ?? 'landscape',
      contentFilter: 'low',
      count: 1,
      aiEnhance: false
    }
  );
  
  console.log('[IMAGE_SELECTION_SERVICE] Image search completed');
  
  if (!imageData.success || !imageData.data.selectedImage) {
    console.log('[IMAGE_SELECTION_SERVICE] No suitable image found');
    throw new Error('No suitable image found');
  }
  
  const selectedImage: CombinedImage = imageData.data.selectedImage;
  const attribution = imageData.data.attribution;
  
  if (!attribution) {
    throw new Error('Attribution data missing from image search response');
  }
  
  console.log('[IMAGE_SELECTION_SERVICE] Selected image:', selectedImage.id, 'from', selectedImage.source);
  
  // Create backward-compatible attribution for database storage
  const legacyAttribution: UnsplashAttribution = {
    photographer: attribution.photographer,
    unsplashUrl: attribution.sourceUrl, // Store the source URL as unsplashUrl for compatibility
    downloadUrl: attribution.downloadUrl
  };
  
  // Update generation record with image data (if it exists)
  if (generationRecord) {
    try {
      await db.update(articleGeneration)
        .set({
          selectedImageId: String(selectedImage.id), // Convert to string for consistency
          imageAttribution: legacyAttribution,
          imageQuery: request.title,
          imageKeywords: request.keywords,
          updatedAt: new Date()
        })
        .where(eq(articleGeneration.id, request.generationId));
      
      console.log('[IMAGE_SELECTION_SERVICE] Updated generation record with image data');
    } catch (error) {
      console.warn('[IMAGE_SELECTION_SERVICE] Failed to update generation record:', error);
    }
  } else {
    console.log('[IMAGE_SELECTION_SERVICE] Skipping generation record update (no record found)');
  }
  
  // Update article with cover image
  const imageAlt = selectedImage.altDescription ?? 
                  selectedImage.description ?? 
                  `Photo by ${attribution.photographer}`;
                  
  
  // Generate keywords from image metadata
  const imageKeywords: string[] = [];
  if (selectedImage.description) {
    // Extract potential keywords from description (simple word extraction)
    const descWords = selectedImage.description
      .toLowerCase()
      .replace(/[^\w\s]/gi, '')
      .split(/\s+/)
      .filter(word => word.length > 3) // Filter out short words
      .slice(0, 5); // Limit to first 5 meaningful words
    imageKeywords.push(...descWords);
  }
  // Add photographer name as a keyword
  if (selectedImage.user.name) {
    imageKeywords.push(selectedImage.user.name);
  }
  // Add source as keyword
  imageKeywords.push(selectedImage.source);
  
  await db.update(articles)
    .set({
      coverImageUrl: selectedImage.urls.regular,
      coverImageAlt: imageAlt,
      updatedAt: new Date()
    })
    .where(eq(articles.id, request.articleId));
  
  console.log('[IMAGE_SELECTION_SERVICE] Updated article with cover image');
  
  const response: ArticleImageSelectionResponse = {
    success: true,
    data: {
      coverImageUrl: selectedImage.urls.regular,
      coverImageAlt: imageAlt,
      attribution: legacyAttribution, // Use legacy format for backward compatibility
      unsplashImageId: String(selectedImage.id) // Convert to string for consistency
    }
  };
  
  console.log('[IMAGE_SELECTION_SERVICE] Image selection completed successfully');
  return response;
}
