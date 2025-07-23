import { NextResponse } from 'next/server';
import { google } from '@ai-sdk/google';
import { generateText } from 'ai';
import type { ResearchRequest, ResearchResponse, ApiResponse } from '@/types/types';

// Research prompt template
const getResearchPrompt = (title: string, keywords: string[]) => `
You are an expert researcher specializing in creating comprehensive research reports for SEO-optimized articles.

Research Topic: ${title}
Target Keywords: ${keywords.join(', ')}

Please conduct thorough research on this topic and provide:

1. **Background Information**: Key facts, definitions, and context about the topic
2. **Current Trends**: Latest developments, statistics, and industry insights
3. **Expert Perspectives**: Authoritative viewpoints and analysis from credible sources
4. **Related Subtopics**: Important aspects and related areas to cover
5. **Key Data Points**: Relevant statistics, numbers, and quantifiable information
6. **Common Questions**: Frequently asked questions people have about this topic

Focus on gathering factually accurate, up-to-date information from authoritative sources. 
Prioritize recent developments and ensure the research directly supports the target keywords.

Format your response as a comprehensive research document that would enable someone to write an authoritative article on this topic.
`;

export async function POST(request: Request) {
  try {
    const body = await request.json() as ResearchRequest;
    const { topic, keywords = [], competitors = [] } = body;

    if (!topic) {
      return NextResponse.json(
        { success: false, error: 'Topic is required' } as ApiResponse,
        { status: 400 }
      );
    }

    // Generate research using AI
    const researchPrompt = getResearchPrompt(topic, keywords);
    
    const { text: researchData } = await generateText({
      model: google('gemini-2.0-flash-exp'),
      prompt: researchPrompt,
      maxTokens: 2000,
    });

    // Mock competitor analysis and keyword data for now
    // In a real implementation, this would use actual SEO tools
    const mockResearchResponse: ResearchResponse = {
      keywordData: keywords.map(keyword => ({
        keyword,
        searchVolume: Math.floor(Math.random() * 10000) + 100,
        difficulty: Math.floor(Math.random() * 100),
        relatedKeywords: [`${keyword} guide`, `${keyword} tips`, `${keyword} best practices`],
      })),
      competitorAnalysis: competitors.map(url => ({
        url,
        title: `Analysis of ${url}`,
        wordCount: Math.floor(Math.random() * 2000) + 500,
        keyTopics: keywords.slice(0, 3),
      })),
      contentGaps: [
        'Practical implementation examples',
        'Recent industry updates',
        'Expert opinions and insights',
      ],
      recommendedTopics: [
        `${topic} best practices`,
        `Common ${topic} mistakes`,
        `Future of ${topic}`,
      ],
    };

    return NextResponse.json({
      success: true,
      data: {
        researchData,
        ...mockResearchResponse,
      },
    } as ApiResponse<{ researchData: string } & ResearchResponse>);

  } catch (error) {
    console.error('Research endpoint error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to conduct research' 
      } as ApiResponse,
      { status: 500 }
    );
  }
}
