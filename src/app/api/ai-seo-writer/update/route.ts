import { NextResponse } from 'next/server';
import { updateService } from '@/lib/services/update-service';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await updateService.updateArticle(body);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Update endpoint error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update article' },
      { status: 500 }
    );
  }
}
