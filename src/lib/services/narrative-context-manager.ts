/**
 * Narrative Context Manager
 * Tracks story flow, content coverage, and narrative continuity across sections
 * Ensures coherent storytelling in multi-agent article generation
 */

import { logger } from "@/lib/utils/logger";
import type {
  DetailedOutline,
  SectionResult,
  NarrativeContext,
  EnhancedSectionSpec
} from "@/types";

/**
 * Creates initial narrative context for article generation
 */
export function createNarrativeContext(outline: DetailedOutline): NarrativeContext {
  const totalSections = outline.sections.length;
  
  return {
    storyArc: {
      currentPosition: 1,
      totalSections,
      phase: determineInitialPhase(totalSections)
    },
    introducedConcepts: [],
    keyThemes: extractKeyThemes(outline),
    narrativeThread: outline.contentStrategy,
    pendingTransitions: {
      fromPreviousSection: "This is the opening section of the article."
    },
    contentCoverage: {
      topicsCovered: [],
      statisticsUsed: [],
      examplesGiven: []
    }
  };
}

/**
 * Updates narrative context after each section is generated
 */
export function updateNarrativeContext(
  context: NarrativeContext,
  completedSection: SectionResult,
  nextSectionSpec?: EnhancedSectionSpec
): NarrativeContext {
  logger.debug("[NARRATIVE_CONTEXT] Updating context after section", {
    sectionId: completedSection.sectionId,
    currentPosition: context.storyArc.currentPosition
  });

  const updatedContext: NarrativeContext = {
    ...context,
    storyArc: {
      ...context.storyArc,
      currentPosition: context.storyArc.currentPosition + 1,
      phase: determineCurrentPhase(
        context.storyArc.currentPosition + 1,
        context.storyArc.totalSections
      )
    },
    introducedConcepts: [
      ...context.introducedConcepts,
      ...extractConceptsFromSection(completedSection)
    ],
    pendingTransitions: {
      fromPreviousSection: generateTransitionFromSection(completedSection),
      toNextSection: nextSectionSpec ? 
        generateTransitionToSection(completedSection, nextSectionSpec) : 
        undefined
    },
    contentCoverage: {
      topicsCovered: [
        ...context.contentCoverage.topicsCovered,
        ...extractTopicsFromSection(completedSection)
      ],
      statisticsUsed: [
        ...context.contentCoverage.statisticsUsed,
        ...extractStatisticsFromSection(completedSection)
      ],
      examplesGiven: [
        ...context.contentCoverage.examplesGiven,
        ...extractExamplesFromSection(completedSection)
      ]
    }
  };

  logger.debug("[NARRATIVE_CONTEXT] Context updated", {
    newPosition: updatedContext.storyArc.currentPosition,
    phase: updatedContext.storyArc.phase,
    conceptsCount: updatedContext.introducedConcepts.length,
    topicsCovered: updatedContext.contentCoverage.topicsCovered.length
  });

  return updatedContext;
}

/**
 * Validates narrative consistency across completed sections
 */
export function validateNarrativeConsistency(
  sections: SectionResult[],
  context: NarrativeContext
): {
  isConsistent: boolean;
  issues: string[];
  recommendations: string[];
} {
  const issues: string[] = [];
  const recommendations: string[] = [];

  // Check for content repetition
  const allContent = sections.map(s => s.content.toLowerCase()).join(' ');
  const duplicatedConcepts = findDuplicatedConcepts(allContent);
  
  if (duplicatedConcepts.length > 0) {
    issues.push(`Repeated concepts detected: ${duplicatedConcepts.join(', ')}`);
    recommendations.push("Review sections for content overlap and consolidate duplicate information");
  }

  // Check narrative flow
  const flowScore = calculateNarrativeFlowScore(sections);
  if (flowScore < 0.7) {
    issues.push("Poor narrative flow between sections");
    recommendations.push("Add transition sentences to improve section connectivity");
  }

  // Check theme consistency
  const themeConsistency = checkThemeConsistency(sections, context.keyThemes);
  if (themeConsistency < 0.8) {
    issues.push("Inconsistent theme development across sections");
    recommendations.push("Ensure all sections support the main themes identified in the outline");
  }

  return {
    isConsistent: issues.length === 0,
    issues,
    recommendations
  };
}

/**
 * Determines the narrative phase based on section position
 */
function determineInitialPhase(_totalSections: number): NarrativeContext['storyArc']['phase'] {
  return 'introduction';
}

function determineCurrentPhase(
  currentPosition: number, 
  totalSections: number
): NarrativeContext['storyArc']['phase'] {
  const progress = currentPosition / totalSections;
  
  if (progress <= 0.25) return 'introduction';
  if (progress <= 0.75) return 'development';
  if (progress <= 0.9) return 'climax';
  return 'conclusion';
}

/**
 * Extracts key themes from the outline
 */
function extractKeyThemes(outline: DetailedOutline): string[] {
  const themes: string[] = [];
  
  // Extract from content strategy
  const strategyWords = outline.contentStrategy.toLowerCase().split(/\s+/);
  const significantWords = strategyWords.filter(word => 
    word.length > 5 && !/^(the|and|but|for|with|this|that)$/.test(word)
  );
  themes.push(...significantWords.slice(0, 3));

  // Extract from research summary
  const summaryWords = outline.researchSummary.toLowerCase().split(/\s+/);
  const keyResearchWords = summaryWords.filter(word => 
    word.length > 6 && !/^(research|study|data|finding)$/.test(word)
  );
  themes.push(...keyResearchWords.slice(0, 2));

  return Array.from(new Set(themes)).slice(0, 5);
}

/**
 * Extracts concepts introduced in a section
 */
function extractConceptsFromSection(section: SectionResult): string[] {
  const content = section.content.toLowerCase();
  const concepts: string[] = [];
  
  // Look for concept introduction patterns
  const conceptPatterns = [
    /(?:introducing|concept of|definition of|understanding)\s+([a-z\s]{10,30})/gi,
    /(?:this is|refers to|means that)\s+([a-z\s]{10,30})/gi,
    /(?:known as|called|termed)\s+([a-z\s]{5,20})/gi
  ];

  conceptPatterns.forEach(pattern => {
    const matches = content.match(pattern);
    if (matches) {
      matches.forEach(match => {
        const concept = match.replace(/^[^a-z]*/, '').trim();
        if (concept.length > 5) {
          concepts.push(concept);
        }
      });
    }
  });

  return Array.from(new Set(concepts)).slice(0, 3);
}

/**
 * Generates transition text from completed section
 */
function generateTransitionFromSection(section: SectionResult): string {
  const content = section.content;
  const lastSentence = content.split(/[.!?]+/).filter(s => s.trim().length > 10).pop()?.trim();
  
  if (!lastSentence) {
    return `Building on the discussion of ${section.heading.toLowerCase()}...`;
  }

  // Create a transition based on the section's conclusion
  if (lastSentence.includes('however') || lastSentence.includes('but')) {
    return "This complexity leads us to consider...";
  }
  
  if (lastSentence.includes('therefore') || lastSentence.includes('thus')) {
    return "Given this foundation, we can now explore...";
  }
  
  return `Having established ${section.heading.toLowerCase()}, the next consideration is...`;
}

/**
 * Generates transition text to next section
 */
function generateTransitionToSection(
  completedSection: SectionResult,
  nextSectionSpec: EnhancedSectionSpec
): string {
  const nextLabel = nextSectionSpec.label.toLowerCase();
  const currentLabel = completedSection.heading.toLowerCase();
  
  return `The discussion of ${currentLabel} naturally leads us to examine ${nextLabel}.`;
}

/**
 * Extracts topics covered in a section
 */
function extractTopicsFromSection(section: SectionResult): string[] {
  // Use keywords from the section as covered topics
  return section.keywordsUsed.slice(0, 3);
}

/**
 * Extracts statistics mentioned in a section
 */
function extractStatisticsFromSection(section: SectionResult): string[] {
  const content = section.content;
  const statisticsPattern = /\d+[%$]?|\b\d+\s*(percent|million|billion|thousand|times|fold)\b/gi;
  const matches = content.match(statisticsPattern);
  
  return matches ? Array.from(new Set(matches)).slice(0, 3) : [];
}

/**
 * Extracts examples mentioned in a section
 */
function extractExamplesFromSection(section: SectionResult): string[] {
  const content = section.content;
  const examplePattern = /(?:for example|such as|including|like)\s+([^.]{10,50})/gi;
  const matches = content.match(examplePattern);
  
  return matches ? matches.slice(0, 2) : [];
}

/**
 * Finds concepts that appear multiple times across content
 */
function findDuplicatedConcepts(allContent: string): string[] {
  const words = allContent.split(/\s+/);
  const wordCounts = new Map<string, number>();
  
  words.forEach(word => {
    if (word.length > 6) {
      const cleanWord = word.replace(/[^a-z]/g, '');
      if (cleanWord.length > 6) {
        wordCounts.set(cleanWord, (wordCounts.get(cleanWord) ?? 0) + 1);
      }
    }
  });

  return Array.from(wordCounts.entries())
    .filter(([_, count]) => count > 5)
    .map(([word, _]) => word)
    .slice(0, 5);
}

/**
 * Calculates narrative flow score between sections
 */
function calculateNarrativeFlowScore(sections: SectionResult[]): number {
  if (sections.length < 2) return 1.0;

  let totalFlowScore = 0;
  
  for (let i = 1; i < sections.length; i++) {
    const prevSection = sections[i - 1];
    const currentSection = sections[i];
    
    if (prevSection && currentSection) {
      // Simple flow score based on keyword overlap and transition words
      const flowScore = calculateSectionTransitionScore(prevSection, currentSection);
      totalFlowScore += flowScore;
    }
  }

  return totalFlowScore / (sections.length - 1);
}

/**
 * Calculates transition score between two consecutive sections
 */
function calculateSectionTransitionScore(
  prevSection: SectionResult,
  currentSection: SectionResult
): number {
  const currentContent = currentSection.content.toLowerCase();
  
  // Check for transition words in current section
  const transitionWords = [
    'however', 'therefore', 'furthermore', 'additionally', 'moreover',
    'building on', 'following', 'next', 'subsequently', 'as established'
  ];
  
  const hasTransitions = transitionWords.some(word => 
    currentContent.includes(word)
  );
  
  // Check for keyword continuity
  const keywordOverlap = prevSection.keywordsUsed.filter(keyword =>
    currentSection.keywordsUsed.includes(keyword)
  ).length;
  
  const continuityScore = keywordOverlap > 0 ? 0.5 : 0;
  const transitionScore = hasTransitions ? 0.5 : 0;
  
  return continuityScore + transitionScore;
}

/**
 * Checks theme consistency across sections
 */
function checkThemeConsistency(
  sections: SectionResult[],
  keyThemes: string[]
): number {
  if (keyThemes.length === 0) return 1.0;

  let themeConsistencyScore = 0;
  
  sections.forEach(section => {
    const sectionContent = section.content.toLowerCase();
    const themesPresent = keyThemes.filter(theme =>
      sectionContent.includes(theme.toLowerCase())
    );
    
    themeConsistencyScore += themesPresent.length / keyThemes.length;
  });

  return themeConsistencyScore / sections.length;
}
