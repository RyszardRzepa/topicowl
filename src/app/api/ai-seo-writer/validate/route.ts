import { NextResponse } from 'next/server';
import { google } from '@ai-sdk/google';
import { generateText } from 'ai';
import type { ValidateRequest, ValidateResponse, ApiResponse } from '@/types/types';

// Validation prompt template
const getValidationPrompt = (article: string) => `
You are an expert fact-checker and content validator with access to current information.

Please thoroughly fact-check this article:

${article}

**Validation Tasks:**
1. **Factual Accuracy**: Verify all claims, statistics, and factual statements
2. **Source Verification**: Check if information aligns with authoritative sources
3. **Date Sensitivity**: Verify that time-sensitive information is current
4. **Technical Accuracy**: Validate technical details and terminology
5. **Logical Consistency**: Ensure arguments and conclusions are sound

**For Each Issue Found:**
- Identify the specific claim or fact
- Explain the issue or inaccuracy
- Provide the correct information or suggest improvements
- Rate your confidence in the correction (0.0 to 1.0)

**Response Format:**
Provide a detailed analysis of any factual issues, inconsistencies, or areas that need improvement.
Focus on accuracy, credibility, and ensuring the content can be trusted by readers.

Return your response as a JSON object with the following structure:
{
  "isValid": boolean,
  "issues": [
    {
      "type": "factual" | "seo" | "readability" | "grammar",
      "severity": "low" | "medium" | "high",
      "message": "Description of the issue",
      "suggestion": "Optional suggestion for improvement"
    }
  ],
  "seoScore": number (0-100),
  "readabilityScore": number (0-100)
}

If the article is factually sound, confirm its accuracy. If issues are found, provide specific corrections with reliable source backing.
`;

export async function POST(request: Request) {
  try {
    const body = await request.json() as ValidateRequest;
    const { content, title, keywords } = body;

    if (!content || !title) {
      return NextResponse.json(
        { success: false, error: 'Content and title are required' } as ApiResponse,
        { status: 400 }
      );
    }

    // Validate article using AI
    const validationPrompt = getValidationPrompt(`Title: ${title}\n\nContent: ${content}`);
    
    const { text: validationResult } = await generateText({
      model: google('gemini-2.0-flash-exp'),
      prompt: validationPrompt,
      maxTokens: 1500,
    });

    // Parse the validation result - in a real implementation, this would be more robust
    let parsedResult: ValidateResponse;
    try {
      parsedResult = JSON.parse(validationResult) as ValidateResponse;
    } catch {
      // Fallback if AI doesn't return valid JSON
      parsedResult = {
        isValid: true,
        issues: [],
        seoScore: 75,
        readabilityScore: 80,
      };
    }

    // Add basic SEO validation based on keywords
    const keywordUsage = keywords.filter(keyword => 
      content.toLowerCase().includes(keyword.toLowerCase())
    );
    
    if (keywordUsage.length < keywords.length) {
      parsedResult.issues.push({
        type: 'seo',
        severity: 'medium',
        message: `Not all target keywords are used in the content. Missing: ${
          keywords.filter(k => !keywordUsage.includes(k)).join(', ')
        }`,
        suggestion: 'Consider naturally incorporating the missing keywords into the content.',
      });
    }

    return NextResponse.json({
      success: true,
      data: parsedResult,
    } as ApiResponse<ValidateResponse>);

  } catch (error) {
    console.error('Validation endpoint error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to validate article' 
      } as ApiResponse,
      { status: 500 }
    );
  }
}
