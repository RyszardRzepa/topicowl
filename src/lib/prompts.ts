interface ResearchRequest {
  title: string;
  keywords: string[];
}

interface WriteRequest {
  researchData: string;
  title: string;
  keywords: string[];
  author?: string;
  publicationName?: string;
}

interface Correction {
  fact: string;
  issue: string;
  correction: string;
  confidence: number;
}

export const prompts = {
  research: (title: string, keywords: string[]) => `
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
  `,

  writing: (request: WriteRequest, settings: any, relatedPosts: string[]) => `
    You are an expert SEO content writer specializing in creating high-quality, engaging articles.
    
    **Article Details:**
    - Title: ${request.title}
    - Target Keywords: ${request.keywords.join(', ')}
    - Author: ${request.author || 'Content Team'}
    
    **Research Data:**
    ${request.researchData}
    
    **Content Guidelines:**
    - Tone of Voice: ${settings.toneOfVoice || 'Professional and engaging'}
    - Article Structure: ${settings.articleStructure || 'Introduction, main sections with H2/H3 headings, conclusion'}
    - Target Word Count: ${settings.maxWords || 800} words
    
    **Available Related Posts:**
    ${relatedPosts.length > 0 ? relatedPosts.join(', ') : 'None available'}
    
    **Instructions:**
    1. Create a compelling, SEO-optimized article based on the research data
    2. Use the target keywords naturally throughout the content
    3. Structure the article with clear headings and subheadings
    4. Include actionable insights and practical information
    5. Write in an engaging tone that matches the specified voice
    6. Create a meta description that's compelling and under 160 characters
    7. Generate a URL-friendly slug from the title
    8. If related posts are available, reference them appropriately
    
    Focus on creating valuable, original content that serves the reader's intent while being optimized for search engines.
  `,

  validation: (article: string) => `
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
    
    If the article is factually sound, confirm its accuracy. If issues are found, provide specific corrections with reliable source backing.
  `,

  update: (article: string, corrections: Correction[]) => `
    You are an expert content editor tasked with improving an article based on fact-checking feedback.
    
    **Original Article:**
    ${article}
    
    **Required Corrections:**
    ${corrections.map((correction, index) => `
    ${index + 1}. **Issue**: ${correction.issue}
       **Original Fact**: ${correction.fact}
       **Correction**: ${correction.correction}
       **Confidence**: ${correction.confidence}
    `).join('\n')}
    
    **Instructions:**
    1. Apply all corrections with confidence > 0.7
    2. Maintain the original article structure and tone
    3. Ensure the corrections flow naturally with the existing content
    4. Update any related information that might be affected
    5. Preserve all formatting, headings, and overall organization
    6. Double-check that the corrected information is accurate and well-integrated
    
    Return the complete updated article with all necessary corrections applied seamlessly.
  `,

  schedule: (articleData: any) => `
    Scheduling article: ${articleData.title}
    Status: ${articleData.status}
    Scheduled for: ${articleData.scheduledAt || 'Not scheduled'}
  `
};

export type PromptType = keyof typeof prompts;