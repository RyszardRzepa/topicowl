import { anthropic } from '@ai-sdk/anthropic';
import { generateObject } from 'ai';
import { NextResponse } from 'next/server';
import { prompts } from "@/prompts";
import { MODELS } from '@/constants';
import { db } from '@/server/db';
import { articleSettings } from '@/server/db/schema';
import type { OutlineResponse } from '@/app/api/articles/outline/route';
import { blogPostSchema, enhancedBlogPostSchema } from '@/types';

// Types colocated with this API route
interface WriteRequest {
  outlineData: OutlineResponse;
  title: string;
  keywords: string[];
  author?: string;
  publicationName?: string;
  coverImage?: string; // URL of the selected cover image
  videos?: Array<{
    title: string;
    url: string;
  }>;
  sources?: Array<{
    url: string;
    title?: string;
  }>;
  notes?: string; // User-provided context and requirements
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
  videos?: Array<{
    title: string;
    url: string;
    sectionHeading: string;
    contextMatch: string;
  }>;
  hasVideoIntegration?: boolean;
}

export async function POST(request: Request) {
  let body: WriteRequest | undefined;
  try {
    body = await request.json() as WriteRequest;
    console.log("Write API request received", { 
      title: body.title,
      hasOutlineData: !!body.outlineData,
      keyPointsCount: body.outlineData?.keyPoints?.length ?? 0,
      keywordsCount: body.keywords?.length ?? 0,
      hasCoverImage: !!body.coverImage,
      sourcesCount: body.sources?.length ?? 0
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

    // Check if videos are available for enhanced generation
    const hasVideos = body.videos && body.videos.length > 0;
    const schemaToUse = hasVideos ? enhancedBlogPostSchema : blogPostSchema;

    console.log("Starting AI content generation", {
      model: MODELS.CLAUDE_SONET_4,
      hasVideos,
      schemaType: hasVideos ? 'enhanced' : 'basic',
      settingsData: {
        toneOfVoice: settingsData.toneOfVoice?.slice(0, 50) + '...',
        maxWords: settingsData.maxWords
      }
    });

    let articleObject;
    try {
      const result = await generateObject({
        model: anthropic(MODELS.CLAUDE_SONET_4),
        schema: schemaToUse,
        prompt: prompts.writing({
          title: body.title,
          outlineData: body.outlineData,
          coverImage: body.coverImage,
          videos: body.videos ?? [],
          sources: body.sources ?? [],
          notes: body.notes
        }, settingsData, []),
      });
      articleObject = result.object;
      console.log("AI content generation completed successfully", {
        contentLength: articleObject.content?.length ?? 0,
        hasSlug: !!articleObject.slug,
        hasExcerpt: !!articleObject.excerpt
      });
    } catch (aiError) {
      console.error("AI content generation failed", {
        error: aiError instanceof Error ? {
          name: aiError.name,
          message: aiError.message,
          stack: aiError.stack?.slice(0, 500)
        } : aiError,
        model: MODELS.CLAUDE_SONET_4,
        hasVideos,
        promptLength: prompts.writing({
          title: body.title,
          outlineData: body.outlineData,
          coverImage: body.coverImage,
          videos: body.videos ?? [],
          sources: body.sources ?? [],
          notes: body.notes
        }, settingsData, []).length
      });
      throw aiError;
    }

    // Log video usage for analytics
    if (hasVideos) {
      const videoCount = 'videos' in articleObject ? 
        (articleObject as { videos?: Array<unknown> }).videos?.length ?? 0 : 0;
      console.log(`Article generated with ${videoCount} videos embedded`);
    }

    // Validate the AI response has required fields
    if (!articleObject.content || !articleObject.title || !articleObject.slug) {
      console.error("AI generated invalid article object", {
        hasContent: !!articleObject.content,
        hasTitle: !!articleObject.title,
        hasSlug: !!articleObject.slug,
        articleObject: JSON.stringify(articleObject).slice(0, 500) + '...'
      });
      throw new Error("AI generated article is missing required fields (content, title, or slug)");
    }

    // Ensure excerpt is included as the first paragraph of the content
    const contentWithExcerpt = articleObject.excerpt 
      ? `${articleObject.excerpt}\n\n${articleObject.content}`
      : articleObject.content;

    // Include the cover image in the response if provided
    const responseObject = {
      ...articleObject,
      content: contentWithExcerpt,
      ...(body.coverImage && { coverImage: body.coverImage })
    } as WriteResponse;

    console.log("Article write completed successfully", {
      finalContentLength: responseObject.content.length,
      hasMetaDescription: !!responseObject.metaDescription,
      tagsCount: responseObject.tags?.length ?? 0
    });

    return NextResponse.json(responseObject);
  } catch (error) {
    console.error('Write endpoint error - Full details:', {
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : error,
      timestamp: new Date().toISOString(),
      request: {
        title: body?.title ?? 'unknown',
        hasOutlineData: !!body?.outlineData,
        keywordsCount: body?.keywords?.length ?? 0,
        keyPointsCount: body?.outlineData?.keyPoints?.length ?? 0,
      }
    });
    
    // Return more specific error information for debugging
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json(
      { 
        error: 'Failed to write article',
        details: errorMessage,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
