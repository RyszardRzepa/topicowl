import type { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/server/db';
import { users } from '@/server/db/schema';
import { eq } from 'drizzle-orm';

export interface AnalyzeWebsiteRequest {
  websiteUrl: string;
}

export interface AnalyzeWebsiteResponse {
  success: boolean;
  data?: {
    domain: string;
    companyName: string;
    productDescription: string;
    toneOfVoice: string;
    suggestedKeywords: string[];
    industryCategory: string;
    targetAudience: string;
    contentStrategy: {
      articleStructure: string;
      maxWords: number;
      publishingFrequency: string;
    };
  };
  error?: string;
}

// Simple website scraping function (placeholder - would use proper scraping in production)
async function scrapeWebsite(url: string) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AI-SEO-Content-Machine/1.0)',
      },
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const html = await response.text();
    
    // Extract basic information from HTML
    const titleRegex = /<title[^>]*>([^<]+)<\/title>/i;
    const descriptionRegex = /<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i;
    const keywordsRegex = /<meta[^>]*name=["']keywords["'][^>]*content=["']([^"']+)["']/i;
    
    const titleMatch = titleRegex.exec(html);
    const descriptionMatch = descriptionRegex.exec(html);
    const keywordsMatch = keywordsRegex.exec(html);
    
    // Extract text content (simplified)
    const textContent = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 5000); // Limit content for AI processing
    
    return {
      title: titleMatch?.[1]?.trim() ?? '',
      description: descriptionMatch?.[1]?.trim() ?? '',
      keywords: keywordsMatch?.[1]?.trim() ?? '',
      textContent,
      url,
    };
  } catch (error) {
    throw new Error(`Failed to scrape website: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// AI analysis function (placeholder - would use actual AI in production)
async function analyzeWebsiteContent(websiteContent: {
  title: string;
  description: string;
  keywords: string;
  textContent: string;
  url: string;
}) {
  // This is a simplified version - in production you'd use actual AI services
  const domain = new URL(websiteContent.url).hostname.replace('www.', '');
  
  // Simple heuristics for demo purposes
  const companyName = websiteContent.title.split(' - ')[0]?.split(' | ')[0] ?? domain;
  
  const productDescription = websiteContent.description || 
    `${companyName} provides professional services and solutions.`;
  
  // Extract potential keywords from content
  const contentWords = websiteContent.textContent
    .toLowerCase()
    .split(/\s+/)
    .filter(word => word.length > 3 && word.length < 15)
    .filter(word => !/^\d+$/.test(word));
  
  const wordCounts = contentWords.reduce((acc, word) => {
    acc[word] = (acc[word] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const suggestedKeywords = Object.entries(wordCounts)
    .filter(([, count]) => count > 2)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([word]) => word);
  
  // Simple industry detection
  const industryKeywords = {
    'technology': ['software', 'app', 'digital', 'tech', 'development', 'platform'],
    'healthcare': ['health', 'medical', 'care', 'patient', 'treatment', 'clinic'],
    'finance': ['financial', 'investment', 'banking', 'money', 'finance', 'loan'],
    'education': ['education', 'learning', 'student', 'course', 'training', 'school'],
    'business': ['business', 'consulting', 'service', 'professional', 'company', 'enterprise'],
  };
  
  let industryCategory = 'business';
  let maxMatches = 0;
  
  for (const [industry, keywords] of Object.entries(industryKeywords)) {
    const matches = keywords.filter(keyword => 
      websiteContent.textContent.toLowerCase().includes(keyword)
    ).length;
    
    if (matches > maxMatches) {
      maxMatches = matches;
      industryCategory = industry;
    }
  }
  
  return {
    domain,
    companyName,
    productDescription,
    toneOfVoice: 'professional', // Would be determined by AI analysis
    suggestedKeywords,
    industryCategory,
    targetAudience: 'business professionals', // Would be determined by AI analysis
    contentStrategy: {
      articleStructure: 'introduction, main points, conclusion',
      maxWords: 800,
      publishingFrequency: 'weekly',
    },
  };
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    // Authentication check
    const { userId } = await auth();
    if (!userId) {
      const response: AnalyzeWebsiteResponse = {
        success: false,
        error: 'Unauthorized',
      };
      return Response.json(response, { status: 401 });
    }

    const body = await request.json() as AnalyzeWebsiteRequest;
    
    if (!body.websiteUrl) {
      const response: AnalyzeWebsiteResponse = {
        success: false,
        error: 'Website URL is required',
      };
      return Response.json(response, { status: 400 });
    }

    // Validate URL format
    try {
      new URL(body.websiteUrl);
    } catch {
      const response: AnalyzeWebsiteResponse = {
        success: false,
        error: 'Invalid URL format',
      };
      return Response.json(response, { status: 400 });
    }

    // Website scraping logic inline
    const websiteContent = await scrapeWebsite(body.websiteUrl);
    
    // AI analysis using simplified logic for now
    const aiAnalysis = await analyzeWebsiteContent(websiteContent);
    
    // Update user record directly
    await db.update(users)
      .set({
        domain: aiAnalysis.domain,
        company_name: aiAnalysis.companyName,
        product_description: aiAnalysis.productDescription,
        keywords: aiAnalysis.suggestedKeywords,
        updatedAt: new Date(),
      })
      .where(eq(users.clerk_user_id, userId));
    
    const response: AnalyzeWebsiteResponse = {
      success: true,
      data: aiAnalysis,
    };
    
    return Response.json(response);
  } catch (error) {
    console.error('Error analyzing website:', error);
    
    const response: AnalyzeWebsiteResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
    
    return Response.json(response, { status: 500 });
  }
}
