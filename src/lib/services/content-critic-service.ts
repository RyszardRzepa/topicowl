/**
 * Content Critic Service
 * Evaluates and provides feedback on generated sections for quality improvement
 * This provides objective assessment and specific improvement recommendations
 */

import { generateObject } from "ai";
import { getModel } from "@/lib/ai-models";
import { MODELS } from "@/constants";
import { logger } from "@/lib/utils/logger";
import type {
  SectionResult,
  EnhancedSectionSpec,
  CritiqueResult,
  QualityRubric
} from "@/types";
import { z } from "zod";

// Schema for AI-generated critique
const critiqueSchema = z.object({
  approved: z.boolean().describe("Whether section meets quality standards"),
  overallScore: z.number().min(0).max(100).describe("Overall quality score 0-100"),
  strengths: z.array(z.string()).describe("What the section does well"),
  weaknesses: z.array(z.string()).describe("Areas needing improvement"),
  specificIssues: z.array(z.object({
    type: z.enum(["content", "structure", "compliance", "citation", "keyword"]),
    severity: z.enum(["low", "medium", "high", "critical"]),
    description: z.string(),
    suggestion: z.string()
  })),
  improvementSuggestions: z.array(z.string()).describe("Specific actionable improvements"),
  rewriteRequired: z.boolean().describe("Whether section needs to be rewritten"),
  readabilityScore: z.number().min(0).max(100).optional(),
  keywordIntegrationScore: z.number().min(0).max(100).optional(),
  citationQualityScore: z.number().min(0).max(100).optional()
});

interface CritiqueRequest {
  section: SectionResult;
  sectionSpec: EnhancedSectionSpec;
  qualityRubric: QualityRubric;
  articleContext?: {
    title: string;
    keywords: string[];
    toneOfVoice?: string;
  };
}

/**
 * Evaluates a section against quality standards and specification requirements
 */
export async function critiqueSectionQuality(
  request: CritiqueRequest
): Promise<CritiqueResult> {
  const startTime = Date.now();
  
  logger.debug("[CONTENT_CRITIC] Starting section critique", {
    sectionId: request.section.sectionId,
    wordCount: request.section.wordCount,
    hasKeywords: request.section.keywordsUsed.length > 0,
    hasCitations: request.section.citationsUsed.length > 0
  });

  try {
    // Build the critique prompt
    const critiquePrompt = buildCritiquePrompt(request);
    
    // Generate the critique using AI
    const result = await generateObject({
      model: await getModel('google', MODELS.GEMINI_2_5_PRO, "content-critic"),
      schema: critiqueSchema,
      prompt: critiquePrompt,
      maxRetries: 2,
    });

    const critique = result.object;
    
    // Convert to our internal format
    const critiqueResult: CritiqueResult = {
      approved: critique.approved,
      overallScore: critique.overallScore,
      feedback: {
        contentCompleteness: {
          score: calculateContentDepthScore(request.section, request.sectionSpec),
          issues: critique.specificIssues
            .filter(issue => issue.type === 'content')
            .map(issue => issue.description),
          suggestions: critique.improvementSuggestions.slice(0, 3)
        },
        structuralCompliance: {
          score: calculateComplianceScore(request.section, request.sectionSpec),
          issues: critique.specificIssues
            .filter(issue => issue.type === 'structure')
            .map(issue => issue.description),
          suggestions: critique.improvementSuggestions.slice(3, 6)
        },
        qualityStandards: {
          score: critique.overallScore,
          issues: critique.weaknesses,
          suggestions: critique.improvementSuggestions.slice(6)
        }
      },
      actionableSteps: critique.improvementSuggestions,
      criticalIssues: critique.specificIssues
        .filter(issue => issue.severity === 'critical')
        .map(issue => issue.description),
      approvable: critique.approved && !critique.rewriteRequired
    };

    const processingTime = Date.now() - startTime;
    
    logger.debug("[CONTENT_CRITIC] Section critique completed", {
      sectionId: request.section.sectionId,
      approved: critique.approved,
      overallScore: critique.overallScore,
      issuesFound: critique.specificIssues.length,
      rewriteRequired: critique.rewriteRequired,
      processingTimeMs: processingTime
    });

    return critiqueResult;
    
  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    logger.error("[CONTENT_CRITIC] Failed to critique section", {
      error: error instanceof Error ? error.message : "Unknown error",
      sectionId: request.section.sectionId,
      processingTimeMs: processingTime
    });
    
    throw new Error(`Section critique failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Builds the comprehensive prompt for content critique
 */
function buildCritiquePrompt(request: CritiqueRequest): string {
  const {
    section,
    sectionSpec,
    qualityRubric,
    articleContext
  } = request;

  return `<role>
You are an expert content critic and quality assessor specializing in evaluating article sections. Your task is to provide objective, detailed feedback on content quality, compliance with specifications, and overall effectiveness.
</role>

<evaluation_context>
${articleContext ? `
<article_title>${articleContext.title}</article_title>
<target_keywords>${articleContext.keywords.join(", ")}</target_keywords>
<tone_of_voice>${articleContext.toneOfVoice ?? "professional and informative"}</tone_of_voice>
` : ''}
</evaluation_context>

<section_specification>
<section_id>${sectionSpec.id}</section_id>
<section_type>${sectionSpec.type}</section_type>
<section_label>${sectionSpec.label}</section_label>
<required_talking_points>
${sectionSpec.talkingPoints.map((point, index) => `${index + 1}. ${point}`).join('\n')}
</required_talking_points>
<target_keywords>
${sectionSpec.keywordTargets.map(keyword => `- ${keyword}`).join('\n')}
</target_keywords>
<required_citations>
${sectionSpec.researchCitations.map((citation, index) => `[R${index + 1}] ${citation}`).join('\n')}
</required_citations>
<word_target>Min: ${sectionSpec.wordTarget.min} | Max: ${sectionSpec.wordTarget.max} | Target: ${sectionSpec.wordTarget.target ?? sectionSpec.wordTarget.min}</word_target>
<content_rules>
${sectionSpec.contentRules.map(rule => `- [${rule.priority.toUpperCase()}] ${rule.description}`).join('\n')}
</content_rules>
<validation_criteria>
${sectionSpec.validationCriteria.map(criteria => `- [${criteria.type.toUpperCase()}] ${criteria.description}`).join('\n')}
</validation_criteria>
</section_specification>

<quality_rubric>
<content_completeness>Weight: ${qualityRubric.contentCompleteness.weight}</content_completeness>
<structural_compliance>Weight: ${qualityRubric.structuralCompliance.weight}</structural_compliance>
<quality_standards>Weight: ${qualityRubric.qualityStandards.weight}</quality_standards>
</quality_rubric>

<section_to_evaluate>
<heading>${section.heading}</heading>
<content>
${section.content}
</content>
<word_count>${section.wordCount}</word_count>
<keywords_used>${section.keywordsUsed.join(", ")}</keywords_used>
<citations_used>${section.citationsUsed.join(" | ")}</citations_used>
</section_to_evaluate>

<evaluation_instructions>

1. **Specification Compliance**:
   - Check if all required talking points are addressed
   - Verify word count falls within target range
   - Confirm required keywords are naturally integrated
   - Ensure research citations are properly used and attributed

2. **Content Quality Assessment**:
   - Evaluate clarity, coherence, and logical flow
   - Assess depth of information and specificity
   - Check for actionable insights and practical value
   - Verify tone consistency and appropriate style

3. **Technical Compliance**:
   - Review adherence to content rules
   - Check validation criteria fulfillment
   - Identify any compliance violations
   - Assess SEO and readability factors

4. **Critical Issues Detection**:
   - Flag any automatic rejection triggers
   - Identify factual inconsistencies or unsupported claims
   - Note generic language or lack of specificity
   - Check for keyword stuffing or unnatural integration

5. **Improvement Recommendations**:
   - Provide specific, actionable suggestions
   - Prioritize issues by severity and impact
   - Suggest concrete improvements for identified weaknesses
   - Determine if rewrite is necessary vs. minor edits

</evaluation_instructions>

<scoring_guidelines>
- **90-100**: Exceptional quality, exceeds all requirements
- **80-89**: High quality, meets all requirements with minor room for improvement
- **70-79**: Good quality, meets most requirements but has notable gaps
- **60-69**: Acceptable quality, meets minimum standards but needs improvement
- **Below 60**: Poor quality, significant issues requiring major revision or rewrite

Score individual aspects:
- **Readability**: How clear and engaging is the writing?
- **Keyword Integration**: How naturally are keywords incorporated?
- **Citation Quality**: How well are research findings integrated and attributed?
</scoring_guidelines>

<critical_requirements>
- Be objective and specific in all feedback
- Provide actionable improvement suggestions
- Flag any content that violates quality standards
- Consider the section's role in the overall article
- Balance high standards with practical content goals
</critical_requirements>

Evaluate the section now and provide detailed critique:`;
}

/**
 * Calculate content depth score based on specificity and detail level
 */
function calculateContentDepthScore(
  section: SectionResult,
  sectionSpec: EnhancedSectionSpec
): number {
  let score = 50; // Base score
  
  // Check talking points coverage
  const addressedPoints = sectionSpec.talkingPoints.filter(point => {
    const keywords = point.toLowerCase().split(' ').filter(word => word.length > 3);
    return keywords.some(keyword => section.content.toLowerCase().includes(keyword));
  });
  
  const coverageRatio = addressedPoints.length / sectionSpec.talkingPoints.length;
  score += coverageRatio * 30; // Up to 30 points for talking point coverage
  
  // Check for specific data and examples
  const hasNumbers = /\d+[%\$]?|\$\d+|[0-9]+(\.[0-9]+)?/.test(section.content);
  const hasExamples = /for example|such as|instance|specifically|particularly/i.test(section.content);
  
  if (hasNumbers) score += 10;
  if (hasExamples) score += 10;
  
  return Math.min(score, 100);
}

/**
 * Calculate compliance score based on rule adherence
 */
function calculateComplianceScore(
  section: SectionResult,
  sectionSpec: EnhancedSectionSpec
): number {
  let score = 100; // Start with perfect score and deduct
  
  // Check word count compliance
  const { wordCount } = section;
  const { min, max } = sectionSpec.wordTarget;
  
  if (wordCount < min) {
    const shortfall = (min - wordCount) / min;
    score -= shortfall * 20; // Deduct up to 20 points for being too short
  } else if (wordCount > max) {
    const excess = (wordCount - max) / max;
    score -= Math.min(excess * 15, 15); // Deduct up to 15 points for being too long
  }
  
  // Check keyword integration
  const keywordScore = (section.keywordsUsed.length / Math.max(sectionSpec.keywordTargets.length, 1)) * 20;
  score += keywordScore - 20; // Could add or subtract up to 20 points
  
  // Check citation usage
  const citationScore = section.citationsUsed.length > 0 ? 10 : -10;
  score += citationScore;
  
  return Math.max(Math.min(score, 100), 0);
}

/**
 * Batch critique multiple sections for consistency checking
 */
export async function batchCritiqueSections(
  requests: CritiqueRequest[]
): Promise<CritiqueResult[]> {
  logger.debug("[CONTENT_CRITIC] Starting batch critique", {
    sectionsCount: requests.length
  });

  const critiques = await Promise.all(
    requests.map(request => critiqueSectionQuality(request))
  );

  // Check for consistency issues across sections
  const consistencyIssues = analyzeConsistencyAcrossSections(requests, critiques);
  
  // Add consistency feedback to critiques if issues found
  if (consistencyIssues.length > 0) {
    critiques.forEach(critique => {
      critique.actionableSteps.push(...consistencyIssues);
    });
  }

  logger.debug("[CONTENT_CRITIC] Batch critique completed", {
    sectionsEvaluated: critiques.length,
    approvedSections: critiques.filter(c => c.approved).length,
    avgScore: critiques.reduce((sum, c) => sum + c.overallScore, 0) / critiques.length,
    consistencyIssues: consistencyIssues.length
  });

  return critiques;
}

/**
 * Analyze consistency issues across multiple sections
 */
function analyzeConsistencyAcrossSections(
  requests: CritiqueRequest[],
  critiques: CritiqueResult[]
): string[] {
  const issues: string[] = [];
  
  // Check tone consistency
  const toneVariations = new Set<string>();
  requests.forEach(req => {
    if (req.articleContext?.toneOfVoice) {
      toneVariations.add(req.articleContext.toneOfVoice);
    }
  });
  
  if (toneVariations.size > 1) {
    issues.push("Inconsistent tone detected across sections");
  }
  
  // Check quality score variance
  const scores = critiques.map(c => c.overallScore);
  const avgScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  const variance = scores.reduce((sum, score) => sum + Math.pow(score - avgScore, 2), 0) / scores.length;
  
  if (variance > 400) { // High variance threshold
    issues.push("Significant quality variance between sections - review for consistency");
  }
  
  return issues;
}
