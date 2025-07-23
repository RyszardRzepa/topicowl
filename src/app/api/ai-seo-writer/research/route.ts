import { NextResponse } from 'next/server';
import { researchService } from '@/lib/services/research-service';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await researchService.conductResearch(body);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Research endpoint error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to conduct research' },
      { status: 500 }
    );
  }
}
