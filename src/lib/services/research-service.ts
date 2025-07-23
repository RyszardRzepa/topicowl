import { google } from '@ai-sdk/google';
import { generateText } from 'ai';
import { prompts } from '@/lib/prompts';
import { MODELS } from '@/constants';

export interface ResearchRequest {
  title: string;
  keywords: string[];
}

export interface ResearchResult {
  researchData: string;
  sources: unknown[];
}

export class ResearchService {
  async conductResearch(request: ResearchRequest): Promise<ResearchResult> {
    if (!request.title) {
      throw new Error('Title is required');
    }

    // If no keywords provided, use the title as a basic keyword
    const keywords = request.keywords && request.keywords.length > 0 
      ? request.keywords 
      : [request.title];

    const model = google(MODELS.GEMINI_2_5_FLASH, {
      useSearchGrounding: true,
      dynamicRetrievalConfig: {
        mode: 'MODE_UNSPECIFIED',
      },
    });

    const { text, sources } = await generateText({
      model,
      prompt: prompts.research(request.title, keywords),
    });

    return {
      researchData: text,
      sources: sources ?? []
    };
  }
}

export const researchService = new ResearchService();