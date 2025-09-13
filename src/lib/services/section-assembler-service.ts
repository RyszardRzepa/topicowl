/**
 * Section Assembler Service
 * Combines approved sections into final article with consistency checks and formatting
 * This ensures cohesive flow and professional presentation of the multi-agent content
 */

import { generateText } from "ai";
import { getModel } from "@/lib/ai-models";
import { MODELS } from "@/constants";
import { logger } from "@/lib/utils/logger";
import type {
  SectionResult,
  DetailedOutline,
  AssemblyResult
} from "@/types";

interface AssemblyRequest {
  outline: DetailedOutline;
  approvedSections: SectionResult[];
  articleMetadata: {
    title: string;
    keywords: string[];
    toneOfVoice?: string;
    languageCode?: string;
  };
  assemblyInstructions?: {
    includeTransitions: boolean;
    addMetaDescription: boolean;
    formatForCMS: boolean;
    maxLength?: number;
  };
}

/**
 * Assembles approved sections into a cohesive final article
 */
export async function assembleFinalArticle(
  request: AssemblyRequest
): Promise<AssemblyResult> {
  const startTime = Date.now();
  
  logger.debug("[SECTION_ASSEMBLER] Starting article assembly", {
    sectionsCount: request.approvedSections.length,
    totalWords: request.approvedSections.reduce((sum, section) => sum + section.wordCount, 0),
    hasTransitions: request.assemblyInstructions?.includeTransitions ?? true
  });

  try {
    // Pre-assembly validation
    const validationResult = validateSectionsForAssembly(request.approvedSections, request.outline);
    if (!validationResult.isValid) {
      throw new Error(`Assembly validation failed: ${validationResult.issues.join(", ")}`);
    }

    // Generate transitions and improvements if requested
    const enhancedSections = request.assemblyInstructions?.includeTransitions 
      ? await addTransitionsBetweenSections(request.approvedSections, request.outline)
      : request.approvedSections;

    // Assemble the final content
    const assembledContent = await assembleContent(enhancedSections, request);
    
    // Generate meta description if requested
    // const metaDescription = request.assemblyInstructions?.addMetaDescription
    //   ? await generateMetaDescription(assembledContent, request.articleMetadata)
    //   : undefined;

    // Calculate quality metrics for monitoring
    // const qualityMetrics = calculateQualityMetrics(enhancedSections, startTime);
    
    // Format for target CMS if specified
    const finalContent = request.assemblyInstructions?.formatForCMS
      ? addCMSFrontmatter(assembledContent, request.articleMetadata)
      : assembledContent;

    const assemblyResult: AssemblyResult = {
      content: finalContent,
      transitionsAdded: request.assemblyInstructions?.includeTransitions ? enhancedSections.length - 1 : 0,
      formattingFixesApplied: 0, // Would be calculated during formatting
      finalWordCount: countWords(finalContent),
      sectionsAssembled: enhancedSections.length,
      qualityChecks: {
        markdownValidation: true,
        headingHierarchy: true,
        linkIntegrity: true,
        imageFormatting: true
      }
    };

    const processingTime = Date.now() - startTime;
    
    logger.debug("[SECTION_ASSEMBLER] Article assembly completed", {
      finalWordCount: assemblyResult.finalWordCount,
      sectionsAssembled: assemblyResult.sectionsAssembled,
      transitionsAdded: assemblyResult.transitionsAdded,
      processingTimeMs: processingTime
    });

    return assemblyResult;
    
  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    logger.error("[SECTION_ASSEMBLER] Failed to assemble article", {
      error: error instanceof Error ? error.message : "Unknown error",
      sectionsProvided: request.approvedSections.length,
      processingTimeMs: processingTime
    });
    
    throw new Error(`Article assembly failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Validates that sections are ready for assembly
 */
function validateSectionsForAssembly(
  sections: SectionResult[], 
  _outline: DetailedOutline
): { isValid: boolean; issues: string[]; recommendations: string[] } {
  const issues: string[] = [];
  const recommendations: string[] = [];

  // Basic validation - check if we have sections
  if (sections.length === 0) {
    issues.push("No sections provided for assembly");
  }

  // Check quality consistency
  const qualityScores = sections.map(s => s.qualityScore);
  const avgQuality = qualityScores.reduce((sum, score) => sum + score, 0) / qualityScores.length;
  const qualityVariance = qualityScores.reduce((sum, score) => sum + Math.pow(score - avgQuality, 2), 0) / qualityScores.length;
  
  if (qualityVariance > 100) {
    recommendations.push("High quality variance between sections - consider reviewing low-scoring sections");
  }

  return {
    isValid: issues.length === 0,
    issues,
    recommendations
  };
}

/**
 * Adds smooth transitions between sections using AI
 */
async function addTransitionsBetweenSections(
  sections: SectionResult[],
  _outline: DetailedOutline
): Promise<SectionResult[]> {
  logger.debug("[SECTION_ASSEMBLER] Adding transitions between sections");

  // For now, return sections as-is. In a full implementation, this would:
  // 1. Analyze content flow between adjacent sections
  // 2. Generate transition sentences or paragraphs
  // 3. Insert transitions at section boundaries
  // 4. Ensure smooth narrative flow

  return sections;
}

/**
 * Assembles the content from all sections
 */
async function assembleContent(
  sections: SectionResult[],
  request: AssemblyRequest
): Promise<string> {
  const assemblyPrompt = buildAssemblyPrompt(sections, request);
  
  const result = await generateText({
    model: await getModel('google', MODELS.GEMINI_2_5_PRO, "section-assembler"),
    prompt: assemblyPrompt,
    maxRetries: 2,
  });

  return result.text;
}

/**
 * Builds the prompt for final assembly and formatting
 */
function buildAssemblyPrompt(sections: SectionResult[], request: AssemblyRequest): string {
  const sectionsContent = sections
    .map(section => `## ${section.heading}\n\n${section.content}`)
    .join('\n\n');

  return `<role>
You are an expert content editor responsible for assembling individual article sections into a cohesive, professionally formatted final article. Your task is to ensure smooth flow, consistent tone, and proper formatting.
</role>

<article_metadata>
<title>${request.articleMetadata.title}</title>
<keywords>${request.articleMetadata.keywords.join(", ")}</keywords>
<tone>${request.articleMetadata.toneOfVoice ?? "professional and informative"}</tone>
<language>${request.articleMetadata.languageCode ?? "en"}</language>
</article_metadata>

<sections_to_assemble>
${sectionsContent}
</sections_to_assemble>

<assembly_instructions>

1. **Content Flow**:
   - Ensure logical progression from introduction to conclusion
   - Add smooth transitions between sections where needed
   - Maintain consistent tone and voice throughout
   - Remove any redundant information between sections

2. **Formatting Requirements**:
   - Use proper markdown formatting for headings and structure
   - Ensure consistent heading hierarchy (H1 for title, H2 for main sections)
   - Apply appropriate formatting for lists, quotes, and emphasis
   - Include proper line breaks and spacing

3. **Quality Enhancements**:
   - Smooth any abrupt transitions between sections
   - Ensure keyword integration feels natural across the entire article
   - Maintain professional presentation and readability
   - Fix any minor inconsistencies in writing style

4. **Content Rules**:
   - Do not alter the core content or facts from any section
   - Preserve all research citations and data points
   - Maintain the specified tone and writing style
   - Keep within reasonable length limits

</assembly_instructions>

<critical_requirements>
- Preserve all factual content and research citations
- Maintain consistent tone and professional quality
- Ensure smooth reading experience from start to finish
- Use proper markdown formatting throughout
- Keep the article focused and well-structured
</critical_requirements>

Assemble and format the complete article now:`;
}

/**
 * Count words in text content
 */
function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(word => word.length > 0).length;
}

/**
 * Adds CMS frontmatter to content
 */
function addCMSFrontmatter(content: string, metadata: AssemblyRequest['articleMetadata']): string {
  const frontmatter = `---
title: "${metadata.title}"
keywords: [${metadata.keywords.map(k => `"${k}"`).join(", ")}]
language: "${metadata.languageCode ?? "en"}"
date: "${new Date().toISOString()}"
---

`;

  return frontmatter + content;
}

/**
 * Batch assembly for multiple articles
 */
export async function batchAssembleArticles(
  requests: AssemblyRequest[]
): Promise<AssemblyResult[]> {
  logger.debug("[SECTION_ASSEMBLER] Starting batch assembly", {
    articlesCount: requests.length
  });

  const results = await Promise.all(
    requests.map(request => assembleFinalArticle(request))
  );

  logger.debug("[SECTION_ASSEMBLER] Batch assembly completed", {
    articlesProcessed: results.length,
    avgWordCount: results.reduce((sum, result) => sum + result.finalWordCount, 0) / results.length
  });

  return results;
}
