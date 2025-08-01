export const MODELS = {
  GEMINI_FLASH_2_5: "gemini-2.0-flash-exp",
  GEMINI_2_5_FLASH: "gemini-2.5-flash",
  GEMINI_2_5_PRO: "gemini-2.5-pro",
  CLAUDE_SONET_4: "claude-sonnet-4-20250514",
} as const;

// API URL constant for internal API calls
export const API_BASE_URL =
  process.env.NODE_ENV === "development"
    ? "http://localhost:3000"
    : (process.env.NEXT_PUBLIC_BASE_URL ?? `https://${process.env.VERCEL_URL}`);

export const prompts = {
  research: (title: string, keywords: string[]) => `
    <system_prompt>
      <role_definition>
      You are an expert content researcher and SEO specialist. You MUST follow each step sequentially and provide detailed outputs for verification.
      </role_definition>

      <project_parameters>
      <article_title>${title}</article_title>
      <target_keywords>${keywords.join(", ")}</target_keywords>
      <research_objective>Gather comprehensive, citation-ready data optimized for both traditional SEO and modern AI platforms</research_objective>
      </project_parameters>
      </system_prompt>

      <execution_sequence>

      <phase_1>
      <title>SEARCH QUERY DEVELOPMENT</title>
      <requirements>
      Create exactly 5 distinct search query categories
      Generate 3 specific search queries per category
      State research objective for each query
      Explain query relevance to article topic
      </requirements>

      <categories_to_cover>
      Authoritative sources and statistics
      Practical information (hours, prices, locations)
      Expert opinions and quotes
      Recent developments (2023-2025)
      User experiences and reviews
      </categories_to_cover>

      <output_format>
      CATEGORY 1: [Category Name]
      <objective>What you're looking for</objective>
      <queries>
      Query 1: "exact search terms"
      Query 2: "exact search terms" 
      Query 3: "exact search terms"
      </queries>
      <rationale>Why these queries support the article</rationale>

      Repeat for all 5 categories
      </output_format>
      </phase_1>

      <phase_2>
      <title>SYSTEMATIC WEB RESEARCH</title>
      <requirements>Execute minimum 3 searches per query (15 total searches minimum)</requirements>

      <search_protocol>
      For EACH of the 15 queries from Phase 1:
      <steps>
      Perform the web search
      Document the search results
      Extract relevant information
      Note source credibility indicators
      </steps>
      </search_protocol>

      <mandatory_verification>
      After each search, confirm:
      <checklist>
      ✅ Search completed
      ✅ Sources evaluated for authority
      ✅ Data extracted and categorized
      ✅ Citations formatted correctly
      </checklist>
      </mandatory_verification>
      </phase_2>

      <phase_3>
      <title>DATA EXTRACTION AND ORGANIZATION</title>
      <requirements>Organize findings into structured categories</requirements>

      <section_3a>
      <title>AUTHORITATIVE SOURCES</title>
      <minimum_requirement>5-7 sources</minimum_requirement>
      <data_points>
      For each source, provide:
      <source_template>
      <source_name>Official publication/website name</source_name>
      <url>Complete link</url>
      <publication_date>MM/DD/YYYY</publication_date>
      <authority_indicators>Why this source is credible</authority_indicators>
      <key_data_points>Specific statistics, facts, quotes</key_data_points>
      <citation_format>Ready-to-use citation</citation_format>
      </source_template>
      </data_points>
      </section_3a>

      <section_3b>
      <title>PRACTICAL INFORMATION</title>
      <minimum_requirement>5-7 venues/items</minimum_requirement>
      <data_points>
      For each item, extract:
      <item_template>
      <official_name>Exact spelling</official_name>
      <complete_address>Street, city, postal code</complete_address>
      <operating_schedule>Days, hours, exceptions</operating_schedule>
      <current_pricing>Exact amounts with currency and date</current_pricing>
      <capacity_size>Specific numbers with units</capacity_size>
      <contact_information>Phone, website, email</contact_information>
      </item_template>
      </data_points>
      </section_3b>

      <section_3c>
      <title>CONVERSATIONAL DATA</title>
      <purpose>Extract information that answers common user questions and provides practical insights</purpose>
      <data_points>
      For each venue/item, answer:
      <conversational_template>
      <unique_features>What makes it unique - Defining characteristics</unique_features>
      <common_questions>3-5 FAQ with answers</common_questions>
      <best_practices>Insider tips and recommendations</best_practices>
      <seasonal_considerations>Timing advice</seasonal_considerations>
      <target_audience>Demographics and preferences</target_audience>
      </conversational_template>
      </data_points>
      </section_3c>
      </phase_3>

      <phase_4>
      <title>E-E-A-T OPTIMIZATION</title>
      <requirements>Structure data for maximum AI comprehension and search engine trust signals</requirements>

      <eat_categories>
      <expertise_signals>
      <purpose>Demonstrate subject matter knowledge and professional competence</purpose>
      <data_types>
      Expert quotes with full attribution
      Professional recommendations
      Industry statistics with sources
      Technical specifications
      </data_types>
      </expertise_signals>

      <experience_indicators>
      <purpose>Show real-world usage and first-hand knowledge</purpose>
      <data_types>
      First-hand accounts
      User reviews and ratings
      Personal testimonials
      Usage scenarios
      </data_types>
      </experience_indicators>

      <authoritativeness_markers>
      <purpose>Establish content credibility through recognized sources</purpose>
      <data_types>
      Official sources prioritized
      Government data included
      Industry leaders quoted
      Peer-reviewed studies referenced
      </data_types>
      </authoritativeness_markers>

      <trustworthiness_elements>
      <purpose>Build confidence through transparency and accuracy</purpose>
      <data_types>
      Recent publication dates
      Verified information
      Cross-referenced facts
      Transparent sourcing
      </data_types>
      </trustworthiness_elements>
      </eat_categories>
      </phase_4>

      <phase_5>
      <title>YOUTUBE VIDEO RESEARCH</title>
      <requirements>Search YouTube for relevant videos that can enhance the article content</requirements>

      <search_protocol>
      <steps>
      Conduct targeted YouTube searches using article keywords and related terms
      Evaluate video content for relevance, quality, and authority
      Analyze video engagement metrics (views, likes, comments) as credibility indicators
      Assess video recency and creator expertise
      Select only videos that add genuine value to the article topic
      </steps>
      </search_protocol>

      <selection_criteria>
      <video_requirements>
      Video must be directly relevant to article topic
      Creator should have demonstrated expertise or authority in the subject
      Video content should complement, not duplicate, article information
      Video should be recent (2022-2025 preferred) unless covering timeless topics
      Video should have good engagement metrics relative to channel size
      </video_requirements>
      </selection_criteria>

      <output_format>
      For each relevant video found:
      <video_template>
      <video_title>Exact video title</video_title>
      <youtube_url>Complete YouTube URL</youtube_url>
      <creator_name>Channel name or creator</creator_name>
      <relevance_explanation>One sentence explaining why this video is valuable for the article</relevance_explanation>
      <content_summary>Brief summary of key points covered in the video</content_summary>
      </video_template>
      </output_format>
      </phase_5>

      </execution_sequence>

      <output_requirements>

      <final_report_structure>
      <template>
      <report_header>
      <title>CONTENT RESEARCH REPORT</title>
      <article_title>${title}</article_title>
      <keywords>${keywords.join(", ")}</keywords>
      <research_date>Current date</research_date>
      </report_header>

      <executive_summary>
      2-3 sentences summarizing key findings and research insights
      </executive_summary>

      <authoritative_sources>
      List all 5-7 sources with complete citations and credibility assessments
      </authoritative_sources>

      <practical_information_database>
      Structured data for each venue/item with complete details
      </practical_information_database>

      <conversational_insights>
      Q&A formatted content ready for AI optimization and natural language processing
      </conversational_insights>

      <keyword_integration_opportunities>
      Specific recommendations for natural keyword placement and semantic relationships
      </keyword_integration_opportunities>

      <youtube_video_recommendations>
      3-5 relevant YouTube videos with analysis and integration suggestions
      </youtube_video_recommendations>

      <ai_platform_optimization>
      <purpose>Explain how the researched data supports different AI platforms and enhances article discoverability</purpose>
      <platform_benefits>
      <chatgpt>Data structured for conversational responses and follow-up questions</chatgpt>
      <perplexity>Citations and sources formatted for fact-checking and verification</perplexity>
      <claude>Hierarchical information organized for analytical processing</claude>
      <gemini>Multi-format data supporting various query types and contexts</gemini>
      <search_engines>Featured snippet optimization and entity relationship mapping</search_engines>
      </platform_benefits>

      </ai_platform_optimization>
      </template>
      </final_report_structure>

      </output_requirements>

      <quality_control>

      <completion_checklist>
      <requirements>Before submitting, verify you have completed:</requirements>
      <checklist_items>
      Generated exactly 15 search queries (3 per category)
      Executed minimum 15 web searches
      Conducted YouTube video research and analysis
      Collected 5-7 authoritative sources with complete citations
      Gathered practical data for 5-7 specific venues/items
      Selected 3-5 relevant YouTube videos with justification
      Extracted conversational insights for each item
      Structured all data for AI comprehension
      Included recent data (2023-2025 where available)
      Formatted citations correctly
      Organized information hierarchically
      Added entity relationships and context
      </checklist_items>
      </completion_checklist>

      <failure_protocol>
      <title>FAILURE PROTOCOL</title>
      <instructions>If any step cannot be completed:</instructions>
      <steps>
      Document the specific issue
      Explain what alternative approach you took
      Provide reasoning for the substitution
      Continue with remaining steps
      </steps>
      </failure_protocol>

      </quality_control>

      <execution_command>
      <instruction>BEGIN EXECUTION WITH PHASE 1 NOW</instruction>
      </execution_command>
  `,

  writing: (
    data: {
      title: string;
      outlineData: {
        title: string;
        keywords: string[];
        keyPoints: Array<{
          heading: string;
          summary: string;
          relevantLinks: string[];
          videoContext?: string;
        }>;
        totalWords: number;
        videoMatchingSections?: string[];
      };
      coverImage?: string;
      videos?: Array<{
        title: string;
        url: string;
      }>;
    },
    settings?: {
      toneOfVoice?: string;
      articleStructure?: string;
      maxWords?: number;
    },
    relatedPosts?: string[],
  ) => {
    const currentDate = new Date().toISOString().split("T")[0];

    const toneOfVoice = settings?.toneOfVoice;
    const articleStructure = settings?.articleStructure;
    const maxWords = settings?.maxWords;

    return `
<role>
You are senior content writer and editor. Write an original article titled "${data.title}".
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
${relatedPosts && relatedPosts.length > 0 ? relatedPosts.join(", ") : ""}
</related_posts>

${
  data.coverImage
    ? `<cover_image>
A cover image has been selected for this article: ${data.coverImage}
This image should complement the article content and be referenced appropriately in the imageCaption field.
</cover_image>`
    : ""
}

<article_outline>
Use this structured outline to write the article. Each key point should become a major section:

Title: ${data.outlineData.title}
Keywords: ${data.outlineData.keywords?.join(", ") ?? ""}

Key Points to Cover:
${
  data.outlineData.keyPoints
    ?.map(
      (point, index: number) => `
${index + 1}. ${point.heading}
   Summary: ${point.summary}
   ${point.relevantLinks?.length > 0 ? `Relevant Links: ${point.relevantLinks.join(", ")}` : ""}
`,
    )
    .join("") ?? ""
}

Total Outline Words: ${data.outlineData.totalWords ?? 0}
</article_outline>

<writing_instructions>
- Use the outline as your content structure - each key point should be a major section
- Expand each key point summary into detailed, valuable content
- Incorporate the relevant links naturally within the content
- Maintain the logical flow established in the outline
- Ensure each section provides actionable insights and practical information
- Use the outline's keywords strategically throughout the article
</writing_instructions>

${data.videos && data.videos.length > 0 ? `
<video_integration_mandatory>
OPTIONAL ENHANCEMENT: If available videos are highly relevant, include ONE embedded YouTube video in the most contextually appropriate section.

Video Integration Instructions:
1. Analyze available videos for topic relevance to each section
2. Select the SINGLE BEST video that matches article content
3. Choose the MOST APPROPRIATE section for video placement
4. Embed video using this exact format:

## [Section Heading]

[Lead-in content explaining the topic...]

### Video: [Video Title]

[1-2 sentences explaining why this video is valuable for this section]

<div class="video-container">
<iframe width="560" height="315" src="https://www.youtube.com/embed/[VIDEO_ID]" 
        title="[VIDEO_TITLE]" frameborder="0" 
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
        allowfullscreen></iframe>
</div>

[Content that references or builds upon the video content...]

Video Selection Strategy:
- Select ONLY the most relevant video from available options
- Choose the section where video provides maximum educational impact
- Ensure video complements rather than duplicates written content
- Only include video if it genuinely enhances the article

Quality Threshold:
- Only embed video if it's highly relevant to the content
- Video should demonstrate concepts discussed in the text
- Video should be from a credible source
- Video should add clear value to the reader's understanding

Available Videos:
${data.videos.map(v => `- ${v.title}: ${v.url}`).join('\n')}

Section Context Hints:
${data.outlineData.keyPoints?.map(point => 
  point.videoContext ? `- "${point.heading}": Look for videos about ${point.videoContext}` : ''
).filter(Boolean).join('\n')}
</video_integration_mandatory>
` : ''}

<output_format>
Return EXACT JSON complying with blogPostSchema (id, title, slug, excerpt, metaDescription, readingTime, content, author, date, coverImage, imageCaption, tags, relatedPosts).
</output_format>

<final_reminder>
Ensure the article follows the structure and SEO rules above before providing the JSON only.
</final_reminder>
    `;
  },

  validation: (article: string) => `
    <system_prompt>
      <role_definition>
      You are an expert fact-checker. Your task is to identify factual claims in the article, search for verification, and return a structured validation response.
      </role_definition>

      <article_content>
      ${article}
      </article_content>
    </system_prompt>

    <execution_steps>

    <step_1>
    <title>IDENTIFY FACTUAL CLAIMS</title>
    <task>Extract all verifiable factual claims from the article, focusing on:</task>
    <priority_claims>
    - Addresses, locations, and contact information
    - Operating hours, schedules, and availability
    - Prices, costs, and financial information
    - Statistics, numbers, and data points
    - Names of people, places, and organizations
    - Historical facts and dates
    </priority_claims>
    </step_1>

    <step_2>
    <title>CREATE SEARCH QUERIES</title>
    <task>For each claim, create 2 search queries:</task>
    <query_types>
    - Direct search: Verify the exact claim with specific terms
    - Contextual search: Cross-reference with broader context or official sources
    </query_types>
    <search_tips>
    - Use site:official-domain.com for authoritative sources
    - Include current year (2024-2025) for time-sensitive information
    - Use exact names and terminology from the article
    </search_tips>
    </step_2>

    <step_3>
    <title>EXECUTE WEB SEARCHES</title>
    <task>Search for each claim using both queries and evaluate results based on:</task>
    <source_credibility>
    - HIGH: Official websites, government sources, established media, academic institutions
    - MEDIUM: Industry publications, verified business listings, professional organizations  
    - LOW: User-generated content, unverified listings, outdated information
    </source_credibility>
    </step_3>

    <step_4>
    <title>DETERMINE VERIFICATION STATUS</title>
    <verification_levels>
    - VERIFIED: Confirmed by multiple high-credibility sources
    - PARTIALLY VERIFIED: Some credible confirmation but with minor discrepancies
    - UNVERIFIED: Insufficient evidence to confirm or deny
    - CONTRADICTED: Disputed by credible sources with clear contradictory evidence
    </verification_levels>
    </step_4>

    </execution_steps>

    <output_requirements>
    <critical_instruction>
    Return a structured JSON object with the validation results. Do not include search documentation or analysis details.
    </critical_instruction>

    <output_format>
    Return a JSON object with this exact structure:
    {
      "isValid": boolean, // true if no issues found, false if issues exist
      "issues": [
        {
          "fact": "Exact text from article that has an issue",
          "issue": "Brief description of what's wrong",
          "correction": "Suggested correction or 'Needs verification'"
        }
      ]
    }

    Only include issues with UNVERIFIED or CONTRADICTED status.
    If no issues found, return: {"isValid": true, "issues": []}
    </output_format>
    </output_requirements>

    <execution_command>
    Execute all steps systematically, then return ONLY the structured JSON validation results.
    </execution_command>
  `,

  update: (
    article: string,
    correctionsOrValidationText: Array<{
      fact: string;
      issue: string;
      correction: string;
    }> | string,
    settings?: {
      toneOfVoice?: string;
      articleStructure?: string;
      maxWords?: number;
    },
  ) => {
    const currentDate = new Date().toISOString().split("T")[0];

    const toneOfVoice = settings?.toneOfVoice ?? "professional and informative";
    const articleStructure =
      settings?.articleStructure ?? "standard blog structure";
    const maxWords = settings?.maxWords ?? 600;

    const isValidationText = typeof correctionsOrValidationText === 'string';

    return `
<role>
You are a senior content editor and fact-checker. Update the provided article with factual corrections while maintaining the original quality and structure.
</role>

<guidelines>
- Maintain the exact structure: ${articleStructure}
- Preserve tone of voice: ${toneOfVoice}
- Keep length around: ${maxWords} words
- Date: ${currentDate}
- Make ONLY the necessary factual corrections
- Do not change writing style, paragraph structure, or add new content sections
</guidelines>

<seo_preservation>
- Maintain all SEO elements (meta title, description, slug)
- Keep keyword density and placement intact
- Preserve heading structure and hierarchy
- Maintain internal linking strategy
- Keep FAQPage schema structure if present
</seo_preservation>

<original_article>
${article}
</original_article>

${isValidationText ? `
<validation_results>
${correctionsOrValidationText}
</validation_results>

<update_instructions>
1. Review the validation results above
2. If "No factual issues identified", return the article unchanged
3. For each CLAIM with STATUS: UNVERIFIED or CONTRADICTED:
   - Locate the incorrect fact in the original article
   - Research and apply the correct information based on the REASON provided
   - Ensure corrections flow naturally with existing content
   - Maintain the same sentence structure and writing style
4. Preserve all other content exactly as written
5. Keep the same word count (±50 words maximum variance)
6. Ensure all JSON schema fields remain properly formatted
</update_instructions>
` : `
<corrections_required>
Apply these specific factual corrections:
${(correctionsOrValidationText as Array<{fact: string; issue: string; correction: string}>)
  .map(
    (c, index) => `
CORRECTION ${index + 1}:
- Original claim: "${c.fact}"
- Issue identified: ${c.issue}
- Correct information: "${c.correction}"
`,
  )
  .join("")}
</corrections_required>

<update_instructions>
1. Locate each incorrect fact in the original article
2. Replace with the correct information seamlessly
3. Ensure corrections flow naturally with existing content
4. Maintain the same sentence structure and writing style
5. Preserve all other content exactly as written
6. Keep the same word count (±50 words maximum variance)
7. Ensure all JSON schema fields remain properly formatted
</update_instructions>
`}

<quality_control>
Before finalizing, verify:
✅ All corrections have been applied accurately
✅ Writing style and tone remain unchanged
✅ Article structure is preserved
✅ Word count stays within target range
✅ SEO elements are maintained
✅ JSON schema compliance is preserved
✅ No new content sections added
✅ Factual accuracy is improved
</quality_control>

<output_format>
Return EXACT JSON complying with blogPostSchema (id, title, slug, excerpt, metaDescription, readingTime, content, author, date, coverImage, imageCaption, tags, relatedPosts).
</output_format>

<final_reminder>
Focus solely on factual corrections. Do not rewrite, restructure, or add new information. Maintain the article's original voice and flow.
</final_reminder>
    `;
  },


  outline: (title: string, keywords: string[], researchData: string, videos?: Array<{ title: string; url: string }>) => `
<role>
You are an expert content strategist and outline creator. Your task is to transform comprehensive research data into a focused, actionable article outline.
</role>

<article_parameters>
<title>${title}</title>
<keywords>${keywords.join(", ")}</keywords>
<max_words>300</max_words>
</article_parameters>

${videos && videos.length > 0 ? `
<video_integration_requirements>
OPTIONAL: Identify ONE section that would benefit most from video demonstration or explanation.

Video Context Analysis:
- Look for the single most complex concept that benefits from visual explanation
- Identify the primary tutorial, how-to step, or demonstration section
- Consider the most important tool, software, or process discussion
- Select the key practical example or case study that needs visual support

Available Videos from Research:
${videos.map(v => `- ${v.title}: ${v.url}`).join('\n')}

Selection Criteria:
- Choose only ONE section that would benefit most from video demonstration
- Prioritize sections where visual explanation adds maximum value
- Consider sections where expert explanation via video adds most credibility
- Focus on concepts that text alone cannot convey effectively

Mark the single best section in videoContext field with relevant keywords/topics.
</video_integration_requirements>
` : ''}

<task>
Create a concise article outline with exactly 5 key points that will serve as the foundation for article generation. Each key point should be substantial enough to form a major section of the article.
</task>

<research_data>
${researchData}
</research_data>

<outline_requirements>
1. Extract the 5 most important and actionable key points from the research data
2. Each key point should directly relate to the article title and target keywords
3. Provide a concise summary (150-350 characters) for each key point that captures the essential information
4. Include 1-2 relevant links per key point from the research data (when available)
5. Ensure the outline flows logically and covers the topic comprehensively
6. Focus on practical, valuable information that readers can act upon
7. Total outline length must not exceed 300 words
8. CRITICAL: Each summary MUST be between 150-350 characters (count characters, not words!)
${videos && videos.length > 0 ? '9. OPTIONAL: For ONE key point that would benefit most from video demonstration, add videoContext field with relevant keywords/topics' : ''}
</outline_requirements>

<character_counting_guide>
Count characters, not words. For reference:
- 150 characters ≈ "This is a medium-length summary that provides sufficient detail about the topic while staying concise and actionable for readers."
- 350 characters ≈ "This is a longer summary that provides comprehensive detail about the topic while still maintaining readability and staying within the specified character limit. It includes enough information to be valuable to readers seeking actionable insights and practical guidance."
</character_counting_guide>

<output_format>
Return a JSON object with this exact structure:

{
  "title": "${title}",
  "keywords": [${keywords.map((k) => `"${k}"`).join(", ")}],
  "keyPoints": [
    {
      "heading": "Clear, descriptive heading for key point 1",
      "summary": "Concise summary (150-350 characters) explaining what this section covers and why it's important",
      "relevantLinks": ["url1", "url2"]${videos && videos.length > 0 ? ',\n      "videoContext": "Optional: keywords/topics for video demonstration"' : ''}
    },
    {
      "heading": "Clear, descriptive heading for key point 2", 
      "summary": "Concise summary (150-350 characters) explaining what this section covers and why it's important",
      "relevantLinks": ["url1"]${videos && videos.length > 0 ? ',\n      "videoContext": "Optional: keywords/topics for video demonstration"' : ''}
    },
    {
      "heading": "Clear, descriptive heading for key point 3",
      "summary": "Concise summary (150-350 characters) explaining what this section covers and why it's important", 
      "relevantLinks": ["url1", "url2"]${videos && videos.length > 0 ? ',\n      "videoContext": "Optional: keywords/topics for video demonstration"' : ''}
    },
    {
      "heading": "Clear, descriptive heading for key point 4",
      "summary": "Concise summary (150-350 characters) explaining what this section covers and why it's important",
      "relevantLinks": ["url1"]${videos && videos.length > 0 ? ',\n      "videoContext": "Optional: keywords/topics for video demonstration"' : ''}
    },
    {
      "heading": "Clear, descriptive heading for key point 5",
      "summary": "Concise summary (150-350 characters) explaining what this section covers and why it's important",
      "relevantLinks": ["url1", "url2"]${videos && videos.length > 0 ? ',\n      "videoContext": "Optional: keywords/topics for video demonstration"' : ''}
    }
  ],
  "totalWords": 250${videos && videos.length > 0 ? ',\n  "videoMatchingSections": ["heading of section that would benefit from video demonstration"]' : ''}
}
</output_format>

<quality_checklist>
Before finalizing, ensure:
✅ Each key point has a unique, descriptive heading
✅ Summaries are 150-350 characters each
✅ All key points relate to the title and keywords
✅ Relevant links are included where available from research
✅ Total word count is under 300 words
✅ Outline provides comprehensive topic coverage
✅ Information is practical and actionable
✅ Character count verified for each summary (not word count!)
${videos && videos.length > 0 ? '✅ Maximum ONE section identified for video integration (if beneficial)' : ''}
</quality_checklist>

<instruction>
Analyze the research data and create a focused outline that distills the most valuable information into 5 key points. Pay special attention to character limits for summaries. ${videos && videos.length > 0 ? 'Consider if any section would benefit from video demonstration and mark it accordingly.' : ''} Return only the JSON object.
</instruction>
  `,
};
