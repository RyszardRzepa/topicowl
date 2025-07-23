import { NextResponse } from 'next/server';
import { anthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';
import type { ValidateResponse } from '../validate/route';
import type { ApiResponse } from '@/types/types';

// Types colocated with this API route
export interface UpdateRequest {
  content: string;
  issues: ValidateResponse['issues'];
}

export interface UpdateResponse {
  updatedContent: string;
  fixedIssues: string[];
  remainingIssues: ValidateResponse['issues'];
}

// Update prompt template
const getUpdatePrompt = (article: string, issues: UpdateRequest['issues']) => `
You are an expert content editor tasked with improving an article based on fact-checking feedback.

**Original Article:**
${article}

**Required Corrections:**
${issues.map((issue, index) => `
${index + 1}. **Issue**: ${issue.message}
   **Type**: ${issue.type}
   **Severity**: ${issue.severity}
   **Suggestion**: ${issue.suggestion ?? 'Apply appropriate correction'}
`).join('\n')}

**Instructions:**
1. Apply corrections for all high and medium severity issues
2. Maintain the original article structure and tone
3. Ensure the corrections flow naturally with the existing content
4. Update any related information that might be affected
5. Preserve all formatting, headings, and overall organization
6. Double-check that the corrected information is accurate and well-integrated

Return the complete updated article with all necessary corrections applied seamlessly.
`;

export async function POST(request: Request) {
  try {
    const body = await request.json() as UpdateRequest;
    const { content, issues } = body;

    if (!content || !issues || issues.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Content and issues are required' } as ApiResponse,
        { status: 400 }
      );
    }

    // Filter for high and medium severity issues only
    const significantIssues = issues.filter(issue => 
      issue.severity === 'high' || issue.severity === 'medium'
    );

    if (significantIssues.length === 0) {
      // No significant issues to fix
      return NextResponse.json({
        success: true,
        data: {
          updatedContent: content,
          fixedIssues: [],
          remainingIssues: issues.filter(issue => issue.severity === 'low'),
        },
      } as ApiResponse<UpdateResponse>);
    }

    // Generate updated content using AI
    const updatePrompt = getUpdatePrompt(content, significantIssues);
    
    const { text: updatedContent } = await generateText({
      model: anthropic('claude-3-5-sonnet-20241022'),
      prompt: updatePrompt,
      maxTokens: 4000,
    });

    const response: UpdateResponse = {
      updatedContent: updatedContent.trim(),
      fixedIssues: significantIssues.map(issue => issue.message),
      remainingIssues: issues.filter(issue => issue.severity === 'low'),
    };

    return NextResponse.json({
      success: true,
      data: response,
    } as ApiResponse<UpdateResponse>);

  } catch (error) {
    console.error('Update endpoint error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to update article' 
      } as ApiResponse,
      { status: 500 }
    );
  }
}
