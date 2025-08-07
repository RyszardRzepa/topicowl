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
        <instruction>
        ANALYZE THE GROUNDED SEARCH RESULTS PROVIDED BY THE SYSTEM AND CREATE A STRUCTURED RESEARCH REPORT USING ONLY ATTRIBUTION SOURCES. Always call tool google_search for web search.
        Ensure the intent is current and based on real-time top results.
        </instruction>
        </execution_command>
    `,

  writing: (
    data: {
      title: string;
      audience?: string;
      searchIntent?: "informational" | "commercial" | "transactional";
      researchData: string; // Changed from markdownOutline to researchData
      sources?: Array<{ url: string; title?: string }>;
      notes?: string;
      videos?: Array<{ title: string; url: string }>;
    },
    settings?: {
      toneOfVoice?: string;
      articleStructure?: string;
      maxWords?: number;
      notes?: string;
      faqCount?: number;
    },
    relatedPosts?: string[],
    _excludedDomains?: string[],
  ) => {
    const currentDate = new Date().toISOString().split("T")[0];

    return `<role>
You are an expert SEO content writer creating a comprehensive article directly from research data. Write in clean Markdown format with proper structure and engaging content.
</role>

<article_parameters>
Title: ${data.title}
Max Length: ${settings?.maxWords ?? 1800} words (aim for comprehensive, detailed content)
Tone: ${settings?.toneOfVoice ?? "expert, clear, direct, friendly"}
Audience: ${data.audience ?? "General business readers"}
Date: ${currentDate}
</article_parameters>

<critical_rules>
1. Use ONLY one H1 (the title) - NO CONTENT BEFORE THE TITLE
2. Maximum 3 sentences per paragraph
3. Grade 8 reading level (active voice, short sentences)
4. Include ALL provided links naturally within the content
5. Output in Markdown format only
6. No interactive elements or HTML
7. Begin article content with the H1 title, not with any intro text
8. Create comprehensive, detailed content that thoroughly covers the topic
9. Aim for the target word count - provide in-depth analysis and practical examples
10. Include multiple sections with detailed explanations and actionable insights
</critical_rules>

<research_data_to_use>
${data.researchData}
</research_data_to_use>

<content_structure_requirements>
Create a well-structured article following the specified article structure: ${settings?.articleStructure ?? "standard blog format"}
${!!data?.videos?.length? "Include video section using this video data: " + JSON.stringify(data?.videos) : "" } 

Structure your content based on the most important information in the research data and organize it according to the user's preferred article structure format.
</content_structure_requirements>

<link_integration>
${
  relatedPosts?.length
    ? `
Internal links to distribute (MAX 3):
${relatedPosts
  .slice(0, 3)
  .map((post, i) => `${i + 1}. ${post}`)
  .join("\n")}
Use descriptive anchor text, not "click here"
`
    : ""
}

${
  data.sources?.length
    ? `
External sources to cite:
${data.sources.map((s, i) => `${i + 1}. ${s.url} - ${s.title ?? "Source"}`).join("\n")}
Format: "According to [source name](url)..."
`
    : ""
}

🚨 LINK CONSTRAINTS:
- Each external URL can only be used ONCE in the entire article
- Maximum 3 internal links (our website) allowed
- Remove duplicate external links - use unique external sources only
- Link format: [descriptive text](url)
- Integration: Natural within sentences, add value to content
- Don't use links from this domain: vertexaisearch.google.com
</link_integration>

<writing_execution>
1. Start with H1 title - no content before the title
2. Create a compelling introduction that hooks the reader (150-200 words)
3. Add a TL;DR section with key takeaways
4. Develop 4-6 main content sections based on research data (each 200-300 words)
5. Include detailed explanations, examples, and practical insights in each section
6. Add a comprehensive FAQ section with 4-6 questions
7. Keep paragraphs short (max 3 sentences) but ensure thorough coverage
8. Use active voice and grade 8 reading level
9. Use each external URL only ONCE - no duplicate external links
10. Limit internal links to maximum 3 per article
11. Aim for the target word count by providing comprehensive, detailed content
12. Include specific examples, case studies, and actionable advice throughout

${
  data.notes
    ? `
Special instructions: ${data.notes}
`
    : ""
}

Generate the complete article now, creating structure and content directly from the research data provided.
</writing_execution>`;
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
  You are an expert content strategist creating a complete article outline in markdown format from research data.
  
  🚨 CRITICAL REQUIREMENTS:
  
  OUTPUT FORMAT: Return a complete markdown outline with full article structure that follows this example:
  
  # Article Title Here
  
  Brief article introduction that hooks the reader and sets context for what they'll learn.
  
  ## TL;DR
  
  * **Key takeaway 1**: Brief explanation of the main benefit or insight
  * **Key takeaway 2**: Another important point readers will learn  
  * **Key takeaway 3**: Additional valuable insight or recommendation
  * **Key takeaway 4**: Final key point that adds value
  
  ## Main Content Section Heading
  
  Content guidance: This section should cover [specific topic]. Include practical examples and actionable advice. Integrate relevant links naturally within the content.
  
  Keywords focus: [relevant keywords from provided list]
  Links to integrate: [specific URLs from sources]
    
  ## "Video Title Here" (if relevant video url available)
  [![Watch on YouTube](https://img.youtube.com/vi/VIDEO_ID/hqdefault.jpg)](https://www.youtube.com/watch?v=VIDEO_ID)
 
  ## Table Section (if relevant structured data available)
  
  **Table Title:** "Descriptive Table Title Here"
  Brief description of what the table shows and how it helps readers compare options or understand data.
  
  Content guidance: This section should present structured data in table format. Include 2-6 columns with clear headers and organized information that helps readers make comparisons or understand relationships between data points.
  
  ## Additional Content Section 1
  
  Content guidance: This section should address [specific subtopic]. Focus on [particular aspect] and provide clear, actionable information.
  
  Keywords focus: [relevant keywords from provided list]
  Links to integrate: [specific URLs from sources]
  
   ## "instagram or tiktok Title Here" (if relevant instagram or tiktok url available)
  [![Watch on tiktok or instagram](https://img.instagram.com/vi/VIDEO_ID/hqdefault.jpg)](https://www.instagram.com/watch?v=VIDEO_ID)

  ## Additional Content Section 2
  
  Content guidance: This section should explore [another important aspect]. Include real-world examples and practical tips.
  
  Keywords focus: [relevant keywords from provided list]  
  Links to integrate: [specific URLs from sources]
  
  ## Frequently Asked Questions
  
  ### Question about main topic?
  
  Answer guidance: Provide 2-3 sentences with specific, helpful information addressing this common concern.
  
  ### Another important question?
  
  Answer guidance: Clear, actionable response that helps readers make informed decisions.
  
  ### Final relevant question?
  
  Answer guidance: Practical advice that addresses this specific user need.
  
  🚨 KEYWORD CONSTRAINT: You MUST ONLY use these provided keywords: ${keywords.join(", ")}
  - Do NOT create, generate, or suggest any new keywords
  - Focus your outline strictly on the keywords given
  
  <critical_requirements>
  ⚠️ LINK HANDLING: Only use URLs from the 'sources' parameter provided below. Never use URLs from researchData or create new ones.
  - If sources parameter is provided: Use ONLY those exact URLs in "Links to integrate" sections
  - If no sources parameter: Write "No specific links provided" in link sections
  - Never fabricate, modify, or extract URLs from research content
  
  ${
    excludedDomains && excludedDomains.length > 0
      ? `
  ⚠️ EXCLUDED DOMAINS: Do not include any links to the following domains: ${excludedDomains.join(", ")}
  - These domains should be completely avoided in all link sections
  - If any of these domains appear in your source material, do not reference them
  - Focus on alternative sources and avoid mentioning these competitor domains
  `
      : ""
  }
  </critical_requirements>
  
  <target_article>
  Title: ${title}
  Keywords (USE ONLY THESE): ${keywords.join(", ")}
  
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
  No source URLs provided - write "No specific links provided" in link sections.
  `
  }
  </target_article>
  
  <research_data>
  ${researchData}
  </research_data>
  </system_prompt>
  
  <task_execution>
  
  <step_1_content_analysis>
  Analyze research data through the lens of the provided keywords: ${keywords.join(", ")}
  Identify the core problem, desired outcome, and target audience.
  Extract 3-5 key takeaways for the TL;DR section.
  Determine the most important main topic for the primary H2 section.
  </step_1_content_analysis>
  
  <step_2_section_planning>
  Plan exactly 3-5 H2 sections total:
  1. One main section (most important content)
  2. One video section (if relevant video available)
  3. One table section (if relevant structured data can be presented)
  4. 2-3 additional sections (supporting content)
  
  Each section should:
  - Have a clear, keyword-focused H2 heading
  - Include content guidance for what to cover
  - Reference only provided keywords
  - Use only verified source URLs (if provided)
  </step_2_section_planning>
  
  <step_3_faq_creation>
  Create 2-4 high-intent FAQ questions that:
  - Address common user concerns about the provided keywords
  - Have practical, actionable answers
  - Focus on implementation or decision-making
  - Include answer guidance for each question
  </step_3_faq_creation>
  
  </task_execution>
  
  <output_requirements>
  
  Return the complete markdown outline following the structure shown in the example above. Include:
  ✅ H1 title using the provided title
  ✅ Brief introduction paragraph
  ✅ TL;DR section with 3-5 bullet points
  ✅ Main content section with guidance and keyword focus
  ✅ Video section (only if videos provided)
  ✅ Table section (only if relevant structured data available)
  ✅ 2-3 additional content sections with guidance
  ✅ FAQ section with 2-4 questions and answer guidance
  ✅ All sections use provided keywords only - NO NEW KEYWORDS
  ✅ Links ONLY from sources parameter (or "No specific links provided")
  ✅ Content guidance explains what each section should cover
  ✅ Keywords focus specified for each content section
  
  FINAL VERIFICATION CHECKLIST:
  ✅ Complete markdown format starting with H1 title
  ✅ Links ONLY from sources parameter (never from researchData)
  ✅ All sections use provided keywords only - NO NEW KEYWORDS GENERATED
  ✅ TL;DR has 3-5 bullet points
  ✅ Main section + 2-3 additional sections = 3-5 total H2 sections
  ✅ Video section included only if videos provided
  ✅ Table section included only if relevant structured data available
  ✅ FAQ has 2-4 questions with answer guidance
  ✅ Content guidance provided for each section
  ✅ Keyword focus specified for each content section
  </output_requirements>
    `,
};
