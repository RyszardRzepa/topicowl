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
  sources: any[];
}

export class ResearchService {
  async conductResearch(request: ResearchRequest): Promise<ResearchResult> {
    if (!request.title || !request.keywords || request.keywords.length === 0) {
      throw new Error('Title and keywords are required');
    }

    const model = google(MODELS.GEMINI_2_5_FLASH, {
      useSearchGrounding: true,
      dynamicRetrievalConfig: {
        mode: 'MODE_UNSPECIFIED',
      },
    });

    const { text, sources } = await generateText({
      model,
      prompt: prompts.research(request.title, request.keywords),
    });

    return {
      researchData: text,
      sources: sources ?? []
    };
  }
}

export const researchService = new ResearchService();