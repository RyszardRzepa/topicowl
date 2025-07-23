import { anthropic } from '@ai-sdk/anthropic';
import { generateObject } from 'ai';
import { prompts } from '@/lib/prompts';
import { MODELS } from '@/constants';
import { blogPostSchema, type BlogPost } from './writing-service';

export interface Correction {
  fact: string;
  issue: string;
  correction: string;
  confidence: number;
}

export interface UpdateRequest {
  article: string;
  corrections: Correction[];
}

export class UpdateService {
  async updateArticle(request: UpdateRequest): Promise<BlogPost> {
    if (!request.article || !request.corrections) {
      throw new Error('Article and corrections are required');
    }

    const model = anthropic(MODELS.CLAUDE_SONET_4);

    const { object: articleObject } = await generateObject({
      model,
      schema: blogPostSchema,
      prompt: prompts.update(request.article, request.corrections),
    });

    return articleObject;
  }
}

export const updateService = new UpdateService();