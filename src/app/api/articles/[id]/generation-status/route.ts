import { NextRequest, NextResponse } from "next/server";
import { articleGenerationService } from "@/lib/services/article-generation-service";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const articleId = parseInt(params.id);
    
    if (!articleId || isNaN(articleId)) {
      return NextResponse.json(
        { error: "Invalid article ID" },
        { status: 400 }
      );
    }

    const progress = articleGenerationService.getGenerationProgress(articleId);
    
    if (!progress) {
      return NextResponse.json(
        { error: "No generation in progress for this article" },
        { status: 404 }
      );
    }

    return NextResponse.json(progress);

  } catch (error) {
    console.error('Get generation status error:', error);
    return NextResponse.json(
      { error: 'Failed to get generation status' },
      { status: 500 }
    );
  }
}