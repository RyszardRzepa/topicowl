import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { ApiResponse } from '@/types';
import { db } from "@/server/db";
import { articles } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import type { ResearchResponse } from '@/app/api/articles/research/route';
import type { WriteResponse } from '@/app/api/articles/write/route';
import type { ValidateResponse } from '@/app/api/articles/validate/route';
import type { UpdateResponse } from '@/app/api/articles/update/route';
import { 
  updateProgress, 
  clearProgress,
} from '@/lib/generation-progress';
import { API_BASE_URL } from '@/constants';

// Types colocated with this API route
export interface ArticleGenerationRequest {
  articleId: string;
  forceRegenerate?: boolean;
}

// Article generation function - orchestrates existing API endpoints
async function generateArticleContentInline(articleId: string) {
  console.log('Starting article generation for article:', articleId);
  try {
    updateProgress(articleId, 'researching', 10, 'research', 'Starting research phase');

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

    // Update status to generating
    await db
      .update(articles)
      .set({ status: 'generating', updatedAt: new Date() })
      .where(eq(articles.id, parseInt(articleId)));

    console.log('Updated article status to generating');

    // STEP 1: Research Phase - Call research API
    updateProgress(articleId, 'researching', 20, 'research', 'Conducting topic research');
    
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
      console.warn('No keywords provided for research, using empty array');
    }
    
    const researchRequestBody = {
      title: article.title,  // Fixed: was 'topic', should be 'title'
      keywords: keywords,
    };
    
    console.log('Calling research API with body:', JSON.stringify(researchRequestBody, null, 2));
    const researchResponse = await fetch(`${API_BASE_URL}/api/articles/research`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(researchRequestBody),
    });

    console.log('Research API response status:', researchResponse.status);
    console.log('Research API response statusText:', researchResponse.statusText);

    if (!researchResponse.ok) {
      let errorBody = '';
      try {
        errorBody = await researchResponse.text();
        console.log('Research API error response body:', errorBody);
      } catch (textError) {
        console.log('Could not read error response body:', textError);
      }
      throw new Error(`Research API failed: ${researchResponse.status} ${researchResponse.statusText} - ${errorBody}`);
    }

    const researchData = await researchResponse.json() as ResearchResponse;
    console.log('Research response received:', JSON.stringify(researchData, null, 2));
    console.log('Research data length:', researchData?.researchData?.length ?? 0);
    console.log('Research completed, starting writing phase...');

    // STEP 2: Writing Phase - Call write API
    updateProgress(articleId, 'writing', 50, 'writing', 'Writing article content');

    const writeRequestBody = {
      researchData: researchData.researchData ?? '', // Direct access since research API returns { researchData: "..." }
      title: article.title,
      keywords: keywords,
      targetWordCount: 1500,
      tone: 'professional',
    };

    console.log('Calling write API with body:', JSON.stringify(writeRequestBody, null, 2));
    const writeResponse = await fetch(`${API_BASE_URL}/api/articles/write`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(writeRequestBody),
    });

    console.log('Write API response status:', writeResponse.status);
    if (!writeResponse.ok) {
      let errorBody = '';
      try {
        errorBody = await writeResponse.text();
        console.log('Write API error response body:', errorBody);
      } catch (textError) {
        console.log('Could not read write error response body:', textError);
      }
      throw new Error(`Write API failed: ${writeResponse.status} ${writeResponse.statusText} - ${errorBody}`);
    }

    const writeData = await writeResponse.json() as WriteResponse;
    console.log('Write API response received:', JSON.stringify(writeData, null, 2));
    console.log('Write data content length:', writeData.content?.length ?? 0);
    console.log('Writing completed, starting validation...');

    // STEP 3: Validation Phase - Call validate API
    updateProgress(articleId, 'validating', 75, 'validation', 'Validating content accuracy');

    const validateRequestBody = {
      article: writeData.content ?? '',
    };

    console.log('Calling validation API with content length:', writeData.content?.length ?? 0);
    console.log('Validation request body:', JSON.stringify(validateRequestBody, null, 2));
    const validateResponse = await fetch(`${API_BASE_URL}/api/articles/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validateRequestBody),
    });

    console.log('Validate API response status:', validateResponse.status);
    if (!validateResponse.ok) {
      let errorBody = '';
      try {
        errorBody = await validateResponse.text();
        console.log('Validate API error response body:', errorBody);
      } catch (textError) {
        console.log('Could not read validate error response body:', textError);
      }
      throw new Error(`Validation API failed: ${validateResponse.status} ${validateResponse.statusText} - ${errorBody}`);
    }

    const validationData = await validateResponse.json() as ApiResponse<ValidateResponse>;

    // STEP 4: Update Phase - Call update API if needed
    updateProgress(articleId, 'updating', 90, 'optimization', 'Finalizing content');

    let finalContent = writeData.content ?? '';
    const finalMetaDescription = writeData.metaDescription ?? '';

    // If validation found significant issues, call update API
    if (!validationData.data?.isValid && validationData.data?.issues?.some(issue => issue.severity === 'high' || issue.severity === 'medium')) {
      console.log('Validation found issues, calling update API...');
      
      const updateRequestBody = {
        article: writeData.content,
        corrections: validationData.data?.issues,
      };
      
      const updateResponse = await fetch(`${API_BASE_URL}/api/articles/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateRequestBody),
      });

      console.log('Update API response status:', updateResponse.status);
      if (!updateResponse.ok) {
        let errorBody = '';
        try {
          errorBody = await updateResponse.text();
          console.log('Update API error response body:', errorBody);
        } catch (textError) {
          console.log('Could not read update error response body:', textError);
        }
        throw new Error(`Update API failed: ${updateResponse.status} ${updateResponse.statusText} - ${errorBody}`);
      }

      const updateData = await updateResponse.json() as ApiResponse<UpdateResponse>;
      finalContent = updateData.data?.updatedContent ?? finalContent;
    }

    // Save generated content
    await db
      .update(articles)
      .set({
        draft: finalContent,
        metaDescription: finalMetaDescription,
        status: 'wait_for_publish', // Ready for review/publishing
        generationCompletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(articles.id, parseInt(articleId)));

    console.log('Saved generated content and updated status');

    updateProgress(articleId, 'completed', 100, 'optimization', 'Article generation completed successfully');
    console.log('Generation completed successfully for article:', articleId);

  } catch (error) {
    console.error('Generation error:', error);
    updateProgress(articleId, 'failed', 0, undefined);
    
    // Update article status to failed
    await db
      .update(articles)
      .set({
        status: 'idea', // Reset to idea status
        generationError: error instanceof Error ? error.message : 'Unknown error occurred',
        updatedAt: new Date(),
      })
      .where(eq(articles.id, parseInt(articleId)));
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as ArticleGenerationRequest;
    const { articleId, forceRegenerate } = body;
    
    console.log('Generate API called for article ID:', articleId);
    
    if (!articleId || isNaN(parseInt(articleId))) {
      console.error('Invalid article ID received:', articleId);
      return NextResponse.json(
        { success: false, error: "Invalid article ID" } as ApiResponse,
        { status: 400 }
      );
    }

    const id = parseInt(articleId);

    // Check if article exists
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
        generationStartedAt: new Date(),
        generationError: null, // Clear any previous errors
        updatedAt: new Date(),
      })
      .where(eq(articles.id, id));

    // Initialize progress tracking
    updateProgress(articleId, 'pending', 0, undefined, 'Initializing generation');

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
