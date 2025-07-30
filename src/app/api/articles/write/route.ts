import { anthropic } from '@ai-sdk/anthropic';
import { generateObject } from 'ai';
import { NextResponse } from 'next/server';
import { prompts } from '@/constants';
import { MODELS } from '@/constants';
import { db } from '@/server/db';
import { articleSettings } from '@/server/db/schema';
import type { OutlineResponse } from '@/app/api/articles/outline/route';
import { blogPostSchema } from '@/types';

// Types colocated with this API route
interface WriteRequest {
  outlineData: OutlineResponse;
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
    console.log("Write API request received", { 
      title: body.title,
      hasOutlineData: !!body.outlineData,
      keyPointsCount: body.outlineData?.keyPoints?.length ?? 0,
      keywordsCount: body.keywords?.length ?? 0,
      hasCoverImage: !!body.coverImage
    });
    
    if (!body.outlineData || !body.title || !body.keywords || body.keywords.length === 0) {
      console.log("Invalid request - missing required fields");
      return NextResponse.json(
        { error: 'Outline data, title, and keywords are required' },
        { status: 400 }
      );
    }

    // Validate outline data structure
    if (!body.outlineData.keyPoints || !Array.isArray(body.outlineData.keyPoints) || body.outlineData.keyPoints.length !== 5) {
      console.log("Invalid outline data - expected 5 key points");
      return NextResponse.json(
        { error: 'Invalid outline data structure' },
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
      console.log("Article settings loaded", { settingsFound: settings.length > 0 });
    } catch (error) {
      // If there's an error (like missing column), use defaults
      console.log('Using default article settings due to database error', error);
      settingsData = {
        toneOfVoice: '',
        articleStructure: '',
        maxWords: 800,
      };
    }

    console.log("Starting article generation with AI", {
      model: MODELS.CLAUDE_SONET_4,
      maxWords: settingsData.maxWords
    });

    const { object: articleObject } = await generateObject({
      model: anthropic(MODELS.CLAUDE_SONET_4),
      schema: blogPostSchema,
      prompt: prompts.writing({
        title: body.title,
        outlineData: body.outlineData,
        coverImage: body.coverImage
      }, settingsData, []),
    });

    // Include the cover image in the response if provided
    const responseObject = {
      ...articleObject,
      ...(body.coverImage && { coverImage: body.coverImage })
    } as WriteResponse;

    console.log("Article generation completed", {
      contentLength: responseObject.content?.length ?? 0,
      hasCoverImage: !!responseObject.coverImage,
      readingTime: responseObject.readingTime
    });

    return NextResponse.json(responseObject);
  } catch (error) {
    console.log('Write endpoint error', error);
    return NextResponse.json(
      { error: 'Failed to write article' },
      { status: 500 }
    );
  }
}
