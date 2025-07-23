import { researchService } from './research-service';
import { writingService } from './writing-service';
import { validationService } from './validation-service';
import { updateService } from './update-service';
import { db } from '@/server/db';
import { articles } from '@/server/db/schema';
import { eq } from 'drizzle-orm';

export interface GenerationProgress {
  articleId: number;
  status: 'pending' | 'researching' | 'writing' | 'validating' | 'updating' | 'completed' | 'failed';
  progress: number;
  currentStep: string;
  error?: string;
}

export interface GeneratedArticle {
  id: number;
  title: string;
  content: string;
  metaDescription: string;
  draft: string;
  sources: any[];
  validationReport: any;
}

export class ArticleGenerationService {
  private progressMap = new Map<number, GenerationProgress>();

  async generateArticle(articleId: number): Promise<GeneratedArticle> {
    try {
      // Get article from database
      const [article] = await db
        .select()
        .from(articles)
        .where(eq(articles.id, articleId));

      if (!article) {
        throw new Error('Article not found');
      }

      // Update status to generating
      await this.updateArticleStatus(articleId, 'generating');
      this.updateProgress(articleId, 'researching', 10, 'Starting research phase');

      // Step 1: Research
      const researchResult = await researchService.conductResearch({
        title: article.title,
        keywords: article.keywords as string[],
      });
      this.updateProgress(articleId, 'writing', 30, 'Research completed, starting writing');

      // Step 2: Write article
      const blogPost = await writingService.writeArticle({
        researchData: researchResult.researchData,
        title: article.title,
        keywords: article.keywords as string[],
      });
      this.updateProgress(articleId, 'validating', 60, 'Writing completed, validating content');

      // Step 3: Validate content
      const validationResult = await validationService.validateArticle({
        article: blogPost.content,
      });
      this.updateProgress(articleId, 'updating', 80, 'Validation completed');

      // Step 4: Update if needed
      let finalBlogPost = blogPost;
      if (!validationResult.isValid && validationResult.issues.length > 0) {
        const corrections = validationResult.issues.map(issue => ({
          fact: issue.fact,
          issue: issue.issue,
          correction: issue.correction,
          confidence: issue.confidence,
        }));

        finalBlogPost = await updateService.updateArticle({
          article: blogPost.content,
          corrections,
        });
      }

      // Step 5: Save to database
      const [updatedArticle] = await db
        .update(articles)
        .set({
          draft: finalBlogPost.content,
          metaDescription: finalBlogPost.metaDescription,
          optimizedContent: finalBlogPost.content,
          sources: researchResult.sources,
          factCheckReport: validationResult,
          status: 'wait_for_publish',
          generationCompletedAt: new Date(),
        })
        .where(eq(articles.id, articleId))
        .returning();

      this.updateProgress(articleId, 'completed', 100, 'Article generation completed');

      return {
        id: updatedArticle!.id,
        title: updatedArticle!.title,
        content: finalBlogPost.content,
        metaDescription: finalBlogPost.metaDescription,
        draft: finalBlogPost.content,
        sources: researchResult.sources,
        validationReport: validationResult,
      };

    } catch (error) {
      console.error('Article generation failed:', error);
      await this.updateArticleStatus(articleId, 'idea');
      await db
        .update(articles)
        .set({
          generationError: error instanceof Error ? error.message : 'Unknown error',
        })
        .where(eq(articles.id, articleId));

      this.updateProgress(articleId, 'failed', 0, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  private async updateArticleStatus(articleId: number, status: string) {
    await db
      .update(articles)
      .set({ 
        status: status as any,
        generationStartedAt: status === 'generating' ? new Date() : undefined,
      })
      .where(eq(articles.id, articleId));
  }

  private updateProgress(articleId: number, status: GenerationProgress['status'], progress: number, currentStep: string, error?: string) {
    this.progressMap.set(articleId, {
      articleId,
      status,
      progress,
      currentStep,
      error,
    });
  }

  getGenerationProgress(articleId: number): GenerationProgress | null {
    return this.progressMap.get(articleId) || null;
  }

  async cancelGeneration(articleId: number): Promise<void> {
    this.progressMap.delete(articleId);
    await this.updateArticleStatus(articleId, 'idea');
  }
}

export const articleGenerationService = new ArticleGenerationService();