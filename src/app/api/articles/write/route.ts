import { anthropic } from '@ai-sdk/anthropic';
import { generateObject } from 'ai';
import { NextResponse } from 'next/server';
import { prompts } from '@/constants';
import { MODELS } from '@/constants';
import { db } from '@/server/db';
import { articleSettings } from '@/server/db/schema';
import { blogPostSchema } from '@/types';

// Types colocated with this API route
interface WriteRequest {
  researchData: string;
  title: string;
  keywords: string[];
  author?: string;
  publicationName?: string;
  coverImage?: string; // URL of the selected cover image
}

export interface WriteResponse {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  metaDescription: string;
  readingTime: string;
  content: string;
  author: string;
  date: string;
  coverImage?: string;
  imageCaption?: string;
  tags?: string[];
  relatedPosts?: string[];
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as WriteRequest;
    
    if (!body.researchData || !body.title || !body.keywords || body.keywords.length === 0) {
      return NextResponse.json(
        { error: 'Research data, title, and keywords are required' },
        { status: 400 }
      );
    }

    // Fetch article settings
    let settingsData;
    try {
      const settings = await db.select().from(articleSettings).limit(1);
      settingsData = settings.length > 0 ? {
        toneOfVoice: settings[0]!.toneOfVoice ?? '',
        articleStructure: settings[0]!.articleStructure ?? '',
        maxWords: settings[0]!.maxWords ?? 800, // Provide default if column doesn't exist
      } : {
        toneOfVoice: '',
        articleStructure: '',
        maxWords: 800,
      };
    } catch (error) {
      // If there's an error (like missing column), use defaults
      console.warn('Using default article settings due to database error:', error);
      settingsData = {
        toneOfVoice: '',
        articleStructure: '',
        maxWords: 800,
      };
    }

    const { object: articleObject } = await generateObject({
      model: anthropic(MODELS.CLAUDE_SONET_4),
      schema: blogPostSchema,
      prompt: prompts.writing({
        title: body.title,
        researchData: body.researchData,
        coverImage: body.coverImage
      }, settingsData, []),
    });

    // Include the cover image in the response if provided
    const responseObject = {
      ...articleObject,
      ...(body.coverImage && { coverImage: body.coverImage })
    } as WriteResponse;

    return NextResponse.json(responseObject);
  } catch (error) {
    console.error('Write endpoint error:', error);
    return NextResponse.json(
      { error: 'Failed to write article' },
      { status: 500 }
    );
  }
}
