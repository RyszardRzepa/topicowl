import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { searchForImages, type ImageSearchRequest } from '@/lib/services/image-selection-service';

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

    // Use the extracted service instead of inline logic
    const result = await searchForImages(
      body.query,
      body.keywords ?? [],
      {
        orientation: body.orientation,
        color: body.color,
        contentFilter: body.contentFilter,
        count: body.count,
        excludeIds: body.excludeIds,
        aiEnhance: body.aiEnhance
      }
    );
    
    console.log('[IMAGE_SEARCH_API] Search completed successfully');
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('[IMAGE_SEARCH_API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to search images' },
      { status: 500 }
    );
  }
}
