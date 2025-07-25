import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { ApiResponse } from '@/types';
import { getProgress } from '@/lib/generation-progress';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    if (!id || isNaN(parseInt(id))) {
      return NextResponse.json(
        { success: false, error: "Invalid article ID" } as ApiResponse,
        { status: 400 }
      );
    }

    const progress = getProgress(id);
    
    if (!progress) {
      return NextResponse.json(
        { success: false, error: "No generation in progress for this article" } as ApiResponse,
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      progress: progress.progress,
      phase: progress.phase,
      status: progress.status,
      error: progress.error,
      estimatedCompletion: progress.estimatedCompletion,
      startedAt: progress.startedAt,
      completedAt: progress.completedAt,
    });

  } catch (error) {
    console.error('Get generation status error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to get generation status' 
      } as ApiResponse,
      { status: 500 }
    );
  }
}