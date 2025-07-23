import { NextRequest, NextResponse } from "next/server";
import { schedulingService } from "@/lib/services/scheduling-service";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const articleId = parseInt(params.id);
    const body = await req.json();
    
    if (!articleId || isNaN(articleId)) {
      return NextResponse.json(
        { error: "Invalid article ID" },
        { status: 400 }
      );
    }
    
    const updatedArticle = await schedulingService.scheduleArticle({
      id: articleId,
      scheduledAt: body.scheduledAt,
      status: body.status || 'wait_for_publish',
    });

    return NextResponse.json(updatedArticle);

  } catch (error) {
    console.error('Schedule article error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to schedule article' },
      { status: 500 }
    );
  }
}