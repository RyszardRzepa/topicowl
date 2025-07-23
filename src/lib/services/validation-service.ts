import { google } from '@ai-sdk/google';
import { generateText, generateObject } from 'ai';
import { z } from 'zod';
import { prompts } from '@/lib/prompts';
import { MODELS } from '@/constants';

export interface ValidationRequest {
  article: string;
}

export interface ValidationIssue {
  fact: string;
  issue: string;
  correction: string;
  confidence: number;
}

export interface ValidationResult {
  isValid: boolean;
  issues: ValidationIssue[];
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

export class ValidationService {
  async validateArticle(request: ValidationRequest): Promise<ValidationResult> {
    if (!request.article) {
      throw new Error('Article content is required');
    }

    const { text: validationAnalysis } = await generateText({
      model: google(MODELS.GEMINI_2_5_FLASH, {
        useSearchGrounding: true,
        dynamicRetrievalConfig: {
          mode: 'MODE_UNSPECIFIED',
        },
      }),
      prompt: prompts.validation(request.article),
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

    return object;
  }
}

export const validationService = new ValidationService();