import { anthropic } from '@ai-sdk/anthropic';
import { generateObject } from 'ai';
import { NextResponse } from 'next/server';
import { prompts } from '@/lib/prompts';
import { MODELS } from '@/constants';
import { blogPostSchema } from '../write/route';

interface Correction {
  fact: string;
  issue: string;
  correction: string;
  confidence: number;
}

interface UpdateRequest {
  article: string;
  corrections: Correction[];
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as UpdateRequest;
    
    if (!body.article || !body.corrections) {
      return NextResponse.json(
        { error: 'Article and corrections are required' },
        { status: 400 }
      );
    }

    const model = anthropic(MODELS.CLAUDE_SONET_4);

    const { object: articleObject } = await generateObject({
      model,
      schema: blogPostSchema,
      prompt: prompts.update(body.article, body.corrections),
    });

    return NextResponse.json(articleObject);
  } catch (error) {
    console.error('Update endpoint error:', error);
    return NextResponse.json(
      { error: 'Failed to update article' },
      { status: 500 }
    );
  }
}
