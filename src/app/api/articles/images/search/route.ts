import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { env } from '@/env';
import { google } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { MODELS } from '@/constants';
import { z } from 'zod';

// Types colocated with this API route
export interface ImageSearchRequest {
  query: string;                    // Primary search term (article title/topic)
  keywords?: string[];              // Additional keywords for refined search
  orientation?: 'landscape' | 'portrait' | 'squarish';
  color?: 'black_and_white' | 'black' | 'white' | 'yellow' | 'orange' | 'red' | 'purple' | 'magenta' | 'green' | 'teal' | 'blue';
  contentFilter?: 'low' | 'high';  // Content safety level
  count?: number;                   // Number of images to return (1-30)
  excludeIds?: string[];            // Image IDs to exclude from results
  aiEnhance?: boolean;              // Whether to use AI for query refinement and ranking
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
  downloads?: number; // Not always available in search results
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
  relevanceScore: number; // Calculated by our algorithm
}

export interface ImageSearchResponse {
  success: boolean;
  data: {
    images: UnsplashImage[];
    selectedImage?: UnsplashImage; // Best match if auto-selection is enabled
    totalResults: number;
    searchQuery: string;
    attribution?: {
      photographer: string;
      unsplashUrl: string;
      downloadUrl: string;
    };
  aiQueries?: string[];           // Queries produced by AI refinement
  aiUsed?: boolean;               // Indicates if AI assisted the search
  };
  metadata: {
    searchTerms: string[];
    processingTime: number;
    apiCallsUsed: number;
  ranking: 'algorithm' | 'hybrid-ai';
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

// Helper functions for relevance scoring
const calculateTextRelevance = (text: string | null, searchTerms: string[]): number => {
  if (!text) return 0;
  
  const lowerText = text.toLowerCase();
  let relevance = 0;
  
  for (const term of searchTerms) {
    const lowerTerm = term.toLowerCase();
    if (lowerText.includes(lowerTerm)) {
      // Exact match gets higher score
      relevance += 1;
      // Bonus for word boundaries
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
  // Prefer landscape images (16:9 to 4:3 range)
  if (aspectRatio >= 1.3 && aspectRatio <= 1.8) return 1;
  if (aspectRatio >= 1.1 && aspectRatio <= 2.0) return 0.8;
  return 0.5;
};

const calculateResolutionScore = (width: number, height: number): number => {
  const pixels = width * height;
  // Prefer high resolution (1080p+)
  if (pixels >= 2073600) return 1; // 1920x1080
  if (pixels >= 921600) return 0.8; // 1280x720
  if (pixels >= 307200) return 0.6; // 640x480
  return 0.3;
};

const calculateRelevanceScore = (image: UnsplashPhoto, searchTerms: string[]): number => {
  let score = 0;
  
  // Description/Alt-text relevance (80% weight total)
  score += calculateTextRelevance(image.description, searchTerms) * 0.4;
  score += calculateTextRelevance(image.alt_description, searchTerms) * 0.4;
  
  // Quality metrics (10% weight)
  score += normalizeMetric(image.likes, 100) * 0.05;
  if (image.downloads) {
    score += normalizeMetric(image.downloads, 1000) * 0.05;
  }
  
  // Technical quality (10% weight)
  score += calculateAspectRatioScore(image.width, image.height) * 0.05;
  score += calculateResolutionScore(image.width, image.height) * 0.05;
  
  return Math.min(score, 1); // Cap at 1.0
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

// AI helper result types (kept local, not exported)

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

export async function POST(request: NextRequest) {
  try {
    console.log('[IMAGE_SEARCH_API] POST request received');
    const body = await request.json() as ImageSearchRequest;
    console.log('[IMAGE_SEARCH_API] Request body:', JSON.stringify(body, null, 2));
    
    // Input validation
    if (!body.query?.trim()) {
      console.log('[IMAGE_SEARCH_API] Missing query field');
      return NextResponse.json(
        { error: 'Search query is required' },
        { status: 400 }
      );
    }
    
    const startTime = Date.now();
    let apiCallsUsed = 0;
    
    // Build base search parameters
    const searchParams = new URLSearchParams({
      per_page: '30', // Maximum for best selection
      order_by: 'relevant',
      content_filter: body.contentFilter ?? 'low',
    });
    
    if (body.orientation) {
      searchParams.set('orientation', body.orientation);
    }
    if (body.color) {
      searchParams.set('color', body.color);
    }
    
    let aiQueries: string[] = [];
    let effectiveQueries: string[] = [body.query];
    let aiUsed = false;

  // (Removed deterministic token extraction per request; rely solely on AI refinement when enabled)

    // Optional AI query refinement
    if (body.aiEnhance) {
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

Title: ${body.query}
Keywords: ${(body.keywords ?? []).join(', ')}`;

        const { object: refinementObj } = await generateObject({
          model: google(MODELS.GEMINI_2_5_FLASH),
          prompt: refinementPrompt,
          schema: queryRefinementSchema,
          temperature: 0.2,
        });
        if (refinementObj.primaryQuery.trim()) {
          aiUsed = true;
          aiQueries = [refinementObj.primaryQuery.trim(), ...(refinementObj.alternatives.filter(q => q?.trim()))];
          // Deduplicate and keep reasonable count
          const seen = new Set<string>();
          effectiveQueries = [];
          for (const q of aiQueries) {
            const cleaned = q.toLowerCase();
            if (!seen.has(cleaned)) {
              seen.add(cleaned);
              effectiveQueries.push(q);
            }
            if (effectiveQueries.length >= 4) break; // Cap API usage
          }
        } else {
          console.log('[IMAGE_SEARCH_API] AI refinement parse failed, falling back to original query');
        }
      } catch (aiRefineError) {
        console.warn('[IMAGE_SEARCH_API] AI refinement error, continuing without it:', aiRefineError);
      }
    }

    console.log('[IMAGE_SEARCH_API] Effective queries:', effectiveQueries);

    // Aggregate search results from queries until we have enough unique images
    let allImages: UnsplashPhoto[] = [];
    let searchResult: UnsplashSearchResult | null = null;
    const maxDesired = Math.min(body.count ?? 10, 30) * 3; // Over-fetch for better ranking
    for (const q of effectiveQueries) {
      try {
        console.log('[IMAGE_SEARCH_API] Searching Unsplash with query:', q);
        const result = await fetchUnsplashSearch(q, searchParams);
        apiCallsUsed++;
        searchResult = searchResult ?? result; // Keep first for total count
        // Merge unique by id
        const existingIds = new Set(allImages.map(i => i.id));
        for (const r of result.results) {
          if (!existingIds.has(r.id)) {
            allImages.push(r);
            existingIds.add(r.id);
          }
        }
        console.log('[IMAGE_SEARCH_API] Accumulated images:', allImages.length);
        if (allImages.length >= maxDesired) break;
      } catch (searchErr) {
        console.warn('[IMAGE_SEARCH_API] Query failed:', q, searchErr);
      }
    }

    // Fallback: if nothing retrieved
    if (allImages.length === 0) {
      console.log('[IMAGE_SEARCH_API] No images found from refined queries, doing fallback single search');
      searchResult = await fetchUnsplashSearch(body.query, searchParams);
      apiCallsUsed++;
      allImages = searchResult.results;
    }

    let images = allImages;
  searchResult ??= { total: images.length, total_pages: 1, results: images };
    
    // Enhanced search if needed
    if (images.length < 5 && body.keywords?.length && !body.aiEnhance) {
      console.log('[IMAGE_SEARCH_API] Enhancing search with keywords (non-AI path):', body.keywords);
      const enhancedQuery = [body.query, ...body.keywords].join(' ');
      try {
        const enhancedResponse = await fetchUnsplashSearch(enhancedQuery, searchParams);
        apiCallsUsed++;
        if (enhancedResponse.results.length > images.length) {
          images = enhancedResponse.results;
          searchResult = enhancedResponse;
          console.log('[IMAGE_SEARCH_API] Enhanced search returned', images.length, 'results');
        }
      } catch (enhErr) {
        console.warn('[IMAGE_SEARCH_API] Enhanced keyword search failed:', enhancedQuery, enhErr);
      }
    }
    
    // Filter excluded images
    if (body.excludeIds?.length) {
      images = images.filter(img => !body.excludeIds!.includes(img.id));
      console.log('[IMAGE_SEARCH_API] Filtered excluded images, remaining:', images.length);
    }
    
    // Process and rank images
    const searchTerms = [body.query, ...(body.keywords ?? [])];
    // Baseline algorithmic scoring
    let processedImages = images
      .map(img => ({
        ...transformUnsplashImage(img),
        relevanceScore: calculateRelevanceScore(img, searchTerms)
      }));

    // Optional AI ranking (hybrid)
    let rankingMode: 'algorithm' | 'hybrid-ai' = 'algorithm';
    if (body.aiEnhance && processedImages.length > 1) {
      try {
        // Take top N by baseline to reduce token usage
        const candidateCount = Math.min(12, processedImages.length);
        const candidates = processedImages
          .sort((a, b) => b.relevanceScore - a.relevanceScore)
          .slice(0, candidateCount);
        const aiRankingPrompt = `You are selecting the best Unsplash image for an article.
Article topic: ${body.query}
Keywords: ${(body.keywords ?? []).join(', ')}

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
          // Combine scores (normalize AI 0-100 to 0-1)
          processedImages = processedImages.map(img => {
            const aiScore = aiScoreMap.get(img.id);
            if (aiScore !== undefined) {
              const combined = (img.relevanceScore * 0.4) + ((aiScore / 100) * 0.6);
              return { ...img, relevanceScore: combined };
            }
            return img;
          });
          console.log('[IMAGE_SEARCH_API] Applied AI ranking to images');
        } else {
          console.log('[IMAGE_SEARCH_API] AI ranking parse failed, using algorithmic scores');
        }
      } catch (aiRankError) {
        console.warn('[IMAGE_SEARCH_API] AI ranking error, continuing with algorithmic ranking:', aiRankError);
      }
    }

    processedImages = processedImages
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, body.count ?? 10);

    console.log('[IMAGE_SEARCH_API] Processed and ranked', processedImages.length, 'images (mode:', processedImages.length > 0 ? 'success' : 'none', ')');

    const selectedImage = processedImages[0];
    
    // Track download for attribution compliance
    let attribution = null;
    if (selectedImage) {
      try {
        console.log('[IMAGE_SEARCH_API] Tracking download for attribution');
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
        console.error('[IMAGE_SEARCH_API] Failed to track download:', downloadError);
        // Continue without tracking - non-critical error
      }
    }
    
    const processingTime = Date.now() - startTime;
    console.log('[IMAGE_SEARCH_API] Search completed successfully in', processingTime, 'ms');
    
    return NextResponse.json({
      success: true,
      data: {
        images: processedImages,
        selectedImage,
        totalResults: searchResult.total,
        searchQuery: body.query,
        attribution,
        aiQueries: aiQueries.length > 0 ? aiQueries : undefined,
        aiUsed: aiUsed || (body.aiEnhance ?? false)
      },
      metadata: {
        searchTerms,
        processingTime,
        apiCallsUsed,
        ranking: rankingMode
      }
    } as ImageSearchResponse);
    
  } catch (error) {
    console.error('[IMAGE_SEARCH_API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to search images' },
      { status: 500 }
    );
  }
}
