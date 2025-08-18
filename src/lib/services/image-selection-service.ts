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
}

export interface ImageSearchResponse {
  success: boolean;
  data: {
    images: UnsplashImage[];
    selectedImage?: UnsplashImage;
    totalResults: number;
    searchQuery: string;
    attribution?: {
      photographer: string;
      unsplashUrl: string;
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
  };
}

export interface ImageAttribution {
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

// Search for images based on article content - extracted from API route
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
  console.log('[IMAGE_SEARCH_SERVICE] Starting image search for query:', query);
  
  if (!query?.trim()) {
    throw new Error('Search query is required');
  }
  
  const startTime = Date.now();
  let apiCallsUsed = 0;
  
  // Build base search parameters
  const searchParams = new URLSearchParams({
    per_page: '30',
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
      const refinementPrompt = `You are generating optimal Unsplash photo search queries for an article title.
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

  // Aggregate search results from queries until we have enough unique images
  let allImages: UnsplashPhoto[] = [];
  let searchResult: UnsplashSearchResult | null = null;
  const maxDesired = Math.min(options.count ?? 10, 30) * 3;
  
  for (const q of effectiveQueries) {
    try {
      console.log('[IMAGE_SEARCH_SERVICE] Searching Unsplash with query:', q);
      const result = await fetchUnsplashSearch(q, searchParams);
      apiCallsUsed++;
      searchResult = searchResult ?? result;
      const existingIds = new Set(allImages.map(i => i.id));
      for (const r of result.results) {
        if (!existingIds.has(r.id)) {
          allImages.push(r);
          existingIds.add(r.id);
        }
      }
      console.log('[IMAGE_SEARCH_SERVICE] Accumulated images:', allImages.length);
      if (allImages.length >= maxDesired) break;
    } catch (searchErr) {
      console.warn('[IMAGE_SEARCH_SERVICE] Query failed:', q, searchErr);
    }
  }

  // Fallback: if nothing retrieved
  if (allImages.length === 0) {
    console.log('[IMAGE_SEARCH_SERVICE] No images found from refined queries, doing fallback single search');
    searchResult = await fetchUnsplashSearch(query, searchParams);
    apiCallsUsed++;
    allImages = searchResult.results;
  }

  let images = allImages;
  searchResult ??= { total: images.length, total_pages: 1, results: images };
  
  // Enhanced search if needed
  if (images.length < 5 && keywords.length && !options.aiEnhance) {
    console.log('[IMAGE_SEARCH_SERVICE] Enhancing search with keywords (non-AI path):', keywords);
    const enhancedQuery = [query, ...keywords].join(' ');
    try {
      const enhancedResponse = await fetchUnsplashSearch(enhancedQuery, searchParams);
      apiCallsUsed++;
      if (enhancedResponse.results.length > images.length) {
        images = enhancedResponse.results;
        searchResult = enhancedResponse;
        console.log('[IMAGE_SEARCH_SERVICE] Enhanced search returned', images.length, 'results');
      }
    } catch (enhErr) {
      console.warn('[IMAGE_SEARCH_SERVICE] Enhanced keyword search failed:', enhancedQuery, enhErr);
    }
  }
  
  // Filter excluded images
  if (options.excludeIds?.length) {
    images = images.filter(img => !options.excludeIds!.includes(img.id));
    console.log('[IMAGE_SEARCH_SERVICE] Filtered excluded images, remaining:', images.length);
  }
  
  // Process and rank images
  const searchTerms = [query, ...keywords];
  let processedImages = images
    .map(img => ({
      ...transformUnsplashImage(img),
      relevanceScore: calculateRelevanceScore(img, searchTerms)
    }));

  // Optional AI ranking (hybrid)
  let rankingMode: 'algorithm' | 'hybrid-ai' = 'algorithm';
  if (options.aiEnhance && processedImages.length > 1) {
    try {
      const candidateCount = Math.min(12, processedImages.length);
      const candidates = processedImages
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, candidateCount);
        
      const aiRankingPrompt = `You are selecting the best Unsplash image for an article.
Article topic: ${query}
Keywords: ${keywords.join(', ')}

Rate each candidate image from 0-100 (higher is better) based on semantic relevance, descriptive clarity, likely usefulness as a blog cover, composition quality implied by description, and general professionalism.
Return ONLY JSON in the structure: {"scores":[{"id":"<id>","score":90,"reason":"short reason"},...],"bestId":"<id>"}
Be concise. If unsure, approximate.

Candidates:\n${candidates.map(c => `ID:${c.id}\nAlt:${c.altDescription ?? ''}\nDesc:${c.description ?? ''}\nLikes:${c.likes}\n`).join('\n')}`;

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
          if (typeof s.score === 'number') aiScoreMap.set(s.id, Math.max(0, Math.min(100, s.score)));
        });
        processedImages = processedImages.map(img => {
          const aiScore = aiScoreMap.get(img.id);
          if (aiScore !== undefined) {
            const combined = (img.relevanceScore * 0.4) + ((aiScore / 100) * 0.6);
            return { ...img, relevanceScore: combined };
          }
          return img;
        });
        console.log('[IMAGE_SEARCH_SERVICE] Applied AI ranking to images');
      } else {
        console.log('[IMAGE_SEARCH_SERVICE] AI ranking parse failed, using algorithmic scores');
      }
    } catch (aiRankError) {
      console.warn('[IMAGE_SEARCH_SERVICE] AI ranking error, continuing with algorithmic ranking:', aiRankError);
    }
  }

  processedImages = processedImages
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, options.count ?? 10);

  console.log('[IMAGE_SEARCH_SERVICE] Processed and ranked', processedImages.length, 'images (mode:', processedImages.length > 0 ? 'success' : 'none', ')');

  const selectedImage = processedImages[0];
  
  // Track download for attribution compliance
  let attribution: { photographer: string; unsplashUrl: string; downloadUrl: string; } | undefined = undefined;
  if (selectedImage) {
    try {
      console.log('[IMAGE_SEARCH_SERVICE] Tracking download for attribution');
      await fetch(selectedImage.links.downloadLocation, {
        headers: {
          'Authorization': `Client-ID ${env.UNSPLASH_ACCESS_KEY}`
        }
      });
      apiCallsUsed++;
      
      attribution = {
        photographer: selectedImage.user.name,
        unsplashUrl: selectedImage.links.html,
        downloadUrl: selectedImage.links.downloadLocation
      };
    } catch (downloadError) {
      console.error('[IMAGE_SEARCH_SERVICE] Failed to track download:', downloadError);
    }
  }
  
  const processingTime = Date.now() - startTime;
  console.log('[IMAGE_SEARCH_SERVICE] Search completed successfully in', processingTime, 'ms');
  
  return {
    success: true,
    data: {
      images: processedImages,
      selectedImage,
      totalResults: searchResult.total,
      searchQuery: query,
      attribution,
      aiQueries: aiQueries.length > 0 ? aiQueries : undefined,
      aiUsed: aiUsed || (options.aiEnhance ?? false)
    },
    metadata: {
      searchTerms,
      processingTime,
      apiCallsUsed,
      ranking: rankingMode
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
  
  // Search for images using the extracted search logic (no HTTP calls!)
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
  
  const selectedImage: UnsplashImage = imageData.data.selectedImage;
  const attribution = imageData.data.attribution;
  
  if (!attribution) {
    throw new Error('Attribution data missing from image search response');
  }
  
  console.log('[IMAGE_SELECTION_SERVICE] Selected image:', selectedImage.id);
  
  // Update generation record with image data (if it exists)
  if (generationRecord) {
    try {
      await db.update(articleGeneration)
        .set({
          selectedImageId: selectedImage.id,
          imageAttribution: attribution,
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
      attribution: attribution,
      unsplashImageId: selectedImage.id
    }
  };
  
  console.log('[IMAGE_SELECTION_SERVICE] Image selection completed successfully');
  return response;
}
