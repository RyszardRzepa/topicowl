import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import type { ApiResponse } from '@/types';
import { db } from "@/server/db";
import { articles, articleGeneration, users, articleSettings } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import type { ResearchResponse } from '@/app/api/articles/research/route';
import type { WriteResponse } from '@/app/api/articles/write/route';
import type { ValidateResponse } from '@/app/api/articles/validate/route';
import type { UpdateResponse } from '@/app/api/articles/update/route';
import type { ArticleImageSelectionResponse } from '@/app/api/articles/images/select-for-article/route';
import { google } from '@ai-sdk/google';
import { anthropic } from '@ai-sdk/anthropic';
import { generateText, generateObject } from 'ai';
import { prompts, MODELS } from '@/constants';
import { blogPostSchema } from '@/types';
import { z } from 'zod';

// Types colocated with this API route
export interface ArticleGenerationRequest {
  articleId: string;
  forceRegenerate?: boolean;
}

// Direct function implementations to avoid HTTP self-calls
async function performResearch(title: string, keywords: string[]): Promise<ResearchResponse> {
  console.log('[RESEARCH_FUNCTION] Starting research for:', title);
  
  if (!title) {
    throw new Error('Title is required');
  }
  
  if (!Array.isArray(keywords)) {
    throw new Error('Keywords must be an array');
  }
  
  if (keywords.length === 0) {
    throw new Error('At least one keyword is required');
  }

  const model = google(MODELS.GEMINI_2_5_FLASH, {
    useSearchGrounding: true,
    dynamicRetrievalConfig: {
      mode: 'MODE_UNSPECIFIED',
    },
  });

  const { text, sources } = await generateText({
    model,
    prompt: prompts.research(title, keywords),
  });

  console.log('[RESEARCH_FUNCTION] Research completed, sources found:', sources?.length ?? 0);
  return { 
    researchData: text,
    sources: sources ?? []
  };
}

async function performWriting(researchData: string, title: string, keywords: string[], coverImage?: string): Promise<WriteResponse> {
  console.log('[WRITE_FUNCTION] Starting writing for:', title);
  
  if (!researchData || !title || !keywords || keywords.length === 0) {
    throw new Error('Research data, title, and keywords are required');
  }

  // Fetch article settings
  let settingsData;
  try {
    const settings = await db.select().from(articleSettings).limit(1);
    settingsData = settings.length > 0 ? {
      toneOfVoice: settings[0]!.toneOfVoice ?? '',
      articleStructure: settings[0]!.articleStructure ?? '',
      maxWords: settings[0]!.maxWords ?? 800,
    } : {
      toneOfVoice: '',
      articleStructure: '',
      maxWords: 800,
    };
  } catch (error) {
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
      title: title,
      researchData: researchData,
      coverImage: coverImage
    }, settingsData, []),
  });

  const responseObject = {
    ...(articleObject),
    ...(coverImage && { coverImage: coverImage })
  } as WriteResponse;

  console.log('[WRITE_FUNCTION] Writing completed');
  return responseObject;
}

const validationResponseSchema = z.object({
  isValid: z.boolean(),
  issues: z.array(z.object({
    fact: z.string(),
    issue: z.string(),
    correction: z.string(),
    confidence: z.number(),
    severity: z.enum(['low', 'medium', 'high'])
  }))
});

async function performValidation(article: string): Promise<ValidateResponse> {
  console.log('[VALIDATE_FUNCTION] Starting validation');
  
  if (!article) {
    throw new Error('Article content is required');
  }

  const { text: validationAnalysis } = await generateText({
    model: google(MODELS.GEMINI_2_5_FLASH, {
      useSearchGrounding: true,
      dynamicRetrievalConfig: {
        mode: 'MODE_UNSPECIFIED',
      },
    }),
    prompt: prompts.validation(article),
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

  console.log('[VALIDATE_FUNCTION] Validation completed');
  return object;
}

async function performUpdate(article: string, corrections: Array<{ fact: string; issue: string; correction: string; confidence: number }>): Promise<UpdateResponse> {
  console.log('[UPDATE_FUNCTION] Starting update');
  
  if (!article || !corrections) {
    throw new Error('Article and corrections are required');
  }

  const model = anthropic(MODELS.CLAUDE_SONET_4);

  const { object: articleObject } = await generateObject({
    model,
    schema: blogPostSchema,
    prompt: prompts.update(article, corrections),
  });

  const response: UpdateResponse = {
    updatedContent: (articleObject).content,
  };

  console.log('[UPDATE_FUNCTION] Update completed');
  return response;
}

async function performImageSelection(articleId: number, generationId: number, title: string, keywords: string[]): Promise<string> {
  console.log('[IMAGE_SELECTION_FUNCTION] Starting image selection for:', title);
  
  try {
    // For now, we'll skip image selection to avoid additional complexity
    // This can be re-enabled later when the main generation flow is working
    console.log('[IMAGE_SELECTION_FUNCTION] Skipping image selection for now');
    return '';
  } catch (error) {
    console.warn('[IMAGE_SELECTION_FUNCTION] Image selection failed, continuing without image:', error);
    return '';
  }
}

// Article generation function - orchestrates existing API endpoints
async function generateArticleContentInline(articleId: string) {
  console.log('Starting article generation for article:', articleId);
  let generationRecord: typeof articleGeneration.$inferSelect | null = null; // Declare at function scope
  try {
    // Get article from database
    const [article] = await db
      .select()
      .from(articles)
      .where(eq(articles.id, parseInt(articleId)));

    if (!article) {
      console.error('Article not found in database:', articleId);
      throw new Error('Article not found');
    }

    console.log('Found article:', article.title);
    console.log('Article user_id:', article.user_id);

    // Create generation record (user_id should always exist now due to authentication)
    if (!article.user_id) {
      throw new Error('Article missing user_id - this should not happen with proper authentication');
    }

    try {
      const result = await db
        .insert(articleGeneration)
        .values({
          articleId: article.id,
          userId: article.user_id,
          status: 'pending',
          progress: 0,
          startedAt: new Date(),
        })
        .returning();
      
      generationRecord = result[0] ?? null;
      console.log('Created generation record:', generationRecord?.id);
    } catch (error) {
      console.error('Failed to create generation record:', error);
      throw new Error('Failed to create generation record');
    }

    if (!generationRecord) {
      throw new Error('Failed to create generation record - no record returned');
    }

    // Update status to generating
    await db
      .update(articles)
      .set({ status: 'generating', updatedAt: new Date() })
      .where(eq(articles.id, parseInt(articleId)));

    console.log('Updated article status to generating');

    // Update generation record to researching phase
    await db
      .update(articleGeneration)
      .set({
        status: 'researching',
        progress: 10,
        updatedAt: new Date()
      })
      .where(eq(articleGeneration.id, generationRecord.id));

    // STEP 1: Research Phase - Call research function directly
    
    const keywords = Array.isArray(article.keywords) ? (article.keywords as string[]) : [];
    
    console.log('Article data for research:', {
      id: article.id,
      title: article.title,
      rawKeywords: article.keywords,
      processedKeywords: keywords,
      keywordsLength: keywords.length,
      keywordsType: typeof keywords,
    });
    
    // Validate required fields before making the request
    if (!article.title) {
      throw new Error('Article title is required for research');
    }
    
    if (!Array.isArray(keywords) || keywords.length === 0) {
      console.warn('No keywords provided for research, using title as keyword');
      keywords.push(article.title);
    }
    
    console.log('Calling research function with title:', article.title, 'and keywords:', keywords);
    const researchData = await performResearch(article.title, keywords);
    console.log('Research response received:', JSON.stringify(researchData, null, 2));
    console.log('Research data length:', researchData?.researchData?.length ?? 0);

    // Update generation record with research results  
    await db
      .update(articleGeneration)
      .set({
        status: 'researching',
        progress: 35,
        researchData: researchData.researchData || {},
        updatedAt: new Date()
      })
      .where(eq(articleGeneration.id, generationRecord.id));

    console.log('Research completed, starting image selection...');

    // STEP 2: Image Selection Phase - Call image selection function directly

    let coverImageUrl = '';
    try {
      console.log('Calling image selection function');
      coverImageUrl = await performImageSelection(article.id, generationRecord.id, article.title, keywords);
      console.log('Cover image selected:', coverImageUrl);
    } catch (imageError) {
      console.warn('Image selection error, continuing without cover image:', imageError);
    }

    console.log('Image selection completed, starting writing phase...');

    // Update generation record to writing phase
    await db
      .update(articleGeneration)
      .set({
        status: 'writing',
        progress: 50,
        updatedAt: new Date()
      })
      .where(eq(articleGeneration.id, generationRecord.id));

    // STEP 3: Writing Phase - Call write function directly

    console.log('Calling write function');
    const writeData = await performWriting(
      researchData.researchData ?? '', 
      article.title, 
      keywords, 
      coverImageUrl
    );
    console.log('Write response received:', JSON.stringify(writeData, null, 2));
    console.log('Write data content length:', writeData.content?.length ?? 0);
    console.log('Writing completed, starting validation...');

    // Update generation record with writing results
    await db
      .update(articleGeneration)
      .set({
        status: 'validating',
        progress: 70,
        draftContent: writeData.content || '',
        updatedAt: new Date()
      })
      .where(eq(articleGeneration.id, generationRecord.id));

    // STEP 4: Validation Phase - Call validate function directly

    console.log('Calling validation function with content length:', writeData.content?.length ?? 0);
    const validationData = await performValidation(writeData.content ?? '');

    // Update generation record with validation results
    await db
      .update(articleGeneration)
      .set({
        status: 'updating',
        progress: 90,
        validationReport: validationData || {},
        updatedAt: new Date()
      })
      .where(eq(articleGeneration.id, generationRecord.id));

    // STEP 5: Update Phase - Call update function if needed

    let finalContent = writeData.content ?? '';
    const finalMetaDescription = writeData.metaDescription ?? '';

    // If validation found significant issues, call update function
    if (!validationData.isValid && validationData.issues?.some(issue => issue.severity === 'high' || issue.severity === 'medium')) {
      console.log('Validation found issues, calling update function...');
      
      const updateData = await performUpdate(writeData.content ?? '', validationData.issues);
      finalContent = updateData.updatedContent ?? finalContent;
    }

    // Save generated content
    await db
      .update(articles)
      .set({
        draft: finalContent,
        metaDescription: finalMetaDescription,
        status: 'wait_for_publish', // Ready for review/publishing
        updatedAt: new Date(),
      })
      .where(eq(articles.id, parseInt(articleId)));

    // Update generation record as completed
    try {
      await db
        .update(articleGeneration)
        .set({
          status: 'completed',
          progress: 100,
          completedAt: new Date(),
          draftContent: finalContent,
          updatedAt: new Date(),
        })
        .where(eq(articleGeneration.id, generationRecord.id));
    } catch (error) {
      console.error('Failed to update generation record:', error);
    }

    console.log('Saved generated content and updated status');
    console.log('Generation completed successfully for article:', articleId);

  } catch (error) {
    console.error('Generation error:', error);
    
    // Update article status to failed
    await db
      .update(articles)
      .set({
        status: 'idea', // Reset to idea status
        updatedAt: new Date(),
      })
      .where(eq(articles.id, parseInt(articleId)));

    // Update generation record as failed if it exists
    if (generationRecord) {
      try {
        await db
          .update(articleGeneration)
          .set({
            status: 'failed',
            error: error instanceof Error ? error.message : 'Unknown error occurred',
            errorDetails: { timestamp: new Date().toISOString() },
            updatedAt: new Date(),
          })
          .where(eq(articleGeneration.id, generationRecord.id));
      } catch (updateError) {
        console.error('Failed to update generation record:', updateError);
      }
    }
  }
}

export async function POST(req: NextRequest) {
  try {
    // Get current user from Clerk
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" } as ApiResponse,
        { status: 401 }
      );
    }

    // Get user record from database
    const [userRecord] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerk_user_id, userId))
      .limit(1);

    if (!userRecord) {
      return NextResponse.json(
        { success: false, error: "User not found" } as ApiResponse,
        { status: 404 }
      );
    }

    const body = await req.json() as ArticleGenerationRequest;
    const { articleId, forceRegenerate } = body;
    
    console.log('Generate API called for article ID:', articleId, 'by user:', userRecord.id);
    
    if (!articleId || isNaN(parseInt(articleId))) {
      console.error('Invalid article ID received:', articleId);
      return NextResponse.json(
        { success: false, error: "Invalid article ID" } as ApiResponse,
        { status: 400 }
      );
    }

    const id = parseInt(articleId);

    // Check if article exists and belongs to the current user
    const [existingArticle] = await db
      .select()
      .from(articles)
      .where(eq(articles.id, id));

    if (!existingArticle) {
      return NextResponse.json(
        { success: false, error: "Article not found" } as ApiResponse,
        { status: 404 }
      );
    }

    // Verify article ownership
    if (existingArticle.user_id !== userRecord.id) {
      return NextResponse.json(
        { success: false, error: "Access denied: Article does not belong to current user" } as ApiResponse,
        { status: 403 }
      );
    }

    // Check if article is already being generated (unless force regenerate)
    if (existingArticle.status === 'generating' && !forceRegenerate) {
      return NextResponse.json(
        { success: false, error: "Article generation already in progress" } as ApiResponse,
        { status: 409 }
      );
    }

    // Update article status to generating
    await db
      .update(articles)
      .set({
        status: 'generating',
        updatedAt: new Date(),
      })
      .where(eq(articles.id, id));

    console.log('Starting background generation process for article:', articleId);
    // Start generation process (runs in background) - all logic inline
    generateArticleContentInline(articleId).catch(error => {
      console.error('Background generation failed:', error);
    });

    console.log('Returning success response for article:', articleId);
    return NextResponse.json({ 
      success: true,
      data: {
        message: "Article generation started",
        articleId: articleId,
      },
    } as ApiResponse);

  } catch (error) {
    console.error('Generate article error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to start article generation' 
      } as ApiResponse,
      { status: 500 }
    );
  }
}
