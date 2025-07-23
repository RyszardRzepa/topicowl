import { google } from '@ai-sdk/google';
import { generateText, generateObject } from 'ai';
import { z } from 'zod';
import { NextResponse } from 'next/server';
import { prompts } from '@/lib/prompts';
import { MODELS } from '@/constants';

interface ValidationRequest {
  article: string;
}

const validationResponseSchema = z.object({
  isValid: z.boolean(),
  issues: z.array(z.object({
    fact: z.string(),
    issue: z.string(),
    correction: z.string(),
    confidence: z.number()
  }))
});

export async function POST(request: Request) {
  try {
    const body = await request.json() as ValidationRequest;
    
    if (!body.article) {
      return NextResponse.json(
        { error: 'Article content is required' },
        { status: 400 }
      );
    }

    const { text: validationAnalysis } = await generateText({
      model: google(MODELS.GEMINI_2_5_FLASH, {
      useSearchGrounding: true,
      dynamicRetrievalConfig: {
        mode: 'MODE_UNSPECIFIED',
      },
    }),
      prompt: prompts.validation(body.article),
    });

    const structurePrompt = `
      Based on this validation analysis, create a structured validation response:
      
      ${validationAnalysis}
      
      Return a JSON object with isValid boolean and any issues found.
      Only include issues with confidence > 0.7.
    `;

    const { object } = await generateObject({
      model: google(MODELS.GEMINI_2_5_FLASH),
      schema: validationResponseSchema,
      prompt: structurePrompt,
    });

    return NextResponse.json(object);
  } catch (error) {
    console.error('Validation endpoint error:', error);
    return NextResponse.json(
      { error: 'Failed to validate article' },
      { status: 500 }
    );
  }
}
