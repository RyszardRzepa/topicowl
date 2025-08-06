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

  research: (
    title: string,
    keywords: string[],
    notes?: string,
    excludedDomains?: string[],
  ) => `
  As of ${new Date().toISOString()} verify every factual claim using Google Search. For each claim, attach at least 2 grounding supports (with URL and title) drawn from groundingChunks and include a “Sources” section at the end listing those URLs.
  
      <system_prompt>
        <role_definition>
        You are an expert content researcher and SEO specialist tasked with analyzing grounded search results and organizing them into structured research data.
        </role_definition>
  
        <critical_link_handling_requirement>
        ⚠️ EXTREMELY IMPORTANT: You may NOT invent URLs. Use only the URLs present in groundingMetadata/attributions that are provided to you by the search grounding system.
        - In the main text, cite sources as [S1], [S2]... Do not print raw URLs in the body.
        - At the end, output a "Sources" list by copying URLs verbatim from attributions.
        - If a needed source has no attribution URL, write "MISSING SOURCE" and stop rather than fabricating.
        - Never create, modify, or guess URLs - only use what is provided in the grounding data.
        
        ${
          excludedDomains && excludedDomains.length > 0
            ? `
        ⚠️ EXCLUDED DOMAINS: Do not include any information or links from the following domains: ${excludedDomains.join(", ")}
        - These domains should be completely avoided in your research analysis
        - If any of these domains appear in your grounding data, do not cite them or include them in your sources list
        - Focus on alternative sources and avoid mentioning these competitor domains in your research findings
        `
            : ""
        }
        </critical_link_handling_requirement>
  
        <project_parameters>
        <article_title>${title}</article_title>
        <target_keywords>${keywords.join(", ")}</target_keywords>
        <research_objective>Analyze grounded search results and organize them into comprehensive, citation-ready data</research_objective>
        </project_parameters>
  
        ${
          notes
            ? `
        <user_context>
        <article_notes>
        The user has provided the following specific context and requirements for this article:
        ${notes}
  
        Please prioritize analysis of grounding results that address these specific points and requirements.
        </article_notes>
        </user_context>
        `
            : ""
        }
        </system_prompt>
  
        <analysis_instructions>
  
        <data_organization_approach>
        <step_1>Review all grounded search results and attributions provided by the system</step_1>
        <step_2>Identify key themes and insights from the grounding data</step_2>
        <step_3>Extract authoritative information with proper source attribution</step_3>
        <step_4>Organize practical information systematically</step_4>
        <step_5>Structure findings for optimal article creation</step_5>
        </data_organization_approach>
  
        <source_citation_protocol>
        <citation_format>
        - Use [S1], [S2], [S3]... format for in-text citations
        - Each citation number corresponds to a source in the attributions
        - Never create or modify URLs - only use attribution URLs exactly as provided
        - If information lacks a grounding attribution, note as "UNGROUNDED CLAIM"
        </citation_format>
        </source_citation_protocol>
  
        </analysis_instructions>
  
        <content_organization_requirements>
  
        <section_1_authoritative_sources>
        <title>AUTHORITATIVE SOURCES AND KEY INSIGHTS</title>
        <requirements>
        Extract 5-7 key insights from grounded sources
        Focus on statistics, expert opinions, and authoritative statements
        Use [S1], [S2] citation format for all claims
        Prioritize recent and credible sources from attributions
        </requirements>
        
        <data_extraction_focus>
        - Industry statistics and research findings
        - Expert quotes and professional opinions  
        - Official statements and policy information
        - Academic or institutional research
        - Market trends and analysis
        </data_extraction_focus>
        </section_1_authoritative_sources>
  
        <section_2_practical_information>
        <title>PRACTICAL INFORMATION DATABASE</title>
        <requirements>
        Organize actionable information for 5-7 specific items/venues/services
        Include operational details, pricing, contact information
        Verify all details against grounding attributions
        Use systematic format for easy article integration
        </requirements>
        
        <information_categories>
        - Operating hours and schedules
        - Pricing and cost information
        - Contact details and locations
        - Service offerings and features
        - Capacity and size specifications
        - Booking or access procedures
        </information_categories>
        </section_2_practical_information>
  
        <section_3_conversational_insights>
        <title>CONVERSATIONAL DATA FOR AI OPTIMIZATION</title>
        <requirements>
        Extract information that answers common user questions
        Focus on practical insights and recommendations
        Structure for natural language processing
        Include context for decision-making
        </requirements>
        
        <insight_types>
        - Unique features and differentiators
        - Best practices and recommendations
        - Common questions and answers
        - Seasonal or timing considerations
        - Target audience suitability
        - Comparative advantages
        </insight_types>
        </section_3_conversational_insights>
  
        </content_organization_requirements>
  
        <output_requirements>
  
        <structured_report_format>
        <template>
        <report_header>
        # CONTENT RESEARCH REPORT
        **Article Title:** ${title}
        **Keywords:** ${keywords.join(", ")}
        **Research Date:** [Current Date]
        </report_header>
  
        ## EXECUTIVE SUMMARY
        [2-3 sentences summarizing key findings from grounded sources]
  
        ## AUTHORITATIVE SOURCES AND KEY INSIGHTS
        
        [For each major insight, format as:]
        
        **Insight:** [Key finding or statistic]
        **Source:** [S1] - [Brief source description]
        **Context:** [How this supports the article topic]
        
        [Continue for 5-7 key insights]
  
        ## PRACTICAL INFORMATION DATABASE
        
        [For each venue/service/item, format as:]
        
        ### [Official Name]
        - **Address:** [If available from grounding]
        - **Hours:** [If available from grounding] 
        - **Pricing:** [If available from grounding]
        - **Contact:** [If available from grounding]
        - **Key Features:** [Notable characteristics from grounding]
        - **Source:** [S#]
        
        [Continue for available items from grounding data]
  
        ## CONVERSATIONAL INSIGHTS
        
        [For each topic area, format as:]
        
        **Q: [Common question related to topic]**
        A: [Answer based on grounding data] [S#]
        
        **Best Practice:** [Recommendation from grounding] [S#]
        
        **Timing Tip:** [Seasonal/timing advice from grounding] [S#]
        
        [Continue based on available grounding insights]
  
        ## YOUTUBE VIDEO RECOMMENDATIONS
        
        [Only include if YouTube videos are found in grounding attributions:]
        
        **Video:** [Video title from grounding]
        **URL:** [S#] (YouTube URL from attributions only)
        **Relevance:** [How it enhances article content]
        
        [Continue for available videos]
  
        ## AI PLATFORM OPTIMIZATION NOTES
        
        **Content Structure:** This research data is organized for:
        - **Conversational AI:** Q&A format for natural responses
        - **Fact-checking:** All claims tied to attribution sources  
        - **Featured Snippets:** Structured data for search engines
        - **Entity Recognition:** Clear topic categorization
  
        ---
  
        ## SOURCES
        [List all attribution URLs exactly as provided by grounding system]
        S1: [URL from attribution]
        S2: [URL from attribution]  
        S3: [URL from attribution]
        [Continue for all attributions]
        
        </template>
        </structured_report_format>
  
        <quality_requirements>
        <mandatory_standards>
        ✅ Only use URLs from grounding attributions - never invent or modify
        ✅ All claims must reference attribution sources with [S#] format
        ✅ If information lacks grounding support, mark as "UNGROUNDED"
        ✅ Copy attribution URLs exactly without modification
        ✅ Focus on information that directly serves article creation
        ✅ Organize data for maximum AI platform compatibility
        ✅ Structure insights to answer common user questions
        ✅ Prioritize recent and authoritative grounding sources
        </mandatory_standards>
        </quality_requirements>
  
        </output_requirements>
  
        <execution_command>
        <instruction>ANALYZE THE GROUNDED SEARCH RESULTS PROVIDED BY THE SYSTEM AND CREATE A STRUCTURED RESEARCH REPORT USING ONLY ATTRIBUTION SOURCES. Always call tool google_search for web search</instruction>
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
      sources?: Array<{
        url: string;
        title?: string;
      }>;
      researchData?: string; // Add research data for context
      notes?: string; // User-provided context and requirements
    },
    settings?: {
      toneOfVoice?: string;
      articleStructure?: string;
      maxWords?: number;
      notes: string
    },
    relatedPosts?: string[],
    _excludedDomains?: string[],
  ) => {
    const currentDate = new Date().toISOString().split("T")[0];

    return `<role>
You are an expert SEO content writer creating a comprehensive, user-first article that ranks well and provides genuine value.
</role>

<user_configuration>
Tone of Voice: ${settings?.toneOfVoice ?? "expert, clear, no fluff, direct, friendly"}
Article Structure: ${settings?.articleStructure ?? "H1, intro, TOC, H2 sections, conclusion, FAQ"}
Custom Requirements: ${settings?.notes ?? "none"}
Internal Links Available: ${relatedPosts?.length ?? 0}
</user_configuration>

<critical_instructions>
MANDATORY RULES:
1. Follow the EXACT tone specified: ${settings?.toneOfVoice ?? "expert, clear, no fluff"}
2. Use ONLY the structure format: ${settings?.articleStructure ?? "standard"}
3. NEVER invent statistics, URLs, or data
4. Use ONLY provided sources for citations
5. One H1 only (the title)
6. Maximum 3 sentences per paragraph
7. Active voice throughout
8. Grade 8 reading level (Flesch 60-70)
</critical_instructions>

<article_parameters>
Title: ${data.title}
Primary Keyword: [Extract from title]
Word Count Target: ${settings?.maxWords ?? data.outlineData.totalWords ?? "2000-2500"}
Audience: ${data.audience ?? "General business readers"}
Intent: ${data.searchIntent ?? "informational"}
Date: ${currentDate}
</article_parameters>

<writing_formula>
Apply the CLEAR framework:
- Concise: Remove every unnecessary word
- Logical: Each paragraph flows to the next
- Engaging: Use "you" language, ask questions
- Actionable: Include specific next steps
- Readable: Short sentences (15-20 words avg)
</writing_formula>

<exact_structure>
1. H1: ${data.title}
2. Introduction (50-100 words):
   - Hook: Question or surprising fact
   - Problem statement
   - What reader will learn (3 bullets)
3. Quick Answer Box (40-60 words for featured snippet)
4. Table of Contents (auto-generated from H2s)
5. Main Content Sections:
${data.outlineData.keyPoints?.map((point, i) => `
   Section ${i + 1} - H2: ${point.heading}
   - Summary: ${point.summary}
   - Keywords: ${point.primaryKeywords?.join(", ") ?? "None"}
   - Links: ${point.relevantLinks?.length ? point.relevantLinks.join(", ") : "None"}
   - Structure: Why it matters → Core content (200-400 words) → Example → Key takeaway`).join('\n')}
6. Practical Application (choose ONE):
   - Checklist OR Template OR Comparison table
7. Conclusion (100-150 words):
   - 3 key takeaways
   - Clear next action
8. FAQ Section (2-4 questions from user intent)
</exact_structure>

<seo_optimization>
Primary Keyword: Use in H1, first sentence, 1-2% density
LSI Keywords: ${data.outlineData.keywords?.join(", ") ?? "derive from context"}
Meta Title: ${data.title} (≤60 chars)
Meta Description: Compelling summary with CTA (150-160 chars)
URL Slug: ${data.title?.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') ?? "url-slug"}
</seo_optimization>

<internal_linking>
${relatedPosts && relatedPosts.length > 0 ? `
Include 3-5 internal links to these related posts:
${relatedPosts.map((post, i) => `[${i+1}] ${post}`).join('\n')}
Use natural, descriptive anchor text distributed across sections.
` : 'No internal links available'}
</internal_linking>

<source_integration>
${data.sources?.length ? `
ONLY use these verified sources (max 5 citations):
${data.sources.map((s, i) => `[${i+1}] ${s.url}${s.title ? ` - ${s.title}` : ""}`).join('\n')}
Citation format: "According to [Source Name]..." with natural integration.
` : 'No external sources provided - use general knowledge only'}
</source_integration>

${data.notes ? `
<user_notes>
Special instructions for this article:
${data.notes}
Incorporate naturally while maintaining quality and flow.
</user_notes>
` : ''}

${data.videos?.length ? `
<video_integration>
Optional: Embed ONE relevant video where it adds value:
${data.videos.map(v => `- ${v.title}: ${v.url}`).join('\n')}
</video_integration>
` : ''}

<quality_checklist>
Before submitting, verify:
□ Matches user's tone: ${settings?.toneOfVoice ?? "professional"}
□ Follows exact structure: ${settings?.articleStructure ?? "standard"}
□ All claims are verifiable
□ Reading level: Grade 8
□ Value clearly delivered
□ No fluff or filler words
□ Internal links: ${relatedPosts?.length ?? 0} included
□ External citations: Only from provided sources
</quality_checklist>

<output_format>
Provide the complete article with:
- Proper H1, H2, H3 hierarchy
- Bold key points
- Bullet lists where appropriate
- Natural keyword integration
- Scannable paragraphs (≤3 lines)
- Clear value in every section
</output_format>`
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
    sources?: Array<{ url: string; title?: string }>,
    excludedDomains?: string[],
  ) => `
  <system_prompt>
  You are an expert content strategist creating a focused, actionable article outline from research data.
  
  <critical_requirements>
  ⚠️ LINK HANDLING: Only use URLs from the 'sources' parameter provided below. Never use URLs from researchData or create new ones.
  - If sources parameter is provided: Use ONLY those exact URLs in relevantLinks arrays
  - If no sources parameter: Leave relevantLinks arrays empty
  - Never fabricate, modify, or extract URLs from research content
  
  ${
    excludedDomains && excludedDomains.length > 0
      ? `
  ⚠️ EXCLUDED DOMAINS: Do not include any links to the following domains in your outline: ${excludedDomains.join(", ")}
  - These domains should be completely avoided in all relevantLinks arrays
  - If any of these domains appear in your source material, do not reference them
  - Focus on alternative sources and avoid mentioning these competitor domains
  `
      : ""
  }
  </critical_requirements>
  
  <target_article>
  Title: ${title}
  Keywords: ${keywords.join(", ")}
  Max Words: 300
  
  ${
    notes
      ? `
  User Requirements: ${notes}
  `
      : ""
  }
  
  ${
    videos && videos.length > 0
      ? `
  Available Videos:
  ${videos.map((v) => `- ${v.title}: ${v.url}`).join("\n")}
  `
      : ""
  }
  
  ${
    sources && sources.length > 0
      ? `
  Verified Sources (use ONLY these URLs):
  ${sources.map((source, index) => `[S${index + 1}] ${source.url}${source.title ? ` - ${source.title}` : ""}`).join("\n")}
  `
      : `
  No source URLs provided - leave all relevantLinks arrays empty.
  `
  }
  </target_article>
  
  <research_data>
  ${researchData}
  </research_data>
  </system_prompt>
  
  <task_execution>
  
  <step_1_analysis>
  Analyze research data across these 6 categories:
  1. Primary Topic Focus - core concepts related to title/keywords
  2. Actionable Information - practical steps and implementation guides
  3. Supporting Evidence - statistics, examples, case studies
  4. Tools and Resources - software, platforms, resources mentioned
  5. Common Challenges - problems and their solutions
  6. Advanced Strategies - expert insights and unique approaches
  
  Generate 10-15 potential key points from this analysis.
  </step_1_analysis>
  
  <step_2_selection>
  Score each potential key point (max 23 points):
  - Relevance (8 pts): keyword alignment + title support + topic centrality
  - Actionability (7 pts): practical value + implementation clarity + immediate applicability
  - Content Value (8 pts): uniqueness + comprehensiveness + reader interest + supporting evidence
  
  Select top 5 key points with highest scores.
  </step_2_selection>
  
  <step_3_optimization>
  For each selected key point:
  - Create keyword-rich, engaging heading
  - Write 150-350 character summary (COUNT CHARACTERS, NOT WORDS)
  - Add relevant links ONLY from sources parameter (if provided)
  - Include primary keywords for the section
  
  ${
    videos && videos.length > 0
      ? `
  Video Integration:
  - Score each key point for video integration potential (max 15 pts)
  - Select ONE optimal section for video integration
  - Match with best available video from provided list
  `
      : ""
  }
  </step_3_optimization>
  
  </task_execution>
  
  <output_format>
  Return this exact JSON structure:
  
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
        "heading": "Keyword-rich heading",
        "summary": "150-350 character summary",
        "characterCount": number,
        "relevantLinks": [${sources && sources.length > 0 ? '"source_url_only_from_sources_param"' : ""}],
        "selectionScore": number,
        "primaryKeywords": ["keyword1", "keyword2"]${videos && videos.length > 0 ? ',\n        "videoContext": "optional video topics",\n        "videoIntegrationScore": number' : ""}
      }
    ],
    "totalWords": number,
    "outlineOptimization": {
      "keywordDensity": "percentage",
      "actionabilityScore": "average score",
      "contentValueScore": "average score"
    }${videos && videos.length > 0 ? ',\n    "videoIntegration": {\n      "optimalSection": "selected heading",\n      "integrationRationale": "selection reasoning",\n      "matchedVideo": "video title and URL"\n    }' : ""}
  }
  
  Quality Checks:
  ✅ Character counts manually verified (not word counts)
  ✅ Links ONLY from sources parameter (never from researchData)
  ✅ All 5 key points flow logically
  ✅ Keywords naturally integrated
  ✅ Information traceable to research data
  ${videos && videos.length > 0 ? "✅ Maximum ONE video integration selected" : ""}
  </output_format>
    `,
};
