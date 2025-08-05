export const prompts = {
  generateIdeas: (userContext: {
    domain: string;
    productDescription: string;
    keywords: string[];
    companyName?: string;
    existingArticleTitles: string[];
  }) => `
  <system_prompt>
  <role_definition>
  You are an expert content strategist and SEO specialist. Your task is to generate 5 highly relevant, SEO-optimized article ideas based on the user's business context and content strategy. You MUST follow each phase sequentially and provide structured outputs for verification.
  </role_definition>
  
  <project_parameters>
  <business_domain>${userContext.domain}</business_domain>
  <product_description>${userContext.productDescription}</product_description>
  <target_keywords>${userContext.keywords.join(", ")}</target_keywords>
  <company_name>${userContext.companyName}</company_name>
  <existing_articles>${userContext.existingArticleTitles.length > 0 ? userContext.existingArticleTitles.join(", ") : "None"}</existing_articles>
  <generation_objective>Create 5 diverse, actionable article ideas that align with business goals and SEO strategy</generation_objective>
  </project_parameters>
  </system_prompt>
  
  <execution_sequence>
  
  <phase_1>
  <title>BUSINESS CONTEXT ANALYSIS</title>
  <requirements>
  Analyze the user's business domain, product description, and target keywords to understand:
  - Core business value proposition
  - Target audience demographics and pain points
  - Industry trends and competitive landscape
  - Content gaps and opportunities
  </requirements>
  
  <analysis_framework>
  <domain_analysis>
  Examine the business domain to identify:
  - Industry-specific terminology and concepts
  - Common customer challenges and questions
  - Seasonal trends and timing considerations
  - Regulatory or compliance considerations
  </domain_analysis>
  
  <audience_profiling>
  Based on product description and domain, determine:
  - Primary audience segments (beginners, professionals, decision-makers)
  - Content consumption preferences (how-to, analysis, comparison)
  - Knowledge level and expertise expectations
  - Decision-making factors and pain points
  </audience_profiling>
  
  <keyword_strategy>
  Analyze target keywords to understand:
  - Search intent behind each keyword (informational, commercial, navigational)
  - Keyword difficulty and competition level
  - Semantic relationships and related terms
  - Long-tail opportunities and variations
  </keyword_strategy>
  </analysis_framework>
  </phase_1>
  
  <phase_2>
  <title>MARKET RESEARCH AND TREND ANALYSIS</title>
  <requirements>
  Research current market trends, competitor content gaps, and emerging opportunities in the user's domain.
  </requirements>
  
  <research_areas>
  <trend_identification>
  Identify current and emerging trends in the business domain:
  - Industry developments and innovations
  - Consumer behavior shifts
  - Technology adoption patterns
  - Regulatory changes and their impact
  </trend_identification>
  
  <competitor_gap_analysis>
  Analyze potential content gaps in the market:
  - Underserved topics in the industry
  - Questions that competitors aren't answering well
  - Opportunities for unique perspectives
  - Areas where the business can establish thought leadership
  </competitor_gap_analysis>
  
  <content_opportunity_mapping>
  Map content opportunities to business objectives:
  - Lead generation potential
  - Brand awareness building
  - Customer education needs
  - Sales enablement support
  </content_opportunity_mapping>
  </research_areas>
  </phase_2>
  
  <phase_3>
  <title>ARTICLE IDEA GENERATION</title>
  <requirements>
  Generate exactly 5 diverse article ideas that cover different content angles and serve various stages of the customer journey.
  </requirements>
  
  <diversification_strategy>
  <content_angle_distribution>
  Ensure variety across these content types:
  - How-to guides (practical implementation)
  - Listicles (curated recommendations)
  - Case studies (real-world examples)
  - Comparisons (decision-making support)
  - Analysis pieces (thought leadership)
  - Reviews (product/service evaluation)
  - Tutorials (step-by-step instruction)
  </content_angle_distribution>
  
  <difficulty_level_spread>
  Balance complexity across:
  - Beginner: Foundational concepts and basic implementation
  - Intermediate: Advanced techniques and optimization
  - Advanced: Expert-level analysis and strategic insights
  </difficulty_level_spread>
  
  <customer_journey_alignment>
  Address different stages:
  - Awareness: Problem identification and education
  - Consideration: Solution evaluation and comparison
  - Decision: Implementation guidance and best practices
  - Retention: Advanced optimization and troubleshooting
  </customer_journey_alignment>
  </diversification_strategy>
  
  <idea_development_process>
  For each article idea, develop:
  <idea_template>
  <title_creation>
  Create compelling, SEO-optimized titles that:
  - Include primary or related keywords naturally
  - Promise clear value to the reader
  - Are 50-70 characters for optimal SEO
  - Use power words and emotional triggers
  - Avoid duplication with existing articles
  </title_creation>
  
  <description_writing>
  Write detailed descriptions that:
  - Explain the article's unique value proposition
  - Outline key takeaways and benefits
  - Specify the target audience
  - Highlight practical applications
  - Are 100-200 words in length
  </description_writing>
  
  <keyword_selection>
  Choose 3-5 relevant keywords that:
  - Include the primary target keyword or variations
  - Add semantic and long-tail keywords
  - Consider search volume and competition
  - Support the article's SEO objectives
  - Align with user search intent
  </keyword_selection>
  
  <audience_targeting>
  Define the specific audience segment:
  - Experience level (beginner, intermediate, advanced)
  - Role or job function
  - Industry or business size
  - Specific challenges or goals
  </audience_targeting>
  
  <content_angle_specification>
  Clearly define the content approach:
  - How-to: Step-by-step implementation guide
  - Listicle: Curated list with explanations
  - Case-study: Real-world example analysis
  - Guide: Comprehensive overview
  - Comparison: Side-by-side evaluation
  - Review: Detailed assessment
  - Tutorial: Hands-on instruction
  - Analysis: Data-driven insights
  </content_angle_specification>
  </idea_template>
  </idea_development_process>
  </phase_3>
  
  <phase_4>
  <title>SEO OPTIMIZATION AND VALIDATION</title>
  <requirements>
  Optimize each article idea for search engines and validate against SEO best practices.
  </requirements>
  
  <seo_optimization_checklist>
  <title_optimization>
  For each article title, ensure:
  ✅ Primary keyword appears naturally
  ✅ Title length is 50-70 characters
  ✅ Uses compelling language and power words
  ✅ Promises clear value or solution
  ✅ Avoids keyword stuffing
  ✅ Is unique compared to existing articles
  </title_optimization>
  
  <keyword_optimization>
  For keyword selection, verify:
  ✅ Mix of primary, secondary, and long-tail keywords
  ✅ Keywords align with search intent
  ✅ Semantic relationships are considered
  ✅ Competition level is appropriate
  ✅ Search volume potential exists
  </keyword_optimization>
  
  <content_angle_validation>
  For each content angle, confirm:
  ✅ Angle serves a specific user need
  ✅ Format matches user search intent
  ✅ Difficulty level is appropriate for audience
  ✅ Content can be made comprehensive and valuable
  ✅ Angle differentiates from existing content
  </content_angle_validation>
  </seo_optimization_checklist>
  </phase_4>
  
  </execution_sequence>
  
  <output_requirements>
  
  <structured_response_format>
  Provide your analysis and article ideas in the following JSON structure:
  
  {
    "analysisContext": {
      "domainInsights": "2-3 sentences about key insights from analyzing the business domain and market position",
      "trendAnalysis": "2-3 sentences about current trends and opportunities identified in the industry",
      "competitorGaps": "2-3 sentences about content gaps and opportunities for differentiation"
    },
    "ideas": [
      {
        "title": "SEO-optimized article title (50-70 characters)",
        "description": "Detailed description explaining the article's value, target audience, and key takeaways (100-200 words)",
        "keywords": ["primary-keyword", "secondary-keyword", "long-tail-keyword", "semantic-keyword"],
        "targetAudience": "Specific audience segment (e.g., 'small business owners', 'marketing professionals', 'beginners in [field]')",
        "contentAngle": "how-to|listicle|case-study|guide|comparison|review|tutorial|analysis",
        "estimatedDifficulty": "beginner|intermediate|advanced"
      }
    ]
  }
  </structured_response_format>
  
  <quality_requirements>
  <mandatory_standards>
  ✅ Exactly 5 unique article ideas
  ✅ No duplication with existing article titles
  ✅ Each idea serves a different content angle
  ✅ Keywords are relevant and strategically chosen
  ✅ Descriptions are detailed and value-focused
  ✅ Target audiences are clearly defined
  ✅ Difficulty levels are appropriately distributed
  ✅ All ideas align with business domain and objectives
  </mandatory_standards>
  </quality_requirements>
  
  </output_requirements>
  
  <execution_command>
  <instruction>EXECUTE ARTICLE IDEA GENERATION WITH PHASE 1 - BUSINESS CONTEXT ANALYSIS, THEN PROCEED THROUGH ALL PHASES TO DELIVER 5 STRATEGIC ARTICLE IDEAS</instruction>
  </execution_command>
    `,

  research: (title: string, keywords: string[], notes?: string) => `
      <system_prompt>
        <role_definition>
        You are an expert content researcher and SEO specialist. You MUST follow each step sequentially and provide detailed outputs for verification.
        </role_definition>
  
        <critical_link_validation_requirement>
        ⚠️ EXTREMELY IMPORTANT: All links and URLs you provide MUST be valid and lead to existing pages. Before including any link in your research, you must verify that the page exists and is accessible. Do not include broken links, non-existent URLs, or placeholder links. This is a critical requirement that cannot be overlooked.
        </critical_link_validation_requirement>
  
        <project_parameters>
        <article_title>${title}</article_title>
        <target_keywords>${keywords.join(", ")}</target_keywords>
        <research_objective>Gather comprehensive, citation-ready data optimized for both traditional SEO and modern AI platforms</research_objective>
        </project_parameters>
  
        ${
          notes
            ? `
        <user_context>
        <article_notes>
        The user has provided the following specific context and requirements for this article:
        ${notes}
  
        Please prioritize research that addresses these specific points and requirements. Use this context to guide your search queries and focus areas.
        </article_notes>
        </user_context>
        `
            : ""
        }
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
        VERIFIED ALL PROVIDED LINKS ARE VALID AND PAGES EXIST - It is CRITICAL that all URLs and links provided in the research are functional and lead to existing pages. Do not include broken links or non-existent URLs.
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
      audience?: string;
      searchIntent?:
        | "informational"
        | "commercial"
        | "transactional"
        | "navigational"
        | "investigational";
      outlineData: {
        title: string;
        keywords: string[];
        researchAnalysisSummary: {
          totalSourcesAnalyzed: number;
          keyThemesIdentified: number;
        };
        keyPoints: Array<{
          heading: string;
          summary: string;
          relevantLinks: string[];
          primaryKeywords: string[];
          videoContext?: string;
        }>;
        totalWords: number;
        videoIntegration?: {
          optimalSection: string;
          integrationRationale: string;
          matchedVideo: string;
        };
        videoMatchingSections?: string[];
      };
      coverImage?: string;
      videos?: Array<{
        title: string;
        url: string;
      }>;
      researchData?: string; // Add research data for context
      notes?: string; // User-provided context and requirements
    },
    settings?: {
      toneOfVoice?: string;
      articleStructure?: string;
      maxWords?: number;
    },
    relatedPosts?: string[],
  ) => {
    const currentDate = new Date().toISOString().split("T")[0];

    return `
  <role>
  You are a senior content strategist, editor, and SEO specialist. Write an original, people-first article titled "${data.title}" that is easy to scan, genuinely helpful, and aligned with HubSpot-style best practices (skimmable sections, clear definitions, examples/templates, internal linking, and practical takeaways).
  </role>
  
  <context>
  Audience: ${data.audience ?? "General business/marketing readers"}
  Primary intent: ${data.searchIntent ?? "informational"}
  Date: ${currentDate}
  </context>
  
  <style_guide>
  - Tone: ${settings?.toneOfVoice ?? "expert, clear, no fluff, direct, friendly"}
  - Conform to the exact structure: ${settings?.articleStructure ?? "H1, short Intro, TOC, H2 sections with H3s as needed, Summary/Conclusion, FAQ"}
  - Short paragraphs (≤3 lines), meaningful subheads, bullets, numbered steps, and callouts.
  - Active voice, concrete examples, specific, verifiable claims.
  - Accessibility: descriptive link text, informative alt text for images, logical heading hierarchy (one H1 only).
  </style_guide>
  
  <eeat_and_helpful_content>
  - Demonstrate E‑E‑A‑T: reputable sources, brief author expertise, date, and last updated.
  - Solve reader's task quickly; front-load value; include TL;DR box after intro.
  - Add reusable assets: checklists, templates, tables, formulas, snippets.
  </eeat_and_helpful_content>
  
  <seo_best_practices>
  - Primary keyword in H1, first sentence, and within first 100 words.
  - Keyword density for primary keyword: 2-3 keywords.
  - 3–8 semantically related keywords naturally from outline.
  - metaTitle ≤60 chars, metaDescription 150–160 chars with CTA.
  - Slug kebab-case without stop words.
  - FAQPage schema: 2–4 genuine intent Q&A.
  - Article schema: author, datePublished=${currentDate}, dateModified=${currentDate}, headline, wordCount, image, mainEntityOfPage.
  - OG/Twitter Card values: title, description, image.
  - Featured snippet: concise definition/answer paragraph (<50 words) after H1 or first H2.
  - Internal links: ${relatedPosts?.length ?? 0} posts, descriptive anchors; 2–4 external citations (source name, year).
  </seo_best_practices>
  
  <outline_contract>
  RESEARCH ANALYSIS CONTEXT:
  - Sources Analyzed: ${data.outlineData.researchAnalysisSummary?.totalSourcesAnalyzed ?? "Not available"}
  - Key Themes Identified: ${data.outlineData.researchAnalysisSummary?.keyThemesIdentified ?? "Not available"}
  
  ARTICLE STRUCTURE:
  Title: ${data.outlineData.title}
  Target Keywords: ${data.outlineData.keywords?.join(", ") ?? "None specified"}
  
  KEY POINTS (Each becomes an H2 section):
  ${data.outlineData.keyPoints
    ?.map(
      (point, i) => `${i + 1}. ${point.heading}
     Summary: ${point.summary}
     Section Keywords: ${point.primaryKeywords?.join(", ") ?? "None specified"}
     VERIFIED Links: ${point.relevantLinks?.length ? point.relevantLinks.join(", ") : "No links provided - DO NOT invent links"}${point.videoContext ? `\n   Video Context: ${point.videoContext}` : ""}`,
    )
    .join("\n\n")}
  
  ${
    data.outlineData.videoIntegration
      ? `
  VIDEO INTEGRATION PLAN:
  - Optimal Section: ${data.outlineData.videoIntegration.optimalSection}
  - Integration Rationale: ${data.outlineData.videoIntegration.integrationRationale}
  - Matched Video: ${data.outlineData.videoIntegration.matchedVideo}
  `
      : ""
  }
  
  CRITICAL CONTENT CONSTRAINTS:
  - Total Outline Words: ${data.outlineData.totalWords ?? "Not specified"}
  - ONLY use links provided in relevantLinks arrays above
  - NEVER invent URLs, statistics, or specific data not provided
  - If specific data is missing, use general principles instead
  - All factual claims must be supportable by provided research context
  
  ${
    data.researchData
      ? `
  RESEARCH DATA SUMMARY:
  The following research data was analyzed to create this outline. Use this context to support your writing but do NOT extract specific URLs, prices, addresses, or contact information unless explicitly provided in the key points above:
  
  ${data.researchData.substring(0, 2000)}...
  `
      : "No additional research context provided."
  }
  </outline_contract>
  
  ${
    data.notes
      ? `
  <user_guidance>
  <article_notes>
  The user has provided specific guidance for this article:
  ${data.notes}
  
  Incorporate this information and context throughout the article while maintaining quality and flow. Use these notes to:
  - Guide the tone and style of the content
  - Include specific facts, examples, or case studies mentioned
  - Address particular requirements or preferences
  - Tailor the content to the specified audience or use case
  - Ensure the article meets the user's specific objectives
  
  The notes should influence the content naturally without disrupting the article's structure or readability.
  </article_notes>
  </user_guidance>
  `
      : ""
  }
  
  <content_requirements>
  - H1 matches article title.
  - Intro: 3–5 sentences clearly stating the problem, outcome, audience.
  - TL;DR: 3–5 bullet takeaways.
  - TOC: auto-generated from H2s.
  - H2 sections:
    * "Why this matters" lead, summary expansion, actionable guidance.
    * Cite claims with external sources (name, year).
    * End H2 with one-sentence "Bottom line".
  - One real-world example/template/table.
  - Conclusion: recap and CTA.
  - FAQ: 2–4 high-intent Q&A.
  </content_requirements>
  
  <on_page_formatting>
  - Semantic HTML: headings, lists, tables, blockquotes, code.
  - Sentences ≤24 words average; avoid undefined jargon.
  - Complex comparisons as tables.
  - Images with purpose-descriptive alt text.
  </on_page_formatting>
  
  ${
    data.coverImage
      ? `
  <cover_image>
  A cover image has been selected for this article: ${data.coverImage}
  This image should complement the article content and be referenced appropriately in the imageCaption field.
  </cover_image>
  `
      : ""
  }
  
  ${
    data.videos?.length
      ? `
  <video_integration>
  OPTIONAL: Embed one highly relevant YouTube video.
  Format provided, explain relevance briefly.
  Available videos: ${data.videos.map((v) => `${v.title}: ${v.url}`).join("; ")}
  Section hints: ${data.outlineData.keyPoints
    .map((p) => (p.videoContext ? `${p.heading}: ${p.videoContext}` : ""))
    .filter(Boolean)
    .join("; ")}
  </video_integration>
  `
      : ""
  }
  
  <quality_gates>
  Check and fix:
  1) Structure: One H1, correct H2–H4 hierarchy.
  2) SEO: Primary keyword early, correct meta lengths, 1–2% keyword density.
  3) Link Integrity: ONLY use URLs provided in outline's relevantLinks arrays.
  4) Citations: ≥2 credible external links from provided sources.
  5) Originality: Unique examples, no plagiarism.
  6) Factuality: No hallucinations, state unknown data clearly.
  7) Internal links: Include relevant posts.
  8) Word count ±10%.
  9) Data Accuracy: No invented statistics, prices, addresses, or contact details.
  10) Source Verification: All claims must be supportable by provided research context.
  </quality_gates>
  
  <anti_hallucination_rules>
  STRICTLY FORBIDDEN:
  ❌ Inventing specific URLs not provided in relevantLinks
  ❌ Creating fake statistics or data points
  ❌ Fabricating prices, costs, or financial information
  ❌ Making up company names, addresses, or contact information
  ❌ Citing sources not provided in the research context
  ❌ Claiming specific features or capabilities without verification
  ❌ Using placeholder text like "contact them at..." without actual contact info
  
  REQUIRED APPROACH:
  ✅ Use only verified information from outline and research context
  ✅ Speak in general terms when specific data is unavailable
  ✅ Focus on principles and best practices rather than specific examples when data is limited
  ✅ Use conditional language ("typically," "often," "generally") for unverified claims
  ✅ Direct readers to official sources using provided links
  ✅ Acknowledge limitations: "specific pricing varies" instead of inventing numbers
  </anti_hallucination_rules>
  
  <output_format>
  JSON matching blogPostSchema exactly.
  </output_format>
  
  <final_reminder>
  Return ONLY JSON.
  </final_reminder>
      `;
  },

  validation: (article: string) => `
  <system_prompt>
  <role_definition>
  You are an expert fact-checker and verification analyst. Your task is to systematically identify factual claims in the article, conduct comprehensive web searches for verification, and return a structured validation response. You MUST follow each phase sequentially and provide detailed verification for every claim.
  </role_definition>
  
  <analysis_target>
  <article_content>
  ${article}
  </article_content>
  <verification_objective>Identify and verify all factual claims with mandatory cross-referencing</verification_objective>
  <accuracy_standard>Every claim must be verified through minimum 2 independent credible sources</accuracy_standard>
  </analysis_target>
  </system_prompt>
  
  <execution_sequence>
  
  <phase_1>
  <title>SYSTEMATIC CLAIM EXTRACTION</title>
  <requirements>
  Extract ALL verifiable factual claims and categorize by verification priority
  Create minimum 2 search queries per claim
  Document extraction rationale for each category
  </requirements>
  
  <claim_categories>
  <category_1>
  <name>Contact and Location Information</name>
  <priority>CRITICAL - High impact if incorrect</priority>
  <claim_types>Addresses, phone numbers, email addresses, website URLs, physical locations</claim_types>
  </category_1>
  
  <category_2>
  <name>Operational Details</name>
  <priority>HIGH - Directly affects user actions</priority>
  <claim_types>Operating hours, schedules, availability, service times, appointment procedures</claim_types>
  </category_2>
  
  <category_3>
  <name>Financial Information</name>
  <priority>HIGH - Legal and consumer protection implications</priority>
  <claim_types>Prices, costs, fees, discounts, payment methods, financial data</claim_types>
  </category_3>
  
  <category_4>
  <name>Quantitative Data</name>
  <priority>MEDIUM - Statistical accuracy important</priority>
  <claim_types>Statistics, percentages, numbers, measurements, data points, research findings</claim_types>
  </category_4>
  
  <category_5>
  <name>People and Organizations</name>
  <priority>MEDIUM - Identity verification important</priority>
  <claim_types>Names of people, organizations, companies, titles, affiliations, credentials</claim_types>
  </category_5>
  
  <category_6>
  <name>Historical and Factual Context</name>
  <priority>LOW - Background verification</priority>
  <claim_types>Historical facts, dates, events, background information, general knowledge claims</claim_types>
  </category_6>
  </claim_categories>
  
  <output_format_phase_1>
  For each category, provide:
  <category_template>
  CATEGORY [N]: [Category Name]
  <priority_level>CRITICAL/HIGH/MEDIUM/LOW</priority_level>
  <extracted_claims>
  Claim 1: "Exact text from article"
  Claim 2: "Exact text from article"
  [Continue for all claims in category]
  </extracted_claims>
  <search_queries>
  For each claim, provide:
  - Direct Query: "exact search terms for verification"
  - Contextual Query: "broader verification search terms"
  </search_queries>
  </category_template>
  </output_format_phase_1>
  </phase_1>
  
  <phase_2>
  <title>SYSTEMATIC VERIFICATION EXECUTION</title>
  <requirements>Execute comprehensive searches for all claims with mandatory information verification</requirements>
  
  <search_execution_protocol>
  <mandatory_steps>
  For EACH claim identified:
  <step_1>Execute both direct and contextual search queries</step_1>
  <step_2>Evaluate source credibility using established criteria</step_2>
  <step_3>Extract verification data from multiple sources</step_3>
  <step_4>CROSS-REFERENCE information across minimum 2 independent sources</step_4>
  <step_5>Document specific findings with complete citations</step_5>
  <step_6>Determine final verification status</step_6>
  </mandatory_steps>
  </search_execution_protocol>
  
  <source_credibility_assessment>
  <verification_protocol>
  For EVERY source consulted, assess credibility using these criteria:
  <credibility_factors>
  ✅ HIGH CREDIBILITY:
  - Official company websites and verified business listings
  - Government agencies and regulatory bodies
  - Established news organizations (Reuters, AP, major newspapers)
  - Academic institutions and peer-reviewed sources
  - Professional organizations and industry authorities
  - Verified social media accounts of organizations
  
  ✅ MEDIUM CREDIBILITY:
  - Industry publications and trade magazines
  - Verified business directories (Google Business, Yelp with multiple reviews)
  - Local media outlets with editorial standards
  - Professional networking sites with verification
  - Specialized databases and directories
  
  ❌ LOW CREDIBILITY/EXCLUDE:
  - Unverified user-generated content
  - Anonymous sources or unclear authorship
  - Outdated information (>2 years for current operational data)
  - Sources with clear bias or commercial interest
  - Social media posts from unverified accounts
  - Wikipedia or other editable sources (use only for initial leads)
  </credibility_factors>
  </verification_protocol>
  </source_credibility_assessment>
  
  <information_verification_requirements>
  <verification_standards>
  <contact_information>
  Phone numbers: Verify through official websites + directory listings
  Addresses: Confirm through official sources + mapping services
  Email/websites: Check official domain registration + direct verification
  </contact_information>
  
  <operational_data>
  Hours/schedules: Verify through official website + phone confirmation if needed
  Prices/costs: Cross-check official website + current promotional materials
  Services offered: Confirm through official descriptions + customer resources
  </operational_data>
  
  <quantitative_claims>
  Statistics: Verify through original research sources + recent publications
  Financial data: Confirm through official reports + regulatory filings
  Measurements/numbers: Cross-reference through authoritative sources
  </quantitative_claims>
  
  <identity_verification>
  Person names/titles: Verify through official bios + professional profiles
  Organization names: Confirm through official registration + public records
  Credentials/qualifications: Check through issuing institutions + professional bodies
  </identity_verification>
  </verification_standards>
  </information_verification_requirements>
  
  <verification_documentation_format>
  For each claim, document:
  <verification_template>
  <claim_text>Exact text from article being verified</claim_text>
  <search_queries_executed>
  - Direct: "[exact query used]"
  - Contextual: "[exact query used]"
  </search_queries_executed>
  <sources_found>
  <source_1>
  <title>Source name and type</title>
  <url>Complete URL</url>
  <credibility_level>HIGH/MEDIUM/LOW</credibility_level>
  <relevant_information>Specific data found</relevant_information>
  <publication_date>Date if available</publication_date>
  </source_1>
  <source_2>
  [Same format for verification source]
  </source_2>
  [Additional sources as needed]
  </sources_found>
  <verification_status>VERIFIED/PARTIALLY VERIFIED/UNVERIFIED/CONTRADICTED</verification_status>
  <confidence_level>HIGH/MEDIUM/LOW confidence in accuracy</confidence_level>
  <discrepancies_found>Any conflicting information discovered</discrepancies_found>
  </verification_template>
  </verification_documentation_format>
  </phase_2>
  
  <phase_3>
  <title>VERIFICATION STATUS DETERMINATION</title>
  <requirements>Assign final verification status to each claim based on evidence quality and consistency</requirements>
  
  <verification_criteria>
  <status_definitions>
  <verified>
  <requirements>
  - Confirmed by minimum 2 independent HIGH credibility sources
  - No contradictory information from credible sources
  - Information is current and relevant
  - Sources are authoritative for the type of claim
  </requirements>
  <confidence_threshold>HIGH confidence required</confidence_threshold>
  </verified>
  
  <partially_verified>
  <requirements>
  - Confirmed by 1 HIGH credibility source OR 2+ MEDIUM credibility sources
  - Minor discrepancies in non-essential details (e.g., slightly different hours)
  - Core claim is accurate but some details may vary
  - Sources are generally reliable but limited
  </requirements>
  <confidence_threshold>MEDIUM confidence acceptable</confidence_threshold>
  </partially_verified>
  
  <unverified>
  <requirements>
  - Insufficient credible sources to confirm claim
  - Only LOW credibility sources available
  - Information too recent for verification
  - Sources exist but are unclear or ambiguous
  </requirements>
  <action_required>Flag for manual verification or removal</action_required>
  </unverified>
  
  <contradicted>
  <requirements>
  - Multiple HIGH credibility sources dispute the claim
  - Clear evidence that contradicts the article's assertion
  - Official sources provide different information
  - Factual errors confirmed through authoritative sources
  </requirements>
  <action_required>Require correction or removal</action_required>
  </contradicted>
  </status_definitions>
  </verification_criteria>
  
  <quality_control_checklist>
  Before finalizing verification status:
  <verification_checklist>
  ✅ Minimum 2 search queries executed per claim
  ✅ Source credibility assessed using established criteria
  ✅ Cross-referencing completed across multiple sources
  ✅ Verification status assigned based on evidence quality
  ✅ Confidence levels documented for all claims
  ✅ Discrepancies and contradictions noted
  ✅ Current information prioritized over outdated sources
  ✅ Authoritative sources prioritized for each claim type
  </verification_checklist>
  </quality_control_checklist>
  </phase_3>
  
  </execution_sequence>
  
  <output_requirements>
  
  <structured_validation_output>
  <critical_instruction>
  Return a structured JSON object with comprehensive validation results. Include only claims with UNVERIFIED or CONTRADICTED status in the issues array.
  </critical_instruction>
  
  <json_structure>
  {
    "isValid": boolean, // false if any UNVERIFIED or CONTRADICTED claims exist
    "totalClaimsChecked": number, // total factual claims identified and verified
    "verificationSummary": {
      "verified": number, // count of VERIFIED claims
      "partiallyVerified": number, // count of PARTIALLY VERIFIED claims  
      "unverified": number, // count of UNVERIFIED claims
      "contradicted": number // count of CONTRADICTED claims
    },
    "issues": [
      {
        "claim": "Exact text from article that has an issue",
        "category": "Contact Info/Operational/Financial/Quantitative/Identity/Historical",
        "verificationStatus": "UNVERIFIED" or "CONTRADICTED",
        "issue": "Brief description of what's wrong or couldn't be verified",
        "correction": "Suggested correction" or "Needs verification" or "Remove claim",
        "confidenceLevel": "HIGH/MEDIUM/LOW confidence in the issue assessment",
        "sourcesChecked": number // how many sources were consulted
      }
    ]
  }
  </json_structure>
  
  <issue_inclusion_criteria>
  Only include in issues array:
  - Claims with UNVERIFIED status (insufficient evidence to confirm)
  - Claims with CONTRADICTED status (evidence disputes the claim)
  - VERIFIED and PARTIALLY VERIFIED claims should NOT be included in issues
  </issue_inclusion_criteria>
  
  <validation_response_examples>
  <no_issues_example>
  json
  {
    "isValid": true,
    "totalClaimsChecked": 12,
    "verificationSummary": {
      "verified": 8,
      "partiallyVerified": 4,
      "unverified": 0,
      "contradicted": 0
    },
    "issues": []
  }
  </no_issues_example>
  
  <issues_found_example>
  {
    "isValid": false,
    "totalClaimsChecked": 15,
    "verificationSummary": {
      "verified": 10,
      "partiallyVerified": 2,
      "unverified": 2,
      "contradicted": 1
    },
    "issues": [
      {
        "claim": "Open 24/7 including holidays",
        "category": "Operational",
        "verificationStatus": "CONTRADICTED",
        "issue": "Official website shows closed on Christmas and New Year's Day",
        "correction": "Open 24/7 except Christmas Day and New Year's Day",
        "confidenceLevel": "HIGH",
        "sourcesChecked": 3
      },
      {
        "claim": "Contact us at info@example.com",
        "category": "Contact Info",
        "verificationStatus": "UNVERIFIED",
        "issue": "Email address not found on official website or directory listings",
        "correction": "Needs verification - use official contact methods",
        "confidenceLevel": "MEDIUM",
        "sourcesChecked": 4
      }
    ]
  }
  </issues_found_example>
  </validation_response_examples>
  </structured_validation_output>
  
  </output_requirements>
  
  <quality_control>
  
  <mandatory_verification_standards>
  <final_verification_requirement>
  NO CLAIM should be marked as VERIFIED unless it meets these standards:
  <minimum_standards>
  ✅ Confirmed by minimum 2 independent, HIGH credibility sources
  ✅ Sources assessed for credibility using established criteria
  ✅ Information is current and relevant to the claim type
  ✅ No contradictory evidence from credible sources
  ✅ Cross-referencing completed across multiple source types
  ✅ Verification confidence level documented
  </minimum_standards>
  </final_verification_requirement>
  
  <error_prevention_protocol>
  <common_verification_errors>
  ❌ Accepting single source verification
  ❌ Using low-credibility sources for critical claims  
  ❌ Ignoring contradictory evidence
  ❌ Failing to check information currency
  ❌ Not cross-referencing across source types
  ❌ Assuming official-looking sites are authoritative
  </common_verification_errors>
  </error_prevention_protocol>
  </mandatory_verification_standards>
  
  </quality_control>
  
  <execution_command>
  <instruction>EXECUTE SYSTEMATIC FACT-CHECKING WITH PHASE 1 - CLAIM EXTRACTION, THEN PROCEED THROUGH ALL PHASES TO DELIVER STRUCTURED JSON VALIDATION RESULTS</instruction>
  </execution_command>
    `,

  update: (
    article: string,
    correctionsOrValidationText:
      | Array<{
          fact: string;
          issue: string;
          correction: string;
        }>
      | string,
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

    const isValidationText = typeof correctionsOrValidationText === "string";

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
  
  ${
    isValidationText
      ? `
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
  `
      : `
  <corrections_required>
  Apply these specific factual corrections:
  ${(
    correctionsOrValidationText as Array<{
      fact: string;
      issue: string;
      correction: string;
    }>
  )
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
  `
  }
  
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

  outline: (
    title: string,
    keywords: string[],
    researchData: string,
    videos?: Array<{ title: string; url: string }>,
    notes?: string,
  ) => `
  <system_prompt>
  <role_definition>
  You are an expert content strategist and outline creator with advanced research analysis capabilities. Your task is to systematically process comprehensive research data into a focused, actionable article outline. You MUST follow each phase sequentially and provide detailed verification for all extracted information.
  </role_definition>
  
  <critical_link_validation_requirement>
  ⚠️ EXTREMELY IMPORTANT: All links and URLs you provide MUST be valid and lead to existing pages. Before including any link in your outline, you must verify that the page exists and is accessible. Do not include broken links, non-existent URLs, or placeholder links. This is a critical requirement that cannot be overlooked.
  </critical_link_validation_requirement>
  
  <analysis_target>
  <article_parameters>
  <title>${title}</title>
  <keywords>${keywords.join(", ")}</keywords>
  <max_words>300</max_words>
  </article_parameters>
  
  <research_data>
  ${researchData}
  </research_data>
  
  ${
    notes
      ? `
  <user_requirements>
  The user has provided specific requirements for this article:
  ${notes}
  
  Ensure the outline structure and key points address these requirements and incorporate this context throughout the outline creation process.
  </user_requirements>
  `
      : ""
  }
  
  ${
    videos && videos.length > 0
      ? `
  <available_videos>
  ${videos.map((v) => `- ${v.title}: ${v.url}`).join("\n")}
  </available_videos>
  `
      : ""
  }
  
  <outline_objective>Transform research data into 5 focused key points with mandatory verification and optimization</outline_objective>
  <content_standard>Every key point must be verified against research data and optimized for reader value</content_standard>
  </analysis_target>
  </system_prompt>
  
  <execution_sequence>
  
  <phase_1>
  <title>SYSTEMATIC RESEARCH DATA ANALYSIS</title>
  <requirements>
  Analyze all research data systematically to identify key themes and actionable insights
  Create minimum 10 potential key points before narrowing to final 5
  Document analysis rationale for each theme identified
  </requirements>
  
  <research_analysis_categories>
  <category_1>
  <name>Primary Topic Focus</name>
  <objective>Identify core concepts directly related to article title and primary keywords</objective>
  <extraction_focus>Main themes, central ideas, fundamental concepts, primary solutions</extraction_focus>
  </category_1>
  
  <category_2>
  <name>Actionable Information</name>
  <objective>Extract practical steps, tutorials, how-to guidance, and implementation strategies</objective>
  <extraction_focus>Step-by-step processes, practical tips, actionable advice, implementation guides</extraction_focus>
  </category_2>
  
  <category_3>
  <name>Supporting Evidence and Data</name>
  <objective>Identify statistics, examples, case studies, and credible supporting information</objective>
  <extraction_focus>Research findings, statistics, expert quotes, real-world examples, case studies</extraction_focus>
  </category_3>
  
  <category_4>
  <name>Tools and Resources</name>
  <objective>Extract mentions of tools, software, platforms, and resources referenced in research</objective>
  <extraction_focus>Software recommendations, tool comparisons, resource lists, platform features</extraction_focus>
  </category_4>
  
  <category_5>
  <name>Common Challenges and Solutions</name>
  <objective>Identify problems, obstacles, and their corresponding solutions from research</objective>
  <extraction_focus>Pain points, common mistakes, troubleshooting, solution frameworks</extraction_focus>
  </category_5>
  
  <category_6>
  <name>Advanced Strategies and Insights</name>
  <objective>Extract expert-level information, advanced techniques, and unique insights</objective>
  <extraction_focus>Advanced methods, expert insights, unique approaches, competitive advantages</extraction_focus>
  </category_6>
  </research_analysis_categories>
  
  <output_format_phase_1>
  For each category, provide:
  <category_template>
  CATEGORY [N]: [Category Name]
  <research_findings>
  Finding 1: "Specific insight or information from research data"
  Finding 2: "Specific insight or information from research data"
  Finding 3: "Specific insight or information from research data"
  [Continue for all relevant findings in category]
  </research_findings>
  <supporting_sources>
  For each finding, note:
  - Source reference or URL from research data
  - Credibility level (High/Medium/Low based on source type)
  - Relevance to target keywords (Direct/Indirect/Supporting)
  </supporting_sources>
  <keyword_alignment>
  How findings align with target keywords: ${keywords.join(", ")}
  </keyword_alignment>
  </category_template>
  </output_format_phase_1>
  </phase_1>
  
  <phase_2>
  <title>KEY POINT IDENTIFICATION AND PRIORITIZATION</title>
  <requirements>Generate comprehensive list of potential key points and systematically evaluate for final selection</requirements>
  
  <key_point_generation_protocol>
  <mandatory_steps>
  <step_1>Generate 10-15 potential key points from research analysis</step_1>
  <step_2>Evaluate each potential key point against selection criteria</step_2>
  <step_3>Score each key point for relevance, actionability, and value</step_3>
  <step_4>Verify information accuracy and completeness</step_4>
  <step_5>Select top 5 key points based on systematic scoring</step_5>
  <step_6>Ensure logical flow and comprehensive topic coverage</step_6>
  </mandatory_steps>
  </key_point_generation_protocol>
  
  <key_point_selection_criteria>
  <evaluation_framework>
  For EACH potential key point, assess:
  <relevance_score>
  <primary_keyword_match>Direct alignment with primary keywords (0-3 points)</primary_keyword_match>
  <title_alignment>How well it supports the article title (0-3 points)</title_alignment>
  <topic_centrality>Centrality to main topic (0-2 points)</topic_centrality>
  <maximum_relevance_score>8 points</maximum_relevance_score>
  </relevance_score>
  
  <actionability_score>
  <practical_value>Provides actionable steps or advice (0-3 points)</practical_value>
  <implementation_clarity>Clear guidance for readers (0-2 points)</implementation_clarity>
  <immediate_applicability>Can be applied immediately (0-2 points)</immediate_applicability>
  <maximum_actionability_score>7 points</maximum_actionability_score>
  </actionability_score>
  
  <content_value_score>
  <uniqueness>Provides unique insights or information (0-2 points)</uniqueness>
  <comprehensiveness>Thorough coverage of subtopic (0-2 points)</comprehensiveness>
  <reader_interest>Likely to engage target audience (0-2 points)</reader_interest>
  <supporting_evidence>Backed by credible research data (0-2 points)</supporting_evidence>
  <maximum_value_score>8 points</maximum_value_score>
  </content_value_score>
  
  <total_maximum_score>23 points per key point</total_maximum_score>
  </evaluation_framework>
  </key_point_selection_criteria>
  
  <scoring_documentation_format>
  For each potential key point:
  <scoring_template>
  <potential_key_point>"Proposed heading for key point"</potential_key_point>
  <research_basis>Supporting information from research data</research_basis>
  <scoring_breakdown>
  <relevance>
  - Primary keyword match: [0-3]/3
  - Title alignment: [0-3]/3  
  - Topic centrality: [0-2]/2
  - Subtotal: [X]/8
  </relevance>
  <actionability>
  - Practical value: [0-3]/3
  - Implementation clarity: [0-2]/2
  - Immediate applicability: [0-2]/2
  - Subtotal: [X]/7
  </actionability>
  <content_value>
  - Uniqueness: [0-2]/2
  - Comprehensiveness: [0-2]/2
  - Reader interest: [0-2]/2
  - Supporting evidence: [0-2]/2
  - Subtotal: [X]/8
  </content_value>
  <total_score>[X]/23</total_score>
  </scoring_breakdown>
  <selection_status>SELECTED/NOT SELECTED</selection_status>
  <selection_rationale>Why this key point was/wasn't included in final 5</selection_rationale>
  </scoring_template>
  </scoring_documentation_format>
  </phase_2>
  
  <phase_3>
  <title>OUTLINE OPTIMIZATION AND VIDEO INTEGRATION</title>
  <requirements>Optimize selected key points for maximum impact and identify optimal video integration opportunities</requirements>
  
  <outline_optimization_protocol>
  <content_optimization>
  <heading_refinement>
  Create compelling, descriptive headings that:
  - Include target keywords naturally
  - Promise specific value to readers
  - Are scannable and engaging
  - Differentiate each section clearly
  </heading_refinement>
  
  <summary_optimization>
  Craft 150-350 character summaries that:
  - Capture essential information concisely
  - Include actionable language
  - Highlight unique value proposition
  - Maintain reader engagement
  - CRITICAL: Count characters, not words!
  </summary_optimization>
  
  <link_integration>
  Select 1-2 most relevant and credible links per key point:
  - Prioritize authoritative sources
  - Ensure links directly support the key point
  - Verify link accuracy and accessibility
  - Balance official sources with practical resources
  </link_integration>
  </content_optimization>
  
  ${
    videos && videos.length > 0
      ? `
  <video_integration_analysis>
  <integration_requirements>
  Systematically evaluate each key point for video integration potential:
  </integration_requirements>
  
  <video_selection_criteria>
  <visual_complexity>
  - Concepts that benefit from visual demonstration (0-3 points)
  - Step-by-step processes that need visual guidance (0-3 points)
  - Technical procedures requiring visual clarity (0-2 points)
  </visual_complexity>
  
  <expert_credibility>
  - Topics where expert video explanation adds authority (0-2 points)
  - Complex subjects requiring professional demonstration (0-2 points)
  </expert_credibility>
  
  <learning_enhancement>
  - Content where video significantly improves comprehension (0-3 points)
  - Practical examples best shown rather than described (0-2 points)
  </learning_enhancement>
  
  <maximum_video_score>15 points per key point</maximum_video_score>
  </video_selection_criteria>
  
  <video_matching_protocol>
  <available_video_analysis>
  For each available video, assess:
  - Primary topics covered
  - Demonstration type (tutorial, explanation, example, etc.)
  - Complexity level (beginner, intermediate, advanced)
  - Content quality and production value
  - Relevance to article keywords
  </available_video_analysis>
  
  <optimal_integration_identification>
  Select the SINGLE key point with:
  - Highest video integration score
  - Best match with available video content
  - Maximum learning enhancement potential
  - Clear alignment between video content and key point focus
  </optimal_integration_identification>
  </video_matching_protocol>
  </video_integration_analysis>
  `
      : ""
  }
  
  <character_count_verification>
  <counting_protocol>
  For EACH summary, manually verify character count:
  <verification_steps>
  <step_1>Write the complete summary</step_1>
  <step_2>Count every character including spaces and punctuation</step_2>
  <step_3>Ensure count is between 150-350 characters</step_3>
  <step_4>Revise if outside acceptable range</step_4>
  <step_5>Re-verify final character count</step_5>
  </verification_steps>
  
  <character_count_examples>
  150 characters: "This comprehensive guide covers essential strategies and practical tips for implementation, providing readers with actionable insights."
  350 characters: "This comprehensive section explores advanced strategies and practical implementation techniques, providing readers with actionable insights, real-world examples, and expert recommendations for achieving measurable results in their specific context and achieving long-term success."
  </character_count_examples>
  </character_count_verification>
  </phase_3>
  
  </execution_sequence>
  
  <output_requirements>
  
  <structured_outline_output>
  <critical_instruction>
  Return a comprehensive JSON object with the optimized outline based on systematic analysis and verification.
  </critical_instruction>
  
  <json_structure>
  {
    "title": "${title}",
    "keywords": [${keywords.map((k) => `"${k}"`).join(", ")}],
    "researchAnalysisSummary": {
      "totalSourcesAnalyzed": number,
      "keyThemesIdentified": number,
      "potentialKeyPointsGenerated": number,
      "averageSelectionScore": number
    },
    "keyPoints": [
      {
        "heading": "Optimized, keyword-rich heading for key point 1",
        "summary": "Precisely crafted summary (150-350 characters) with verified character count",
        "characterCount": number,
        "relevantLinks": ["verified_url1", "verified_url2"],
        "selectionScore": number,
        "primaryKeywords": ["keyword1", "keyword2"]${videos && videos.length > 0 ? ',\n      "videoContext": "Optional: specific topics/keywords for video demonstration",\n      "videoIntegrationScore": number' : ""}
      },
      {
        "heading": "Optimized, keyword-rich heading for key point 2",
        "summary": "Precisely crafted summary (150-350 characters) with verified character count", 
        "characterCount": number,
        "relevantLinks": ["verified_url1"],
        "selectionScore": number,
        "primaryKeywords": ["keyword1", "keyword2"]${videos && videos.length > 0 ? ',\n      "videoContext": "Optional: specific topics/keywords for video demonstration",\n      "videoIntegrationScore": number' : ""}
      },
      {
        "heading": "Optimized, keyword-rich heading for key point 3",
        "summary": "Precisely crafted summary (150-350 characters) with verified character count",
        "characterCount": number,
        "relevantLinks": ["verified_url1", "verified_url2"],
        "selectionScore": number,
        "primaryKeywords": ["keyword1", "keyword2"]${videos && videos.length > 0 ? ',\n      "videoContext": "Optional: specific topics/keywords for video demonstration",\n      "videoIntegrationScore": number' : ""}
      },
      {
        "heading": "Optimized, keyword-rich heading for key point 4",
        "summary": "Precisely crafted summary (150-350 characters) with verified character count",
        "characterCount": number,
        "relevantLinks": ["verified_url1"],
        "selectionScore": number,
        "primaryKeywords": ["keyword1", "keyword2"]${videos && videos.length > 0 ? ',\n      "videoContext": "Optional: specific topics/keywords for video demonstration",\n      "videoIntegrationScore": number' : ""}
      },
      {
        "heading": "Optimized, keyword-rich heading for key point 5",
        "summary": "Precisely crafted summary (150-350 characters) with verified character count",
        "characterCount": number,
        "relevantLinks": ["verified_url1", "verified_url2"],
        "selectionScore": number,
        "primaryKeywords": ["keyword1", "keyword2"]${videos && videos.length > 0 ? ',\n      "videoContext": "Optional: specific topics/keywords for video demonstration",\n      "videoIntegrationScore": number' : ""}
      }
    ],
    "totalWords": number,
    "outlineOptimization": {
      "keywordDensity": "percentage of target keywords naturally integrated",
      "actionabilityScore": "average actionability score across all key points",
      "contentValueScore": "average content value score across all key points"
    }${videos && videos.length > 0 ? ',\n  "videoIntegration": {\n    "optimalSection": "heading of section selected for video integration",\n    "integrationRationale": "why this section was selected for video demonstration",\n    "matchedVideo": "title and URL of best matching video"\n  }' : ""}
  }
  </json_structure>
  
  <quality_validation_requirements>
  <mandatory_checks>
  For each key point, verify:
  ✅ Heading includes target keywords naturally
  ✅ Summary is exactly 150-350 characters (verified by manual count)
  ✅ Character count field matches actual summary length
  ✅ Links are verified and directly relevant
  ✅ ALL PROVIDED LINKS ARE VALID AND PAGES EXIST - It is CRITICAL that all URLs and links provided are functional and lead to existing pages. Do not include broken links or non-existent URLs.
  ✅ Selection score documented and justified
  ✅ Primary keywords identified and integrated
  ✅ Content flows logically from point to point
  ✅ All information traceable to research data
  ${videos && videos.length > 0 ? "✅ Video integration analysis completed for all sections\n✅ Maximum ONE section selected for video integration\n✅ Video selection justified by scoring criteria" : ""}
  </mandatory_checks>
  
  <content_quality_standards>
  <information_accuracy>
  All claims and information must be:
  - Directly supported by research data provided
  - Verified for accuracy and currency
  - Cross-referenced when possible
  - Clearly attributed to credible sources
  </information_accuracy>
  
  <actionability_requirements>
  Each key point must provide:
  - Specific, implementable guidance
  - Clear value proposition for readers
  - Practical steps or frameworks
  - Measurable outcomes or benefits
  </actionability_requirements>
  
  <keyword_optimization>
  Target keywords must be:
  - Integrated naturally into headings and summaries
  - Distributed appropriately across all key points
  - Used in context that enhances rather than forces readability
  - Balanced with semantic variations and related terms
  </keyword_optimization>
  </content_quality_standards>
  </quality_validation_requirements>
  </structured_outline_output>
  
  </output_requirements>
  
  <quality_control>
  
  <systematic_verification_checklist>
  <research_analysis_verification>
  ✅ All research data systematically categorized and analyzed
  ✅ Key themes identified and documented with supporting evidence
  ✅ Minimum 10 potential key points generated before selection
  ✅ Source credibility assessed for all referenced information
  ✅ Keyword alignment verified for all extracted insights
  </research_analysis_verification>
  
  <key_point_selection_verification>
  ✅ Systematic scoring applied to all potential key points
  ✅ Selection criteria consistently applied across all candidates
  ✅ Top 5 key points selected based on documented scoring
  ✅ Final selection provides comprehensive topic coverage
  ✅ Logical flow and progression verified across selected points
  </key_point_selection_verification>
  
  <outline_optimization_verification>
  ✅ All headings optimized for keywords and reader engagement
  ✅ Every summary manually verified for 150-350 character count
  ✅ Character count fields accurately reflect actual summary lengths
  ✅ Links verified for relevance, accuracy, and accessibility
  ✅ ALL LINKS VALIDATED TO ENSURE PAGES EXIST AND ARE ACCESSIBLE - Critical verification that all provided URLs are functional
  ✅ Content quality standards met for all key points
  ${videos && videos.length > 0 ? "✅ Video integration analysis completed with systematic scoring\n✅ Optimal video integration identified and justified\n✅ Video content alignment verified with selected key point" : ""}
  </outline_optimization_verification>
  
  <final_output_verification>
  ✅ JSON structure exactly matches specified format
  ✅ All required fields populated with accurate information
  ✅ Total word count under 300 words as specified
  ✅ Quality validation requirements met for all elements
  ✅ Content strategically optimized for target audience and keywords
  </final_output_verification>
  </systematic_verification_checklist>
  
  <error_prevention_protocol>
  <common_outline_errors>
  ❌ Character counts based on word counts instead of actual characters
  ❌ Generic headings that don't include target keywords
  ❌ Summaries that exceed 350 characters or fall below 150
  ❌ Links that don't directly support the key point content
  ❌ Key points that overlap significantly in coverage
  ❌ Information not traceable to provided research data
  ${videos && videos.length > 0 ? "❌ Multiple sections selected for video integration\n❌ Video integration without systematic evaluation" : ""}
  </common_outline_errors>
  </error_prevention_protocol>
  
  </quality_control>
  
  <execution_command>
  <instruction>EXECUTE SYSTEMATIC OUTLINE CREATION WITH PHASE 1 - RESEARCH ANALYSIS, THEN PROCEED THROUGH ALL PHASES TO DELIVER OPTIMIZED JSON OUTLINE WITH VERIFIED CHARACTER COUNTS AND SYSTEMATIC KEY POINT SELECTION</instruction>
  </execution_command>
    `,
};
