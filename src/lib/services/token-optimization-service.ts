/**
 * Native AI Provider Token Optimization Service
 * 
 * Leverages native prompt caching from Gemini and Anthropic APIs instead of
 * implementing custom caching. This provides superior performance and cost optimization.
 * 
 * Features:
 * - Anthropic ephemeral caching with extended TTL
 * - Gemini 2.5 implicit caching for consistent content prefixes
 * - Context compression for token efficiency
 * - Cache hit metrics tracking
 */

import { logger } from "@/lib/utils/logger";
import type { 
  SectionResult, 
  NarrativeContext 
} from "../../types";

// Cache strategies for different content types
export const CACHE_STRATEGIES = {
  QUALITY_RUBRIC: 'system_prompt_cache',      // Cache quality rubric in system messages
  OUTLINE_TEMPLATE: 'system_prompt_cache',    // Cache outline templates
  SECTION_CONTEXT: 'ephemeral_cache',         // Cache section context with Anthropic
  RESEARCH_BASE: 'implicit_gemini_cache',     // Use Gemini's implicit caching
} as const;

/**
 * Creates cache-optimized system message for quality rubrics
 * Uses Anthropic's ephemeral caching for repeated quality evaluations
 */
export function createCachedQualityRubricMessage() {
  return {
    role: 'system' as const,
    content: `You are an expert content quality evaluator. Use this comprehensive quality rubric for all evaluations:

CONTENT COMPLETENESS (Weight: 40%)
- Key points coverage: Ensure all specified talking points are addressed (Target: 8/10)
- Statistics integration: Verify relevant data and statistics are cited (Target: 7/10)  
- Depth appropriateness: Content depth matches section requirements (Target: 8/10)

STRUCTURAL COMPLIANCE (Weight: 30%)
- Word count adherence: Section meets specified word target ±10% (Target: 8/10)
- Heading format: Proper heading structure and formatting (Target: 9/10)
- Logical flow: Ideas progress logically with smooth transitions (Target: 8/10)

QUALITY STANDARDS (Weight: 30%)
- Tone consistency: Writing matches specified professional tone (Target: 8/10)
- Concrete examples: Includes specific, relevant examples (Target: 7/10)
- Language clarity: Clear, concise, and engaging prose (Target: 9/10)
- Engagement level: Content maintains reader interest throughout (Target: 7/10)

Rate each criterion 1-10, provide overall weighted score, and identify critical issues requiring revision.`,
    providerOptions: {
      anthropic: { 
        cacheControl: { 
          type: 'ephemeral' as const,
          ttl: '1h' as const  // Extended cache for 1 hour
        } 
      },
    },
  };
}

/**
 * Creates cache-optimized system message for outline generation
 * Uses extended TTL caching for outline templates
 */
export function createCachedOutlineSystemMessage() {
  return {
    role: 'system' as const,
    content: `You are an expert content strategist specializing in detailed article outlines. Your task is to transform basic section templates into comprehensive, actionable section specifications.

SECTION ENHANCEMENT PROCESS:
1. Analyze research data for relevant statistics, examples, and expert insights
2. Create 3-5 specific talking points per section with supporting evidence
3. Identify key statistics and data points to incorporate
4. Establish logical flow and transitions between sections
5. Set appropriate word targets based on content complexity

OUTPUT REQUIREMENTS:
- Each section must have specific, actionable talking points
- Include relevant statistics with proper attribution
- Provide clear content guidance for writers
- Ensure narrative flow between sections
- Balance depth with readability

QUALITY STANDARDS:
- Professional, informative tone throughout
- Evidence-based content recommendations  
- Clear structural guidance for writers
- SEO-optimized content suggestions`,
    providerOptions: {
      anthropic: { 
        cacheControl: { 
          type: 'ephemeral' as const,
          ttl: '1h' as const
        } 
      },
    },
  };
}

/**
 * Creates compressed context optimized for Gemini's implicit caching
 * Structures content with consistent prefix for automatic cache hits
 */
export function createGeminiOptimizedContext(
  previousSections: SectionResult[],
  narrativeContext: NarrativeContext,
  baseContextPrefix: string
): {
  optimizedPrompt: string;
  cacheablePrefix: string;
  tokenEstimate: number;
} {
  // Consistent prefix for Gemini implicit caching
  const cacheablePrefix = `${baseContextPrefix}

NARRATIVE CONTEXT:
- Article Position: Section ${narrativeContext.storyArc.currentPosition} of ${narrativeContext.storyArc.totalSections}
- Story Phase: ${narrativeContext.storyArc.phase}
- Narrative Thread: ${narrativeContext.narrativeThread}`;

  // Compressed recent context (not cached)
  let recentContext = '';
  if (previousSections.length > 0) {
    const recentSections = previousSections.slice(-2); // Only last 2 sections
    recentContext = '\n\nRECENT SECTIONS SUMMARY:\n' + 
      recentSections.map(section => {
        const keyPoints = extractKeyPoints(section.content, 2);
        return `[${section.sectionId}] ${section.heading}: ${keyPoints.join('; ')}`;
      }).join('\n');
  }

  // Key concepts to avoid repetition
  let conceptsContext = '';
  if (narrativeContext.introducedConcepts.length > 0) {
    const recentConcepts = narrativeContext.introducedConcepts.slice(-5);
    conceptsContext = `\n\nCONCEPTS COVERED: ${recentConcepts.join(', ')}`;
  }

  const optimizedPrompt = cacheablePrefix + recentContext + conceptsContext;
  const tokenEstimate = estimateTokenCount(optimizedPrompt);
  
  logger.debug("[GEMINI_CACHE] Context optimized for implicit caching", {
    cacheablePrefixLength: cacheablePrefix.length,
    totalPromptLength: optimizedPrompt.length,
    tokenEstimate,
    sectionsIncluded: previousSections.length,
    conceptsIncluded: narrativeContext.introducedConcepts.length
  });

  return {
    optimizedPrompt,
    cacheablePrefix,
    tokenEstimate
  };
}

/**
 * Creates cache-optimized messages for Anthropic section generation
 * Uses ephemeral caching for context that remains consistent across sections
 */
export function createCachedSectionMessages(
  baseInstructions: string,
  previousSections: SectionResult[],
  narrativeContext: NarrativeContext
) {
  // Cache the base instructions and consistent context
  const cachedSystemMessage = {
    role: 'system' as const,
    content: baseInstructions,
    providerOptions: {
      anthropic: { 
        cacheControl: { 
          type: 'ephemeral' as const,
          ttl: '30m' as const  // 30 minutes for section generation
        } 
      },
    },
  };

  // Cache narrative context that stays relatively stable
  const cachedContextMessage = {
    role: 'system' as const,
    content: `ARTICLE NARRATIVE CONTEXT:
Story Arc: Section ${narrativeContext.storyArc.currentPosition} of ${narrativeContext.storyArc.totalSections}
Current Phase: ${narrativeContext.storyArc.phase}
Narrative Thread: ${narrativeContext.narrativeThread}

CONTENT GUIDELINES:
- Maintain professional, informative tone
- Include specific examples and statistics
- Ensure smooth transitions from previous content
- Avoid repeating previously covered concepts`,
    providerOptions: {
      anthropic: { 
        cacheControl: { 
          type: 'ephemeral' as const,
          ttl: '30m' as const
        } 
      },
    },
  };

  // Recent sections context (not cached - changes frequently)
  let recentSectionsContent = '';
  if (previousSections.length > 0) {
    const recentSections = previousSections.slice(-2);
    recentSectionsContent = 'PREVIOUS SECTIONS SUMMARY:\n' +
      recentSections.map(section => {
        const keyPoints = extractKeyPoints(section.content, 2);
        return `[${section.sectionId}]: ${keyPoints.join('; ')}`;
      }).join('\n');
  }

  return {
    cachedMessages: [cachedSystemMessage, cachedContextMessage],
    dynamicContent: recentSectionsContent
  };
}

/**
 * Tracks cache performance metrics from provider metadata
 */
export interface CacheMetrics {
  anthropicCacheHits: number;
  anthropicCacheMisses: number;
  anthropicCacheCreatedTokens: number;
  anthropicCacheReadTokens: number;
  geminiCachedTokens: number;
  totalTokensSaved: number;
  cacheEfficiencyRatio: number;
}

/**
 * Analyzes cache performance from AI SDK provider metadata
 */
export function analyzeCacheMetrics(providerMetadata: unknown): Partial<CacheMetrics> {
  const metrics: Partial<CacheMetrics> = {};

  // Anthropic cache metrics
  if (providerMetadata && typeof providerMetadata === 'object' && 'anthropic' in providerMetadata) {
    const anthMetadata = (providerMetadata as Record<string, unknown>).anthropic as Record<string, unknown>;
    if (anthMetadata && typeof anthMetadata === 'object') {
      metrics.anthropicCacheCreatedTokens = typeof anthMetadata.cacheCreationInputTokens === 'number' ? anthMetadata.cacheCreationInputTokens : 0;
      metrics.anthropicCacheReadTokens = typeof anthMetadata.cacheReadInputTokens === 'number' ? anthMetadata.cacheReadInputTokens : 0;
      metrics.anthropicCacheHits = (metrics.anthropicCacheReadTokens ?? 0) > 0 ? 1 : 0;
      metrics.anthropicCacheMisses = (metrics.anthropicCacheCreatedTokens ?? 0) > 0 ? 1 : 0;
    }
  }

  // Gemini cache metrics  
  if (providerMetadata && typeof providerMetadata === 'object' && 'google' in providerMetadata) {
    const googleMetadata = (providerMetadata as Record<string, unknown>).google as Record<string, unknown>;
    if (googleMetadata && typeof googleMetadata === 'object' && 'usageMetadata' in googleMetadata) {
      const usageMetadata = googleMetadata.usageMetadata as Record<string, unknown>;
      if (usageMetadata && typeof usageMetadata === 'object') {
        metrics.geminiCachedTokens = typeof usageMetadata.cachedContentTokenCount === 'number' ? usageMetadata.cachedContentTokenCount : 0;
      }
    }
  }

  // Calculate total savings
  const anthSavings = (metrics.anthropicCacheReadTokens ?? 0);
  const geminiSavings = (metrics.geminiCachedTokens ?? 0);
  metrics.totalTokensSaved = anthSavings + geminiSavings;

  // Cache efficiency ratio
  const totalCacheTokens = anthSavings + geminiSavings;
  let totalInputTokens = 0;
  
  if (providerMetadata && typeof providerMetadata === 'object') {
    const metadata = providerMetadata as Record<string, unknown>;
    
    // Anthropic input tokens
    if ('anthropic' in metadata && metadata.anthropic && typeof metadata.anthropic === 'object') {
      const anthData = metadata.anthropic as Record<string, unknown>;
      if ('usage' in anthData && anthData.usage && typeof anthData.usage === 'object') {
        const usage = anthData.usage as Record<string, unknown>;
        if (typeof usage.input_tokens === 'number') {
          totalInputTokens += usage.input_tokens;
        }
      }
    }
    
    // Google input tokens
    if ('google' in metadata && metadata.google && typeof metadata.google === 'object') {
      const googleData = metadata.google as Record<string, unknown>;
      if ('usageMetadata' in googleData && googleData.usageMetadata && typeof googleData.usageMetadata === 'object') {
        const usage = googleData.usageMetadata as Record<string, unknown>;
        if (typeof usage.promptTokenCount === 'number') {
          totalInputTokens += usage.promptTokenCount;
        }
      }
    }
  }
  
  if (totalInputTokens > 0) {
    metrics.cacheEfficiencyRatio = Math.round((totalCacheTokens / totalInputTokens) * 100);
  }

  return metrics;
}

/**
 * Gets cache configuration headers for extended TTL with Anthropic
 */
export function getAnthropicCacheHeaders() {
  return {
    'anthropic-beta': 'extended-cache-ttl-2025-04-11',
  };
}

// Helper functions

function extractKeyPoints(content: string, maxPoints: number): string[] {
  // Extract sentences that likely contain key information
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 20);
  
  // Prioritize sentences with numbers, statistics, or strong indicators
  const prioritizedSentences = sentences.sort((a, b) => {
    const aScore = getRelevanceScore(a);
    const bScore = getRelevanceScore(b);
    return bScore - aScore;
  });
  
  return prioritizedSentences.slice(0, maxPoints).map(s => s.trim());
}

function getRelevanceScore(sentence: string): number {
  let score = 0;
  
  // Higher score for sentences with numbers/statistics
  if (/\d+%|\d+\s*(million|billion|thousand)|\$\d+/.test(sentence)) score += 3;
  
  // Higher score for key indicator words
  if (/important|significant|key|major|critical|essential/.test(sentence.toLowerCase())) score += 2;
  
  // Moderate score for action words
  if (/shows|demonstrates|indicates|reveals|suggests/.test(sentence.toLowerCase())) score += 1;
  
  return score;
}

function estimateTokenCount(text: string): number {
  // More accurate estimation: ~3.5 characters per token for English
  return Math.ceil(text.length / 3.5);
}

/**
 * Cache optimization summary for debugging
 */
export interface CacheOptimizationSummary {
  strategy: string;
  cacheableElements: string[];
  estimatedTokensSaved: number;
  cacheHitProbability: number;
  recommendations: string[];
}

export function createCacheOptimizationSummary(
  sectionsGenerated: number,
  totalCacheMetrics: CacheMetrics
): CacheOptimizationSummary {
  const recommendations: string[] = [];
  
  if (totalCacheMetrics.cacheEfficiencyRatio < 30) {
    recommendations.push("Consider restructuring prompts for better cache consistency");
  }
  
  if (totalCacheMetrics.anthropicCacheHits < sectionsGenerated * 0.7) {
    recommendations.push("Increase use of cached system messages for repeated operations");
  }
  
  if (totalCacheMetrics.geminiCachedTokens === 0) {
    recommendations.push("Structure Gemini prompts with consistent prefixes for implicit caching");
  }

  return {
    strategy: "Native Provider Caching (Anthropic + Gemini)",
    cacheableElements: [
      "Quality rubric system messages",
      "Outline generation templates", 
      "Section context patterns",
      "Narrative instruction sets"
    ],
    estimatedTokensSaved: totalCacheMetrics.totalTokensSaved,
    cacheHitProbability: totalCacheMetrics.cacheEfficiencyRatio,
    recommendations
  };
}
