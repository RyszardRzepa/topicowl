import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { ApiResponse } from '@/types/types';
import { updateProgress } from '@/lib/progress-tracker';
import { generateArticleContent } from '@/lib/article-generation';

// Types colocated with this API route
export interface ArticleGenerationRequest {
  articleId: string;
  forceRegenerate?: boolean;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    console.log('Generate API called for article ID:', id);
    
    if (!id || isNaN(parseInt(id))) {
      console.error('Invalid article ID received:', id);
      return NextResponse.json(
        { success: false, error: "Invalid article ID" } as ApiResponse,
        { status: 400 }
      );
    }

    // Initialize progress tracking
    updateProgress(id, 'pending', 0, 'Initializing generation');

    console.log('Starting background generation process for article:', id);
    // Start generation process (runs in background)
    generateArticleContent(id).catch(error => {
      console.error('Background generation failed:', error);
    });

    console.log('Returning success response for article:', id);
    return NextResponse.json({ 
      success: true,
      data: {
        message: "Article generation started",
        articleId: id,
      },
    } as ApiResponse);

  } catch (error) {
    console.error('Generate article error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to start article generation' 
      } as ApiResponse,
      { status: 500 }
    );
  }
}