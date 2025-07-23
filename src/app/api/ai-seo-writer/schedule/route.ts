import { type NextRequest, NextResponse } from "next/server";
import { schedulingService } from '@/lib/services/scheduling-service';

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const updatedArticle = await schedulingService.scheduleArticle(body);
    return NextResponse.json(updatedArticle);
  } catch (error) {
    console.error("Error updating article schedule:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update article schedule" },
      { status: 500 }
    );
  }
}
