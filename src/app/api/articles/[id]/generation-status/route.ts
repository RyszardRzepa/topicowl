import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { ApiResponse, GenerationStatus } from '@/types/types';

// Import the progress map from the generate route
// Note: In a real implementation, this would be stored in Redis or a database
const progressMap = new Map<string, GenerationStatus>();

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

    const progress = progressMap.get(id);
    
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