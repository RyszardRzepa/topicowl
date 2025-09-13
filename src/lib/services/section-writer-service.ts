/**
 * Section Writer Service
 * Generates individual article sections based on detailed outline specifications
 * This provides focused, high-quality content generation one section at a time
 */

import { generateText } from "ai";
import { getModel } from "@/lib/ai-models";
import { MODELS } from "@/constants";
import { logger } from "@/lib/utils/logger";
import type {
  EnhancedSectionSpec,
  SectionResult,
  DetailedOutline
} from "@/types";

interface SectionRequest {
  sectionSpec: EnhancedSectionSpec;
  outline: DetailedOutline;
  previousSections?: SectionResult[];
  narrativeContext?: NarrativeContext;
  projectSettings?: {
    toneOfVoice?: string;
    languageCode?: string;
  };
}

interface NarrativeContext {
  storyArc: {
    currentPosition: number; // Which section we're on (1-based)
    totalSections: number;
    phase: 'introduction' | 'development' | 'climax' | 'conclusion';
  };
  introducedConcepts: string[]; // Concepts already covered
  keyThemes: string[]; // Main themes to maintain
  narrativeThread: string; // The connecting story/argument
  pendingTransitions: {
    fromPreviousSection: string;
    toNextSection?: string;
  };
  contentCoverage: {
    topicsCovered: string[];
    statisticsUsed: string[];
    examplesGiven: string[];
  };
}

/**
 * Generates content for a single section based on its specification
 */
export async function generateSection(
  request: SectionRequest
): Promise<SectionResult> {
  const startTime = Date.now();
  
  logger.debug("[SECTION_WRITER] Starting section generation", {
    sectionId: request.sectionSpec.id,
    sectionType: request.sectionSpec.type,
    wordTarget: request.sectionSpec.wordTarget.target ?? request.sectionSpec.wordTarget.min,
    talkingPointsCount: request.sectionSpec.talkingPoints.length
  });

  try {
    // Build the section-specific prompt
    const sectionPrompt = buildSectionPrompt(request);
    
    // Generate the section content
    const result = await generateText({
      model: await getModel('google', MODELS.GEMINI_2_5_PRO, "section-writer"),
      prompt: sectionPrompt,
      maxRetries: 2,
    });

    const content = result.text;
    
    // Extract keywords and citations used
    const usedKeywords = extractUsedKeywords(content, request.sectionSpec.keywordTargets);
    const usedCitations = extractUsedCitations(content, request.sectionSpec.researchCitations);
    
    const processingTime = Date.now() - startTime;
    
    const sectionResult: SectionResult = {
      sectionId: request.sectionSpec.id,
      heading: request.sectionSpec.label,
      content,
      wordCount: countWords(content),
      keywordsUsed: usedKeywords,
      citationsUsed: usedCitations,
      qualityScore: 0, // Will be set by quality control
      complianceIssues: [],
      wasRewritten: false,
      rewriteAttempts: 0,
      metadata: {
        generatedAt: new Date().toISOString(),
        processingTimeMs: processingTime,
        modelUsed: MODELS.GEMINI_2_5_PRO
      }
    };

    logger.debug("[SECTION_WRITER] Section generated successfully", {
      sectionId: request.sectionSpec.id,
      wordCount: sectionResult.wordCount,
      keywordsUsedCount: usedKeywords.length,
      citationsUsedCount: usedCitations.length,
      processingTimeMs: processingTime
    });

    return sectionResult;
    
  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    logger.error("[SECTION_WRITER] Failed to generate section", {
      error: error instanceof Error ? error.message : "Unknown error",
      sectionId: request.sectionSpec.id,
      processingTimeMs: processingTime
    });
    
    throw new Error(`Section generation failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Builds a focused prompt for individual section generation
 */
function buildSectionPrompt(request: SectionRequest): string {
  const {
    sectionSpec,
    outline,
    previousSections,
    narrativeContext,
    projectSettings
  } = request;

  // Build comprehensive narrative context
  const narrativeContextStr = buildNarrativeContextString(previousSections, narrativeContext, sectionSpec);
  
  // Extract key points already covered to avoid repetition
  const contentOverlapAnalysis = analyzeContentOverlap(previousSections, sectionSpec);

  return `<role>
You are an expert content writer specializing in creating high-quality, focused sections for long-form articles. Your task is to write a single section that perfectly fits the overall article structure while maintaining consistency and narrative flow with previous sections.
</role>

<article_context>
<title>${outline.title}</title>
<content_strategy>${outline.contentStrategy}</content_strategy>
<research_summary>${outline.researchSummary}</research_summary>
<target_keywords>${outline.keywords.join(", ")}</target_keywords>
<tone_of_voice>${projectSettings?.toneOfVoice ?? "professional and informative"}</tone_of_voice>
<language>${projectSettings?.languageCode ?? "en"}</language>
</article_context>

${narrativeContextStr}

${contentOverlapAnalysis}

<section_specification>
<section_id>${sectionSpec.id}</section_id>
<section_type>${sectionSpec.type}</section_type>
<section_label>${sectionSpec.label}</section_label>
<word_target>
  Min: ${sectionSpec.wordTarget.min} words
  Max: ${sectionSpec.wordTarget.max} words
  Target: ${sectionSpec.wordTarget.target ?? sectionSpec.wordTarget.min} words
</word_target>

<talking_points>
${sectionSpec.talkingPoints.map((point, index) => `${index + 1}. ${point}`).join('\n')}
</talking_points>

<research_citations>
${sectionSpec.researchCitations.map((citation, index) => `[R${index + 1}] ${citation}`).join('\n')}
</research_citations>

<available_source_urls>
${outline.sources?.length ? 
  outline.sources.map((source, index) => `[S${index + 1}] [${source.title ?? 'Source'}](${source.url})`).join('\n') :
  'No source URLs available for linking'
}
</available_source_urls>

<keyword_targets>
${sectionSpec.keywordTargets.map(keyword => `- ${keyword}`).join('\n')}
</keyword_targets>

<content_rules>
${sectionSpec.contentRules.map(rule => `- [${rule.priority.toUpperCase()}] ${rule.description}`).join('\n')}
</content_rules>

<validation_criteria>
${sectionSpec.validationCriteria.map(criteria => `- [${criteria.type.toUpperCase()}] ${criteria.description}`).join('\n')}
</validation_criteria>

${sectionSpec.examples?.length ? `<examples>
${sectionSpec.examples.map(example => `- ${example}`).join('\n')}
</examples>` : ''}

${sectionSpec.assignedScreenshots?.length ? `<assigned_screenshots>
This section has been assigned the following screenshots that should be referenced and integrated naturally:
${sectionSpec.assignedScreenshots.map((screenshot, index) => 
  `[IMG${index + 1}] ${screenshot.url} - "${screenshot.title ?? 'Screenshot'}"
  - Reason: ${screenshot.reason}
  - Placement: ${screenshot.placement}
  - Integration note: Reference this source naturally and mention that it will include a visual element`
).join('\n')}

SCREENSHOT INTEGRATION RULES:
- Do not include actual ![image] markdown - screenshots will be added later
- DO reference these sources naturally in your text 
- DO use phrases like "as shown in [source name](URL)" or "this visualization demonstrates"
- DO create natural places where screenshots would add value
- For "start" placement: Reference early in the section
- For "middle" placement: Reference in the main content body  
- For "end" placement: Reference as supporting evidence or conclusion
</assigned_screenshots>` : ''}
</section_specification>

<section_writing_instructions>

1. **Narrative Continuity**:
   - Build naturally on the content and arguments established in previous sections
   - Use smooth transitions that reference preceding content where appropriate
   - Maintain the overall story arc and argumentative flow
   - Avoid repeating information already covered (see content overlap analysis)

2. **Content Focus**:
   - Address ALL talking points comprehensively without overlap
   - Integrate research citations naturally and credibly
   - Include target keywords organically without keyword stuffing
   - Maintain the specified tone and writing style throughout

3. **Structure Requirements**:
   ${getSectionStructureRequirements(sectionSpec.type)}

4. **Quality Standards**:
   - Write within the specified word target range
   - Use specific examples and concrete details from research
   - Avoid generic language and clichés
   - Ensure every sentence adds unique value to the overall article
   - Maintain logical flow and clear transitions

5. **Citation Integration**:
   - Reference research findings naturally within the text
   - Include clickable links to sources: [source text](URL) format
   - Use phrases like "according to research" or "studies show"  
   - Don't just list facts - explain their significance
   - Connect citations to the main argument or point
   - Ensure each research citation becomes a clickable link in the content
   - Use the available source URLs (S1, S2, etc.) to create meaningful links
   - Example: "According to [recent studies](source-url), this approach shows..."

6. **Keyword Integration**:
   - Include target keywords naturally in context
   - Vary keyword usage (exact match, synonyms, related terms)
   - Don't force keywords - prioritize readability
   - Use keywords in headers, opening sentences, and key points

</section_writing_instructions>

<critical_requirements>
- Stay strictly within the word target range
- Address every talking point provided WITHOUT repeating content from previous sections
- Include specific research findings and data
- Maintain consistency with the article's overall narrative and strategy
- Follow all content rules and validation criteria
- Create smooth transitions from the previous section
- Write in ${projectSettings?.languageCode ?? "English"}
- Use the ${projectSettings?.toneOfVoice ?? "professional and informative"} tone
- AVOID all content overlaps identified in the analysis above
</critical_requirements>

Write the complete ${sectionSpec.type} section now:`;
}

/**
 * Returns structure requirements based on section type
 */
function getSectionStructureRequirements(sectionType: string): string {
  switch (sectionType) {
    case 'intro':
      return `- Start with a compelling hook that immediately engages the reader
   - Provide necessary context without being too broad
   - Preview the value readers will gain from the article
   - End with a smooth transition to the main content`;

    case 'tldr':
      return `- Create 3-6 bullet points summarizing key takeaways
   - Each bullet should provide a specific, actionable insight
   - Use parallel structure for consistency
   - Lead with the most valuable insights first`;

    case 'section':
      return `- Use clear subheadings if needed for longer sections
   - Start with the main point or argument
   - Support with research evidence and examples
   - Include actionable insights or practical applications
   - End with a clear conclusion or transition`;

    case 'faq':
      return `- Format as Q&A pairs
   - Questions should address real user concerns
   - Answers should be specific and actionable
   - Include 3-6 Q&A pairs typically
   - Order from most common to specialized questions`;

    case 'table':
      return `- Use proper markdown table format
   - Include clear column headers
   - Present data in logical order
   - Include a brief introduction explaining the table
   - Keep data accurate and sourced`;

    default:
      return `- Follow standard section structure with clear opening and conclusion
   - Use subheadings for organization if appropriate
   - Maintain logical flow throughout`;
  }
}

/**
 * Count words in text content
 */
function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(word => word.length > 0).length;
}

/**
 * Builds comprehensive narrative context string for AI prompt
 */
function buildNarrativeContextString(
  previousSections?: SectionResult[],
  narrativeContext?: NarrativeContext,
  _currentSectionSpec?: EnhancedSectionSpec
): string {
  if (!previousSections?.length && !narrativeContext) {
    return "<narrative_context>\nThis is the first section of the article.\n</narrative_context>";
  }

  let contextStr = "<narrative_context>\n";
  
  // Story arc position
  if (narrativeContext) {
    contextStr += `<story_position>
Section ${narrativeContext.storyArc.currentPosition} of ${narrativeContext.storyArc.totalSections}
Phase: ${narrativeContext.storyArc.phase}
Narrative Thread: ${narrativeContext.narrativeThread}
</story_position>\n\n`;

    // Concepts already introduced
    if (narrativeContext.introducedConcepts.length > 0) {
      contextStr += `<concepts_already_covered>
${narrativeContext.introducedConcepts.map(concept => `- ${concept}`).join('\n')}
</concepts_already_covered>\n\n`;
    }

    // Content coverage to avoid repetition
    if (narrativeContext.contentCoverage.topicsCovered.length > 0) {
      contextStr += `<topics_already_discussed>
${narrativeContext.contentCoverage.topicsCovered.map(topic => `- ${topic}`).join('\n')}
</topics_already_discussed>\n\n`;
    }

    // Transition guidance
    if (narrativeContext.pendingTransitions.fromPreviousSection) {
      contextStr += `<transition_from_previous>
${narrativeContext.pendingTransitions.fromPreviousSection}
</transition_from_previous>\n\n`;
    }
  }

  // Previous sections summary (more comprehensive than before)
  if (previousSections?.length) {
    contextStr += "<previous_sections_summary>\n";
    previousSections.forEach((section, _index) => {
      const summary = extractSectionSummary(section.content);
      contextStr += `[${section.sectionId}] ${section.heading}:
Key Points: ${summary.keyPoints.join(', ')}
Main Argument: ${summary.mainArgument}
Statistics Used: ${summary.statisticsUsed.join(', ')}
Conclusion: ${summary.conclusion}

`;
    });
    contextStr += "</previous_sections_summary>\n\n";
  }

  contextStr += "</narrative_context>";
  return contextStr;
}

/**
 * Analyzes potential content overlap with previous sections
 */
function analyzeContentOverlap(
  previousSections?: SectionResult[],
  _currentSectionSpec?: EnhancedSectionSpec
): string {
  if (!previousSections?.length) {
    return "<content_overlap_analysis>\nNo previous sections to analyze for overlap.\n</content_overlap_analysis>";
  }

  let analysisStr = "<content_overlap_analysis>\n";
  
  // Extract key concepts from previous sections
  const previousConcepts = new Set<string>();
  const previousStatistics = new Set<string>();
  
  previousSections.forEach(section => {
    // Extract concepts (simplified keyword extraction)
    const words = section.content.toLowerCase().split(/\s+/);
    words.forEach(word => {
      if (word.length > 6 && /^[a-z]+$/.test(word)) {
        previousConcepts.add(word);
      }
    });
    
    // Extract statistics (numbers with % or $ or mentions of data)
    const statsMatches = section.content.match(/\d+[%$]?|\b\d+\s*(percent|million|billion|thousand)\b/gi);
    if (statsMatches) {
      statsMatches.forEach(stat => previousStatistics.add(stat.toLowerCase()));
    }
  });

  analysisStr += "<concepts_already_covered>\n";
  if (previousConcepts.size > 0) {
    const conceptArray = Array.from(previousConcepts).slice(0, 10);
    analysisStr += conceptArray.map(concept => `- ${concept}`).join('\n');
  } else {
    analysisStr += "No major concepts identified in previous sections";
  }
  analysisStr += "\n</concepts_already_covered>\n\n";

  analysisStr += "<statistics_already_used>\n";
  if (previousStatistics.size > 0) {
    const statsArray = Array.from(previousStatistics).slice(0, 5);
    analysisStr += statsArray.map(stat => `- ${stat}`).join('\n');
  } else {
    analysisStr += "No statistics identified in previous sections";
  }
  analysisStr += "\n</statistics_already_used>\n\n";

  analysisStr += "<overlap_prevention_instructions>\n";
  analysisStr += "- If you must reference previously discussed concepts, build upon them rather than repeating\n";
  analysisStr += "- Use phrases like 'Building on the previous discussion...' or 'As established earlier...'\n";
  analysisStr += "- Focus on new angles, additional data, or deeper analysis of familiar concepts\n";
  analysisStr += "- Avoid repeating specific statistics or examples already mentioned\n";
  analysisStr += "- Ensure this section adds unique value and doesn't duplicate previous content\n";
  analysisStr += "</overlap_prevention_instructions>\n";
  
  analysisStr += "</content_overlap_analysis>";
  return analysisStr;
}

/**
 * Extracts a summary of key elements from a section for context
 */
function extractSectionSummary(content: string): {
  keyPoints: string[];
  mainArgument: string;
  statisticsUsed: string[];
  conclusion: string;
} {
  // Simple extraction - in a real implementation, this could use NLP
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 20);
  
  // Extract key points (first sentence of each paragraph)
  const paragraphs = content.split('\n\n').filter(p => p.trim().length > 0);
  const keyPoints = paragraphs.slice(0, 3).map(p => {
    const firstSentence = p.trim().split(/[.!?]/)[0];
    if (!firstSentence) return "";
    return firstSentence.length > 100 ? firstSentence.substring(0, 100) + "..." : firstSentence;
  }).filter(point => point.length > 10);

  // Main argument (usually in the first substantial paragraph)
  const mainArgument = sentences.length > 0 && sentences[0] ? sentences[0].trim() : "No clear main argument identified";

  // Extract statistics
  const statisticsUsed = content.match(/\d+[%$]?|\b\d+\s*(percent|million|billion|thousand)\b/gi) ?? [];

  // Conclusion (last sentence if it's substantial)
  const lastSentence = sentences[sentences.length - 1]?.trim() ?? "";
  const conclusion = lastSentence.length > 50 ? lastSentence : "No clear conclusion identified";

  return {
    keyPoints,
    mainArgument,
    statisticsUsed: Array.from(new Set(statisticsUsed)).slice(0, 3),
    conclusion
  };
}

/**
 * Extract which keywords were actually used in the content
 */
function extractUsedKeywords(content: string, targetKeywords: string[]): string[] {
  const lowerContent = content.toLowerCase();
  return targetKeywords.filter(keyword => 
    lowerContent.includes(keyword.toLowerCase())
  );
}

/**
 * Extract which citations were referenced in the content
 * Now also detects markdown links that correspond to research sources
 */
function extractUsedCitations(content: string, researchCitations: string[]): string[] {
  const usedCitations: string[] = [];
  
  // Look for citation patterns and match to research citations
  researchCitations.forEach((citation, _index) => {
    // Check if citation content appears in the text or if explicit references exist
    const citationWords = citation.toLowerCase().split(' ');
    const significantWords = citationWords.filter(word => word.length > 4);
    
    if (significantWords.some(word => content.toLowerCase().includes(word))) {
      usedCitations.push(citation);
    }
  });
  
  // Also extract markdown links as citations (these will be used by screenshot service)
  const linkMatches = content.match(/\[([^\]]+)\]\(([^)]+)\)/g);
  if (linkMatches) {
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/;
    linkMatches.forEach(link => {
      const match = linkRegex.exec(link);
      if (match?.[2]?.startsWith('http')) {
        usedCitations.push(`Link: ${match[1]} - ${match[2]}`);
      }
    });
  }
  
  return usedCitations;
}

/**
 * Generate multiple section variations for A/B testing
 */
export async function generateSectionVariations(
  request: SectionRequest,
  variationCount = 2
): Promise<SectionResult[]> {
  logger.debug("[SECTION_WRITER] Generating section variations", {
    sectionId: request.sectionSpec.id,
    variationCount
  });

  const variations = await Promise.all(
    Array(variationCount).fill(null).map(async (_, index) => {
      // Add variation directive to the prompt
      const variationRequest = {
        ...request,
        variationIndex: index + 1
      };
      
      return generateSection(variationRequest);
    })
  );

  logger.debug("[SECTION_WRITER] Section variations generated", {
    sectionId: request.sectionSpec.id,
    variationsCreated: variations.length
  });

  return variations;
}
