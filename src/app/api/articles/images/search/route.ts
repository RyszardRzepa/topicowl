import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { env } from '@/env';

// Types colocated with this API route
export interface ImageSearchRequest {
  query: string;                    // Primary search term (article title/topic)
  keywords?: string[];              // Additional keywords for refined search
  orientation?: 'landscape' | 'portrait' | 'squarish';
  color?: 'black_and_white' | 'black' | 'white' | 'yellow' | 'orange' | 'red' | 'purple' | 'magenta' | 'green' | 'teal' | 'blue';
  contentFilter?: 'low' | 'high';  // Content safety level
  count?: number;                   // Number of images to return (1-30)
  excludeIds?: string[];            // Image IDs to exclude from results
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
  };
  metadata: {
    searchTerms: string[];
    processingTime: number;
    apiCallsUsed: number;
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
    
    // Build search parameters
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
    
    console.log('[IMAGE_SEARCH_API] Starting primary search with query:', body.query);
    
    // Primary search
    let searchResult = await fetchUnsplashSearch(body.query, searchParams);
    apiCallsUsed++;
    
    let images = searchResult.results;
    console.log('[IMAGE_SEARCH_API] Primary search returned', images.length, 'results');
    
    // Enhanced search if needed
    if (images.length < 5 && body.keywords?.length) {
      console.log('[IMAGE_SEARCH_API] Enhancing search with keywords:', body.keywords);
      // Try keyword-enhanced search
      const enhancedQuery = [body.query, ...body.keywords].join(' ');
      const enhancedResponse = await fetchUnsplashSearch(enhancedQuery, searchParams);
      apiCallsUsed++;
      
      if (enhancedResponse.results.length > images.length) {
        images = enhancedResponse.results;
        searchResult = enhancedResponse;
        console.log('[IMAGE_SEARCH_API] Enhanced search returned', images.length, 'results');
      }
    }
    
    // Filter excluded images
    if (body.excludeIds?.length) {
      images = images.filter(img => !body.excludeIds!.includes(img.id));
      console.log('[IMAGE_SEARCH_API] Filtered excluded images, remaining:', images.length);
    }
    
    // Process and rank images
    const searchTerms = [body.query, ...(body.keywords ?? [])];
    const processedImages = images
      .map(img => ({
        ...transformUnsplashImage(img),
        relevanceScore: calculateRelevanceScore(img, searchTerms)
      }))
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, body.count ?? 10);
    
    console.log('[IMAGE_SEARCH_API] Processed and ranked', processedImages.length, 'images');
    
    // Select best image
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
        attribution
      },
      metadata: {
        searchTerms,
        processingTime,
        apiCallsUsed
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
