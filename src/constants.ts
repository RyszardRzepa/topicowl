export const MODELS = {
  GEMINI_FLASH_2_5: 'gemini-2.0-flash-exp',
  GEMINI_2_5_FLASH: 'gemini-2.5-flash',
  GEMINI_2_5_PRO: 'gemini-2.5-pro',
  CLAUDE_SONET_4: "claude-sonnet-4-20250514"
} as const;

// API URL constant for internal API calls
export const API_BASE_URL = process.env.NODE_ENV === "development" ? 'http://localhost:3000': process.env.NEXT_PUBLIC_BASE_URL;

export const prompts = {
  research: (title: string, keywords: string[]) => `
    Act as a Research Assistant for a GEO-optimized (Generative Engine Optimization) blog post.
    Article Title: "${title}"
    Keywords: ${keywords.join(', ')}
    
    Your task is to gather data optimized for both traditional SEO and modern AI platforms (ChatGPT, Perplexity, Claude, Gemini):
    
    1. Research 5-7 relevant sources with AUTHORITATIVE CITATIONS:
       - Include specific source URLs and publication names
       - Gather statistics with exact numbers and sources
       - Find expert quotes from credible authorities
       - Look for recent data (2023-2025 preferred)
    
    2. Focus on PRACTICAL, FACT-BASED information:
       - Operating hours and schedules (exact days/times)
       - Precise addresses with postal codes
       - Current prices with currency and date context
       - Specific features and offerings
       - Capacity details and size specifications
       - Target audience demographics
    
    3. Collect CONVERSATIONAL DATA for 5-7 specific venues/items:
       - What makes each unique? (for definition sections)
       - Common visitor questions and answers
       - Best practices and insider tips
       - Seasonal variations and timing advice
    
    4. Extract and organize with E-E-A-T signals:
       - Venue name with official spelling
       - Main defining characteristic (for featured snippets)
       - Complete schedule with exceptions
       - Full address with neighborhood context
       - Key offerings with specific details
       - Unique features with supporting evidence
       - Expert recommendations with attribution
       - User experience insights
    
    Return structured data optimized for AI comprehension:
    - Use clear hierarchies and descriptive labels
    - Include citation-ready statistics
    - Format for Q&A extraction
    - Add entity relationships and context
    - Focus on answering "what, when, where, how much, who" questions
    
    Keywords focus: ${keywords.join(', ')}
  `,

  writing: (data: { title: string; researchData: string }, settings?: { toneOfVoice?: string; articleStructure?: string; maxWords?: number }, relatedPosts?: string[]) => {
    const currentDate = new Date().toISOString().split('T')[0];

    const toneOfVoice = settings?.toneOfVoice ?? 'Friendly expert, concise, practical.';
    const articleStructure = settings?.articleStructure ??
      'Intro • Why visit • Feature sections (H2) • Quick tips box • Map embed • FAQs • Conclusion';
    const maxWords = settings?.maxWords ?? 800;

    return `
<role>
You are OsloExplore's senior travel editor. Write an original article titled "${data.title}" for international travellers.
</role>

<guidelines>
- Follow this structure exactly: ${articleStructure}
- Tone of voice: ${toneOfVoice}
- Length: around ${maxWords} words
- Date: ${currentDate}
</guidelines>

<seo_best_practices>
- Primary keyword from the title appears in the H1 and first 100 words
- Include 3-5 semantically related keywords in the body
- Meta title ≤ 60 characters and metaDescription 150–160 characters with a call to action
- Slug must be kebab-case without stop words
- Generate FAQPage schema with 2-4 Q&A
</seo_best_practices>

<related_posts>
${relatedPosts && relatedPosts.length > 0
        ? relatedPosts.join(', ')
        : 'No related posts available - you may suggest relevant placeholders like "oslo-attractions", "oslo-food-guide"'}
</related_posts>

Use this research data when writing:
${data.researchData}

<output_format>
Return EXACT JSON complying with blogPostSchema (id, title, slug, excerpt, metaDescription, readingTime, content, author, date, coverImage, imageCaption, tags, relatedPosts).
</output_format>

<final_reminder>
Ensure the article follows the structure and SEO rules above before providing the JSON only.
</final_reminder>
    `;
  },

  validation: (article: string) => `
    Validate this GEO-optimized article for accuracy across multiple AI platforms and traditional search.
    
    COMPREHENSIVE FACT-CHECKING:
    
    1. FACTUAL ACCURACY:
       - Addresses and locations (verify with Google Maps/official sources)
       - Operating hours and schedules (check official websites)
       - Current prices and costs (verify with recent data)
       - Venue names and spellings (check official branding)
       - Contact information (phone, website, social media)
    
    2. CITATION VERIFICATION:
       - Check all statistics and data points against sources
       - Verify publication names and dates
       - Confirm expert quotes and attributions
       - Validate any research claims or studies mentioned
    
    3. AI PLATFORM OPTIMIZATION:
       - Verify question-answer format accuracy
       - Check schema markup suggestions for validity
       - Confirm entity relationships and context
       - Validate conversational language for voice search
    
    4. E-E-A-T SIGNALS:
       - Verify expert credentials and qualifications
       - Check authoritative source citations
       - Confirm first-party research claims
       - Validate local expertise and insights
    
    5. TECHNICAL DETAILS:
       - Capacity and size specifications
       - Seasonal variations and timing
       - Accessibility information
       - Transportation and parking details
    
    Article Content: ${article}
    
    GROUNDING INSTRUCTIONS:
    Search online to verify each factual claim using current information (2024-2025).
    Cross-reference multiple authoritative sources when possible.
    Flag any inconsistencies with confidence levels.
    Focus on details that affect user experience and decision-making.
    
    Only report issues with confidence > 0.7.
    Prioritize corrections that impact:
    - Safety and accessibility
    - Financial decisions (pricing, hours)
    - Travel planning (addresses, timing)
    - AI platform comprehension
  `,

  update: (article: string, corrections: Array<{ fact: string; issue: string; correction: string; confidence: number }>) => `
    Update this blog post with the following corrections while maintaining:
    - The exact same writing style and tone
    - The 600-word limit
    - The paragraph structure
    - The direct, informative voice

    Article: ${article}

    Corrections needed:
    ${corrections.map(c => `- ${c.fact} should be: ${c.correction}`).join('\n')}

    Make only the necessary factual corrections. Do not change the style or add new content.

    Return EXACT JSON complying with blogPostSchema.
  `,
};
