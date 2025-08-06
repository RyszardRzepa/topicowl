import { anthropic } from '@ai-sdk/anthropic';
import { generateObject } from 'ai';
import { NextResponse } from 'next/server';
import { prompts } from "@/prompts";
import { MODELS } from '@/constants';
import { db } from '@/server/db';
import { articleSettings, users } from '@/server/db/schema';
import type { OutlineResponse } from '@/app/api/articles/outline/route';
import { blogPostSchema } from '@/types';
import { eq } from 'drizzle-orm';

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
  userId: string
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

// Extracted write logic that can be called directly
export async function performWriteLogic(
  outlineData: OutlineResponse,
  title: string,
  keywords: string[],
  userId: string,
  coverImage?: string,
  videos?: Array<{ title: string; url: string }>,
  sources?: Array<{ url: string; title?: string }>,
  notes?: string,
): Promise<WriteResponse> {
  console.log("[WRITE_LOGIC] Starting write generation", { 
    title,
    hasOutlineData: !!outlineData,
    keyPointsCount: outlineData?.keyPoints?.length ?? 0,
    keywordsCount: keywords?.length ?? 0,
    hasCoverImage: !!coverImage,
    sourcesCount: sources?.length ?? 0
  });
  
  if (!outlineData || !title || !keywords || keywords.length === 0) {
    throw new Error("Outline data, title, and keywords are required");
  }

  // Validate outline data structure
  if (!outlineData.keyPoints || !Array.isArray(outlineData.keyPoints) || outlineData.keyPoints.length !== 5) {
    throw new Error("Invalid outline data structure - expected 5 key points");
  }

  // Retrieve user's excluded domains (inlined from getUserExcludedDomains)
  let excludedDomains: string[] = [];
  try {
    console.log(`[DOMAIN_FILTER] Retrieving excluded domains for Clerk user: ${userId}`);
    
    // First, get the internal user ID from the Clerk user ID
    const [userRecord] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerk_user_id, userId))
      .limit(1);

    if (userRecord) {
      const settings = await db
        .select({ excluded_domains: articleSettings.excluded_domains })
        .from(articleSettings)
        .where(eq(articleSettings.user_id, userRecord.id))
        .limit(1);

      excludedDomains = settings.length > 0 ? settings[0]!.excluded_domains : [];
      
      console.log(`[DOMAIN_FILTER] Found ${excludedDomains.length} excluded domains for user ${userRecord.id}`);
    } else {
      console.log(`[DOMAIN_FILTER] User not found for Clerk ID: ${userId}`);
    }
  } catch (error) {
    console.error(`[DOMAIN_FILTER] Error retrieving excluded domains for Clerk user ${userId}:`, error);
    // Return empty array on error to avoid blocking article generation
    excludedDomains = [];
  }
  
  // Filter sources to remove excluded domains (inlined from filterSourcesByExcludedDomains)
  let filteredSources = sources;
  if (sources && excludedDomains && excludedDomains.length > 0) {
    filteredSources = sources.filter(source => {
      try {
        const url = new URL(source.url);
        const domain = url.hostname;
        
        // Normalize domain (remove www and convert to lowercase)
        const normalizedDomain = domain.toLowerCase().replace(/^www\./, '');
        
        // Check if domain is excluded
        const isExcluded = excludedDomains.some(excludedDomain => {
          const normalizedExcluded = excludedDomain.toLowerCase().replace(/^www\./, '');
          
          // Exact match
          if (normalizedDomain === normalizedExcluded) {
            return true;
          }
          
          // Check if the domain is a subdomain of the excluded domain
          if (normalizedDomain.endsWith('.' + normalizedExcluded)) {
            return true;
          }
          
          return false;
        });
        
        if (isExcluded) {
          console.log(`[DOMAIN_FILTER] Filtered out source: ${source.url} (domain: ${domain})`);
        }
        
        return !isExcluded;
      } catch (error) {
        // If URL parsing fails, keep the source (don't filter invalid URLs)
        console.warn(`[DOMAIN_FILTER] Could not parse URL for filtering: ${source.url}`, error);
        return true;
      }
    });

    const filteredCount = sources.length - filteredSources.length;
    if (filteredCount > 0) {
      console.log(`[DOMAIN_FILTER] Filtered out ${filteredCount} sources due to excluded domains`);
    }
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
    console.log("[WRITE_LOGIC] Article settings loaded", { settingsFound: settings.length > 0 });
  } catch (error) {
    // If there's an error (like missing column), use defaults
    console.log('[WRITE_LOGIC] Using default article settings due to database error', error);
    settingsData = {
      toneOfVoice: '',
      articleStructure: '',
      maxWords: 800,
    };
  }

  // Check if videos are available for enhanced generation
  const hasVideos = videos && videos.length > 0;
  // Always use basic schema for now to avoid schema validation issues
  const schemaToUse = blogPostSchema;

  console.log("[WRITE_LOGIC] Starting AI content generation", {
    model: MODELS.CLAUDE_SONET_4,
    hasVideos,
    schemaType: 'basic', // Always using basic schema now
    excludedDomainsCount: excludedDomains.length,
    filteredSourcesCount: filteredSources?.length ?? 0,
    originalSourcesCount: sources?.length ?? 0,
    settingsData: {
      toneOfVoice: settingsData.toneOfVoice?.slice(0, 50) + '...',
      maxWords: settingsData.maxWords
    }
  });

  let articleObject;
  // Create excluded domains prompt instruction
  const excludedDomainsInstruction = excludedDomains && excludedDomains.length > 0 
    ? `\n\nIMPORTANT: Do not include any links to the following excluded domains in your response: ${excludedDomains.join(', ')}. If any of these domains appear in your source material, do not reference them or include links to them in the generated content.`
    : '';

  try {
    const result = await generateObject({
      model: anthropic(MODELS.CLAUDE_SONET_4),
      schema: schemaToUse,
      prompt: prompts.writing({
        title: title,
        outlineData: outlineData,
        coverImage: coverImage,
        videos: [], // Don't pass videos to avoid enhanced schema issues
        sources: filteredSources ?? [],
        notes: notes
      }, settingsData, [], excludedDomains) + excludedDomainsInstruction,
    });
    articleObject = result.object;
    console.log("[WRITE_LOGIC] AI content generation completed successfully", {
      contentLength: articleObject.content?.length ?? 0,
      hasSlug: !!articleObject.slug,
      hasExcerpt: !!articleObject.excerpt,
      generatedFields: Object.keys(articleObject)
    });
  } catch (aiError) {
    console.error("[WRITE_LOGIC] AI content generation failed", {
      error: aiError instanceof Error ? {
        name: aiError.name,
        message: aiError.message,
        stack: aiError.stack?.slice(0, 500)
      } : aiError,
      model: MODELS.CLAUDE_SONET_4,
      hasVideos,
      schemaUsed: 'blogPostSchema',
      requiredFields: Object.keys(blogPostSchema.shape)
    });
    throw aiError;
  }

  // Log video usage for analytics
  if (hasVideos) {
    const videoCount = 'videos' in articleObject ? 
      (articleObject as { videos?: Array<unknown> }).videos?.length ?? 0 : 0;
    console.log(`[WRITE_LOGIC] Article generated with ${videoCount} videos embedded`);
  }

  // Validate the AI response has required fields
  if (!articleObject.content || !articleObject.title || !articleObject.slug) {
    console.error("[WRITE_LOGIC] AI generated invalid article object", {
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
    ...(coverImage && { coverImage: coverImage })
  } as WriteResponse;

  console.log("[WRITE_LOGIC] Article write completed successfully", {
    finalContentLength: responseObject.content.length,
    hasMetaDescription: !!responseObject.metaDescription,
    tagsCount: responseObject.tags?.length ?? 0
  });

  return responseObject;
}

export async function POST(request: Request) {
  let body: WriteRequest | undefined;
  try {  
    body = await request.json() as WriteRequest;

    const result = await performWriteLogic(
      body.outlineData,
      body.title,
      body.keywords,
      body.userId,
      body.coverImage,
      body.videos,
      body.sources,
      body.notes,
    );

    return NextResponse.json(result);
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
