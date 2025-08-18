import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { performImageSelectionLogic } from '@/lib/services/image-selection-service';

// Types colocated with this API route
export interface ArticleImageSelectionRequest {
  articleId: number;
  generationId: number;
  title: string;
  keywords: string[];
  orientation?: 'landscape' | 'portrait' | 'squarish';
  userId?: string; // Optional for backward compatibility
  projectId?: number; // Optional for backward compatibility
}

export interface ArticleImageSelectionResponse {
  success: boolean;
  data: {
    coverImageUrl: string;       // URL for article.coverImageUrl
    coverImageAlt?: string;      // For article.coverImageAlt
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

    console.log('[ARTICLE_IMAGE_SELECTION] Using image selection service');

    // Use the service directly, providing defaults for missing fields
    const result = await performImageSelectionLogic({
      ...body,
      userId: body.userId ?? "unknown", // Service needs userId but this route doesn't always have it
      projectId: body.projectId ?? 0, // Service needs projectId but this route doesn't always have it
    });

    console.log('[ARTICLE_IMAGE_SELECTION] Service completed successfully');
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('[ARTICLE_IMAGE_SELECTION] Error:', error);
    return NextResponse.json(
      { error: 'Failed to select image for article' },
      { status: 500 }
    );
  }
}
