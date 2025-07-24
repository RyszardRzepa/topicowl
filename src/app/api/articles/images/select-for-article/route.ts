import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { db } from '@/server/db';
import { articles, articleGeneration } from '@/server/db/schema';
import { eq } from 'drizzle-orm';
import type { ImageSearchResponse, UnsplashImage } from '../search/route';

// Types colocated with this API route
export interface ArticleImageSelectionRequest {
  articleId: number;
  generationId: number;
  title: string;
  keywords: string[];
  orientation?: 'landscape' | 'portrait' | 'squarish';
}

export interface ArticleImageSelectionResponse {
  success: boolean;
  data: {
    featuredImageUrl: string;    // URL for article.featuredImageUrl
    featuredImageAlt?: string;   // For article.featuredImageAlt
    attribution: {
      photographer: string;
      unsplashUrl: string;
      downloadUrl: string;
    };
    unsplashImageId: string;     // For tracking in article_generation
  };
}

export async function POST(request: NextRequest) {
  try {
    console.log('[ARTICLE_IMAGE_SELECTION] POST request received');
    const body = await request.json() as ArticleImageSelectionRequest;
    console.log('[ARTICLE_IMAGE_SELECTION] Request body:', JSON.stringify(body, null, 2));
    
    // Input validation
    if (!body.articleId || !body.generationId || !body.title?.trim()) {
      console.log('[ARTICLE_IMAGE_SELECTION] Missing required fields');
      return NextResponse.json(
        { error: 'Article ID, generation ID, and title are required' },
        { status: 400 }
      );
    }
    
    // Get generation record
    const generationRecords = await db.select()
      .from(articleGeneration)
      .where(eq(articleGeneration.id, body.generationId))
      .limit(1);
    
    if (!generationRecords.length) {
      console.log('[ARTICLE_IMAGE_SELECTION] Generation not found:', body.generationId);
      return NextResponse.json(
        { error: 'Generation not found' },
        { status: 404 }
      );
    }
    
    console.log('[ARTICLE_IMAGE_SELECTION] Found generation record');
    
    // Search for images using the existing search endpoint
    const searchUrl = new URL('/api/articles/images/search', request.url);
    const imageSearchResponse = await fetch(searchUrl.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: body.title,
        keywords: body.keywords,
        orientation: body.orientation ?? 'landscape',
        contentFilter: 'low',
        count: 1
      })
    });
    
    if (!imageSearchResponse.ok) {
      throw new Error(`Image search failed: ${imageSearchResponse.status}`);
    }
    
    const imageData = await imageSearchResponse.json() as ImageSearchResponse;
    console.log('[ARTICLE_IMAGE_SELECTION] Image search completed');
    
    if (!imageData.success || !imageData.data.selectedImage) {
      console.log('[ARTICLE_IMAGE_SELECTION] No suitable image found');
      throw new Error('No suitable image found');
    }
    
    const selectedImage: UnsplashImage = imageData.data.selectedImage;
    const attribution = imageData.data.attribution;
    
    if (!attribution) {
      throw new Error('Attribution data missing from image search response');
    }
    
    console.log('[ARTICLE_IMAGE_SELECTION] Selected image:', selectedImage.id);
    
    // Update generation record with image data
    await db.update(articleGeneration)
      .set({
        selectedImageId: selectedImage.id,
        imageAttribution: attribution,
        imageQuery: body.title,
        imageKeywords: body.keywords,
        updatedAt: new Date()
      })
      .where(eq(articleGeneration.id, body.generationId));
    
    console.log('[ARTICLE_IMAGE_SELECTION] Updated generation record with image data');
    
    // Update article with cover image
    const imageAlt = selectedImage.altDescription ?? 
                    selectedImage.description ?? 
                    `Photo by ${attribution.photographer}`;
    
    await db.update(articles)
      .set({
        featuredImageUrl: selectedImage.urls.regular,
        featuredImageAlt: imageAlt,
        updatedAt: new Date()
      })
      .where(eq(articles.id, body.articleId));
    
    console.log('[ARTICLE_IMAGE_SELECTION] Updated article with featured image');
    
    const response: ArticleImageSelectionResponse = {
      success: true,
      data: {
        featuredImageUrl: selectedImage.urls.regular,
        featuredImageAlt: imageAlt,
        attribution: attribution,
        unsplashImageId: selectedImage.id
      }
    };
    
    console.log('[ARTICLE_IMAGE_SELECTION] Request completed successfully');
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('[ARTICLE_IMAGE_SELECTION] Error:', error);
    return NextResponse.json(
      { error: 'Failed to select image for article' },
      { status: 500 }
    );
  }
}
