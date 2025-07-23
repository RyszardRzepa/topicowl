import { NextResponse } from 'next/server';
import { validationService } from '@/lib/services/validation-service';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await validationService.validateArticle(body);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Validation endpoint error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to validate article' },
      { status: 500 }
    );
  }
}
