import { NextResponse } from 'next/server';
import { anthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';
import type { ResearchResponse } from '../research/route';
import type { ApiResponse } from '@/types/types';

// Types colocated with this API route
export interface WriteRequest {
  topic: string;
  keywords: string[];
  targetWordCount: number;
  researchData?: ResearchResponse;
  tone?: 'professional' | 'casual' | 'authoritative' | 'friendly';
}

export interface WriteResponse {
  title: string;
  content: string;
  metaDescription: string;
  wordCount: number;
  keywordsUsed: string[];
}

// Helper functions for tone and structure instructions
const getToneInstructions = (tone: string): string => {
  switch (tone) {
    case 'casual':
      return 'Use a relaxed, conversational style with everyday language, contractions, and personal touches. Feel free to use "you" and "your" to connect with readers.';
    case 'professional':
      return 'Maintain a polished, business-appropriate tone with clear, authoritative language. Be informative and credible while remaining accessible.';
    case 'authoritative':
      return 'Write with expert-level confidence using industry-specific terminology, backed by facts and data. Establish credibility through comprehensive knowledge.';
    case 'friendly':
      return 'Adopt a warm, approachable style that feels like advice from a knowledgeable friend. Be encouraging and supportive while providing valuable information.';
    default:
      return 'Use a professional and engaging tone that balances authority with accessibility.';
  }
};

// Writing prompt template
const getWritingPrompt = (request: WriteRequest) => `
You are an expert SEO content writer specializing in creating high-quality, engaging articles.

**Article Details:**
- Title: ${request.topic}
- Target Keywords: ${request.keywords.join(', ')}
- Target Word Count: ${request.targetWordCount} words

**Research Data:**
${request.researchData ? JSON.stringify(request.researchData) : 'No specific research data provided'}

**Writing Instructions:**
${getToneInstructions(request.tone ?? 'professional')}

**Content Guidelines:**
- Use target keywords naturally throughout the content
- Include actionable insights and practical information
- Create compelling headings and subheadings
- Ensure content serves the reader's search intent
- Structure content with clear H2/H3 headings
- Include introduction, main sections, and conclusion

**SEO Requirements:**
1. Create a meta description that's compelling and under 160 characters
2. Use target keywords naturally in headings and throughout content
3. Structure content for featured snippets when appropriate
4. Focus on creating valuable, original content optimized for search engines

Please write a complete article that meets these requirements.
`;

export async function POST(request: Request) {
  try {
    const body = await request.json() as WriteRequest;
    const { topic, keywords, targetWordCount } = body;

    if (!topic || !keywords || keywords.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Topic and keywords are required' } as ApiResponse,
        { status: 400 }
      );
    }

    // Generate article content using AI
    const writingPrompt = getWritingPrompt(body);
    
    const { text: content } = await generateText({
      model: anthropic('claude-3-5-sonnet-20241022'),
      prompt: writingPrompt,
      maxTokens: Math.min(targetWordCount * 2, 4000), // Rough estimate for tokens
    });

    // Extract title and meta description from content
    const lines = content.split('\n').filter(line => line.trim());
    const title = lines.find(line => line.startsWith('#'))?.replace('#', '').trim() ?? topic;
    
    // Generate meta description
    const metaDescPrompt = `Create a compelling meta description (under 160 characters) for this article about "${topic}". Keywords: ${keywords.join(', ')}`;
    const { text: metaDescription } = await generateText({
      model: anthropic('claude-3-5-sonnet-20241022'),
      prompt: metaDescPrompt,
      maxTokens: 100,
    });

    // Count words
    const wordCount = content.split(/\s+/).length;

    const response: WriteResponse = {
      title: title,
      content: content,
      metaDescription: metaDescription.trim(),
      wordCount,
      keywordsUsed: keywords, // In a real implementation, this would analyze actual keyword usage
    };

    return NextResponse.json({
      success: true,
      data: response,
    } as ApiResponse<WriteResponse>);

  } catch (error) {
    console.error('Write endpoint error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to write article' 
      } as ApiResponse,
      { status: 500 }
    );
  }
}
