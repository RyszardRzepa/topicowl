import { NextRequest, NextResponse } from "next/server";
import { schedulingService } from "@/lib/services/scheduling-service";

export async function POST(req: NextRequest) {
  try {
    const publishedArticles = await schedulingService.publishScheduledArticles();
    
    console.log(`Published ${publishedArticles.length} articles`);
    
    return NextResponse.json({
      success: true,
      publishedCount: publishedArticles.length,
      publishedArticles: publishedArticles.map(a => ({ id: a.id, title: a.title })),
    });

  } catch (error) {
    console.error('Cron job error:', error);
    return NextResponse.json(
      { error: 'Failed to publish scheduled articles' },
      { status: 500 }
    );
  }
}