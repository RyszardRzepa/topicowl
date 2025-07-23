import { NextRequest, NextResponse } from "next/server";
import { articleGenerationService } from "@/lib/services/article-generation-service";

export async function GET(
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