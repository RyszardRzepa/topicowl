import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { ApiResponse } from '@/types/types';
import { updateProgress } from '@/lib/progress-tracker';
import { db } from "@/server/db";
import { articles } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import type { ResearchResponse } from '@/app/api/articles/research/route';
import type { WriteResponse } from '@/app/api/articles/write/route';
import type { ValidateResponse } from '@/app/api/articles/validate/route';
import type { UpdateResponse } from '@/app/api/articles/update/route';
import { API_BASE_URL } from '@/constants';

// Types colocated with this API route
export interface ArticleGenerationRequest {
  articleId: string;
  forceRegenerate?: boolean;
}

// Extended research response that includes the actual research text
interface ExtendedResearchResponse extends ResearchResponse {
  researchData: string;
}

// Article generation function - orchestrates existing API endpoints
async function generateArticleContentInline(articleId: string) {
  console.log('Starting article generation for article:', articleId);
  try {
    updateProgress(articleId, 'researching', 10, 'Starting research phase');

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
    updateProgress(articleId, 'researching', 20, 'Conducting topic research');
    
    const keywords = Array.isArray(article.keywords) ? (article.keywords as string[]) : [];
    
    console.log('Calling research API...');
    const researchResponse = await fetch(`${API_BASE_URL}/api/articles/research`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topic: article.title,
        keywords: keywords,
      }),
    });

    if (!researchResponse.ok) {
      throw new Error(`Research API failed: ${researchResponse.statusText}`);
    }

    const researchData = await researchResponse.json() as ApiResponse<ExtendedResearchResponse>;
    console.log('Research completed, starting writing phase...');

    // STEP 2: Writing Phase - Call write API
    updateProgress(articleId, 'writing', 50, 'Writing article content');

    console.log('Calling write API...');
    const writeResponse = await fetch(`${API_BASE_URL}/api/articles/write`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topic: article.title,
        keywords: keywords,
        targetWordCount: 1500,
        researchData: researchData.data, // Pass the extended research data object
        tone: 'professional',
      }),
    });

    if (!writeResponse.ok) {
      throw new Error(`Write API failed: ${writeResponse.statusText}`);
    }

    const writeData = await writeResponse.json() as ApiResponse<WriteResponse>;
    console.log('Writing completed, starting validation...');

    // STEP 3: Validation Phase - Call validate API
    updateProgress(articleId, 'validating', 75, 'Validating content accuracy');

    console.log('Calling validation API...');
    const validateResponse = await fetch(`${API_BASE_URL}/api/articles/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: writeData.data?.content,
        title: article.title,
        keywords: keywords,
      }),
    });

    if (!validateResponse.ok) {
      throw new Error(`Validation API failed: ${validateResponse.statusText}`);
    }

    const validationData = await validateResponse.json() as ApiResponse<ValidateResponse>;

    // STEP 4: Update Phase - Call update API if needed
    updateProgress(articleId, 'updating', 90, 'Finalizing content');

    let finalContent = writeData.data?.content ?? '';
    const finalMetaDescription = writeData.data?.metaDescription ?? '';

    // If validation found significant issues, call update API
    if (!validationData.data?.isValid && validationData.data?.issues?.some(issue => issue.severity === 'high' || issue.severity === 'medium')) {
      console.log('Validation found issues, calling update API...');
      
      const updateResponse = await fetch(`${API_BASE_URL}/api/articles/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: writeData.data?.content,
          issues: validationData.data?.issues,
        }),
      });

      if (!updateResponse.ok) {
        throw new Error(`Update API failed: ${updateResponse.statusText}`);
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

    updateProgress(articleId, 'completed', 100, 'Article generation completed successfully');
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

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    console.log('Generate API called for article ID:', id);
    
    if (!id || isNaN(parseInt(id))) {
      console.error('Invalid article ID received:', id);
      return NextResponse.json(
        { success: false, error: "Invalid article ID" } as ApiResponse,
        { status: 400 }
      );
    }

    const articleId = parseInt(id);

    // Immediately update article status to generating
    const [updatedArticle] = await db
      .update(articles)
      .set({
        status: 'generating',
        generationStartedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(articles.id, articleId))
      .returning();

    if (!updatedArticle) {
      return NextResponse.json(
        { success: false, error: "Article not found" } as ApiResponse,
        { status: 404 }
      );
    }

    // Initialize progress tracking
    updateProgress(id, 'pending', 0, 'Initializing generation');

    console.log('Starting background generation process for article:', id);
    // Start generation process (runs in background) - all logic inline
    generateArticleContentInline(id).catch(error => {
      console.error('Background generation failed:', error);
    });

    console.log('Returning success response for article:', id);
    return NextResponse.json({ 
      success: true,
      data: {
        message: "Article generation started",
        articleId: id,
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