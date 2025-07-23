import { NextResponse } from 'next/server';
import { writingService } from '@/lib/services/writing-service';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await writingService.writeArticle(body);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Write endpoint error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to write article' },
      { status: 500 }
    );
  }
}
