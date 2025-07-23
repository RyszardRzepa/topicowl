import { google } from '@ai-sdk/google';
import { generateText } from 'ai';
import { NextResponse } from 'next/server';
import { prompts } from '@/lib/prompts';
import { MODELS } from '@/constants';

interface ResearchRequest {
  title: string;
  keywords: string[];
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as ResearchRequest;
    
    if (!body.title || !body.keywords || body.keywords.length === 0) {
      return NextResponse.json(
        { error: 'Title and keywords are required' },
        { status: 400 }
      );
    }

    const model = google(MODELS.GEMINI_2_5_FLASH, {
      useSearchGrounding: true,
      dynamicRetrievalConfig: {
        mode: 'MODE_UNSPECIFIED', // Always trigger grounding
      },
    });

    const { text, sources } = await generateText({
      model,
      prompt: prompts.research(
        body.title, 
        body.keywords
      ),
    });

    return NextResponse.json({ 
      researchData: text,
      sources: sources ?? []
    });
  } catch (error) {
    console.error('Research endpoint error:', error);
    return NextResponse.json(
      { error: 'Failed to conduct research' },
      { status: 500 }
    );
  }
}
