import { NextRequest, NextResponse } from "next/server";
import { articleGenerationService } from "@/lib/services/article-generation-service";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const articleId = parseInt(id);
    
    if (!articleId || isNaN(articleId)) {
      return NextResponse.json(
        { error: "Invalid article ID" },
        { status: 400 }
      );
    }

    // Start generation process (runs in background)
    const generationPromise = articleGenerationService.generateArticle(articleId);
    
    // Don't await - let it run in background
    generationPromise.catch(error => {
      console.error('Background generation failed:', error);
    });

    return NextResponse.json({ 
      message: "Article generation started",
      articleId 
    });

  } catch (error) {
    console.error('Generate article error:', error);
    return NextResponse.json(
      { error: 'Failed to start article generation' },
      { status: 500 }
    );
  }
}