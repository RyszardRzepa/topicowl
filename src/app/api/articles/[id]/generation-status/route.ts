import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { ApiResponse } from '@/types/types';
import { getProgress } from '@/lib/progress-tracker';

// Types colocated with this API route
export interface GenerationStatus {
  articleId: string;
  status: 'pending' | 'researching' | 'writing' | 'validating' | 'updating' | 'completed' | 'failed';
  progress: number; // 0-100
  currentStep?: string;
  error?: string;
  startedAt?: string;
  completedAt?: string;
}

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
      data: progress,
    } as ApiResponse<GenerationStatus>);

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