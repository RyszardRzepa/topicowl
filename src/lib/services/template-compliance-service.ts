/**
 * Template compliance validation service
 * Validates that generated content follows the specified structure template
 */

import type { StructureTemplate, StructureSection } from "@/types";
import { logger } from "@/lib/utils/logger";

export interface TemplateComplianceResult {
  isCompliant: boolean;
  score: number; // 0-100 compliance score
  violations: TemplateViolation[];
  recommendations: string[];
}

export interface TemplateViolation {
  sectionId: string;
  sectionType: string;
  violationType: 'missing' | 'order' | 'word_count' | 'item_count' | 'format';
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  expected?: string | number;
  actual?: string | number;
}

interface ParsedContent {
  h1Count: number;
  h2Sections: Array<{
    heading: string;
    content: string;
    wordCount: number;
    position: number;
  }>;
  hasTldr: boolean;
  tldrBullets: number;
  hasFaq: boolean;
  faqItems: number;
  hasVideo: boolean;
  hasTable: boolean;
  introParagraphWordCount: number;
}

/**
 * Parse markdown content to extract structural information
 */
function parseMarkdownStructure(content: string): ParsedContent {
  const lines = content.split(/\r?\n/);
  
  let h1Count = 0;
  const h2Sections: ParsedContent['h2Sections'] = [];
  let hasTldr = false;
  let tldrBullets = 0;
  let hasFaq = false;
  let faqItems = 0;
  let hasVideo = false;
  let hasTable = false;
  let introParagraphWordCount = 0;

  // Find H1 and intro paragraph
  let h1Index = -1;
  let tldrIndex = -1;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]?.trim() ?? "";
    
    // Count H1s
    if (/^#\s+/.test(line)) {
      h1Count++;
      if (h1Index === -1) h1Index = i;
    }
    
    // Find TL;DR
    if (/^##\s*TL;?DR\s*$/i.test(line)) {
      hasTldr = true;
      tldrIndex = i;
    }
    
    // Find FAQ section
    if (/^##\s*(FAQ|Frequently Asked Questions)/i.test(line)) {
      hasFaq = true;
    }
    
    // Count H2 sections
    if (/^##\s+/.test(line) && !/^##\s*TL;?DR\s*$/i.test(line)) {
      h2Sections.push({
        heading: line.replace(/^##\s+/, '').trim(),
        content: '', // Will be filled below
        wordCount: 0, // Will be calculated below
        position: h2Sections.length
      });
    }
    
    // Check for video embeds
    if (line.includes('youtube.com/watch') || line.includes('youtu.be/') || line.includes('youtube.com/embed/')) {
      hasVideo = true;
    }
    
    // Check for tables
    if (line.includes('|') && lines[i + 1]?.includes('|')) {
      hasTable = true;
    }
  }

  // Calculate intro paragraph word count (between H1 and TL;DR or first H2)
  if (h1Index !== -1) {
    const introStart = h1Index + 1;
    const introEnd = tldrIndex !== -1 ? tldrIndex : 
                   h2Sections.length > 0 ? lines.findIndex((line, idx) => 
                     idx > h1Index && /^##\s+/.test(line.trim())) : lines.length;
    
    if (introEnd > introStart) {
      const introText = lines.slice(introStart, introEnd).join(' ').trim();
      introParagraphWordCount = introText.split(/\s+/).filter(word => word.length > 0).length;
    }
  }

  // Count TL;DR bullets
  if (hasTldr && tldrIndex !== -1) {
    for (let i = tldrIndex + 1; i < lines.length; i++) {
      const line = lines[i]?.trim() ?? "";
      if (/^##\s+/.test(line)) break; // Next section
      if (/^[\*\-\+]\s+|\d+\.\s+/.test(line)) {
        tldrBullets++;
      }
    }
  }

  // Count FAQ items
  if (hasFaq) {
    const faqPattern = /^###?\s+/;
    let inFaqSection = false;
    for (const line of lines) {
      const trimmed = line.trim();
      if (/^##\s*(FAQ|Frequently Asked Questions)/i.test(trimmed)) {
        inFaqSection = true;
        continue;
      }
      if (inFaqSection && /^##\s+/.test(trimmed)) {
        break; // End of FAQ section
      }
      if (inFaqSection && faqPattern.test(trimmed)) {
        faqItems++;
      }
    }
  }

  // Calculate word counts for H2 sections
  for (let i = 0; i < h2Sections.length; i++) {
    const section = h2Sections[i]!;
    const sectionStart = lines.findIndex(line => 
      /^##\s+/.test(line.trim()) && line.includes(section.heading)
    );
    const nextSectionStart = h2Sections[i + 1] ? 
      lines.findIndex((line, idx) => 
        idx > sectionStart && /^##\s+/.test(line.trim())
      ) : lines.length;
    
    if (sectionStart !== -1) {
      const sectionContent = lines.slice(sectionStart + 1, nextSectionStart).join(' ');
      section.content = sectionContent.trim();
      section.wordCount = sectionContent.split(/\s+/).filter(word => word.length > 0).length;
    }
  }

  return {
    h1Count,
    h2Sections,
    hasTldr,
    tldrBullets,
    hasFaq,
    faqItems,
    hasVideo,
    hasTable,
    introParagraphWordCount
  };
}

/**
 * Validate content against a structure template
 */
export function validateTemplateCompliance(
  content: string,
  template: StructureTemplate
): TemplateComplianceResult {
  logger.debug("template-compliance:start", { 
    templateVersion: template.version,
    sectionCount: template.sections.length 
  });

  const parsed = parseMarkdownStructure(content);
  const violations: TemplateViolation[] = [];
  let totalChecks = 0;
  let passedChecks = 0;

  // Validate each section in the template
  for (const section of template.sections) {
    const sectionViolations = validateSection(section, parsed);
    violations.push(...sectionViolations);
    
    // Count checks for scoring
    totalChecks += getCheckCountForSection(section);
    passedChecks += totalChecks - sectionViolations.length;
  }

  // Calculate compliance score
  const score = totalChecks > 0 ? Math.round((passedChecks / totalChecks) * 100) : 100;
  
  // Determine overall compliance
  const criticalViolations = violations.filter(v => v.severity === 'critical').length;
  const highViolations = violations.filter(v => v.severity === 'high').length;
  const isCompliant = criticalViolations === 0 && highViolations <= 1;

  // Generate recommendations
  const recommendations = generateRecommendations(violations, template);

  const result: TemplateComplianceResult = {
    isCompliant,
    score,
    violations,
    recommendations
  };

  logger.debug("template-compliance:result", {
    isCompliant,
    score,
    violationsCount: violations.length,
    criticalViolations,
    highViolations
  });

  return result;
}

/**
 * Validate a specific section against parsed content
 */
function validateSection(section: StructureSection, parsed: ParsedContent): TemplateViolation[] {
  const violations: TemplateViolation[] = [];

  switch (section.type) {
    case "title":
      if (parsed.h1Count !== 1) {
        violations.push({
          sectionId: section.id,
          sectionType: section.type,
          violationType: 'format',
          description: `Expected exactly 1 H1 title, found ${parsed.h1Count}`,
          severity: 'critical',
          expected: 1,
          actual: parsed.h1Count
        });
      }
      break;

    case "intro":
      if (parsed.introParagraphWordCount === 0) {
        violations.push({
          sectionId: section.id,
          sectionType: section.type,
          violationType: 'missing',
          description: 'Missing intro paragraph after H1 title',
          severity: 'high'
        });
      }
      break;

    case "tldr":
      if (!parsed.hasTldr && section.required !== false) {
        violations.push({
          sectionId: section.id,
          sectionType: section.type,
          violationType: 'missing',
          description: 'Missing TL;DR section',
          severity: 'high'
        });
      } else if (parsed.hasTldr) {
        const minItems = section.minItems ?? 3;
        const maxItems = section.maxItems ?? 6;
        
        if (parsed.tldrBullets < minItems) {
          violations.push({
            sectionId: section.id,
            sectionType: section.type,
            violationType: 'item_count',
            description: `TL;DR has ${parsed.tldrBullets} items, minimum required: ${minItems}`,
            severity: 'medium',
            expected: minItems,
            actual: parsed.tldrBullets
          });
        }
        
        if (parsed.tldrBullets > maxItems) {
          violations.push({
            sectionId: section.id,
            sectionType: section.type,
            violationType: 'item_count',
            description: `TL;DR has ${parsed.tldrBullets} items, maximum allowed: ${maxItems}`,
            severity: 'low',
            expected: maxItems,
            actual: parsed.tldrBullets
          });
        }
      }
      break;

    case "section":
      const sectionName = section.label ?? section.id;
      const matchingSection = parsed.h2Sections.find(s => 
        s.heading.toLowerCase().includes(sectionName.toLowerCase()) ||
        sectionName.toLowerCase().includes(s.heading.toLowerCase())
      );
      
      if (!matchingSection && section.required !== false) {
        violations.push({
          sectionId: section.id,
          sectionType: section.type,
          violationType: 'missing',
          description: `Missing required section: ${sectionName}`,
          severity: 'high'
        });
      } else if (matchingSection && section.minWords) {
        if (matchingSection.wordCount < section.minWords) {
          violations.push({
            sectionId: section.id,
            sectionType: section.type,
            violationType: 'word_count',
            description: `Section "${sectionName}" has ${matchingSection.wordCount} words, minimum required: ${section.minWords}`,
            severity: 'medium',
            expected: section.minWords,
            actual: matchingSection.wordCount
          });
        }
      }
      break;

    case "video":
      if (!parsed.hasVideo && section.enabled !== false && section.required === true) {
        violations.push({
          sectionId: section.id,
          sectionType: section.type,
          violationType: 'missing',
          description: 'Missing required video embed',
          severity: 'medium'
        });
      }
      break;

    case "table":
      if (!parsed.hasTable && section.enabled !== false && section.required === true) {
        violations.push({
          sectionId: section.id,
          sectionType: section.type,
          violationType: 'missing',
          description: 'Missing required table',
          severity: 'medium'
        });
      }
      break;

    case "faq":
      if (!parsed.hasFaq && section.required !== false) {
        violations.push({
          sectionId: section.id,
          sectionType: section.type,
          violationType: 'missing',
          description: 'Missing FAQ section',
          severity: 'high'
        });
      } else if (parsed.hasFaq) {
        const minItems = section.minItems ?? 2;
        const maxItems = section.maxItems ?? 8;
        
        if (parsed.faqItems < minItems) {
          violations.push({
            sectionId: section.id,
            sectionType: section.type,
            violationType: 'item_count',
            description: `FAQ has ${parsed.faqItems} questions, minimum required: ${minItems}`,
            severity: 'medium',
            expected: minItems,
            actual: parsed.faqItems
          });
        }
        
        if (parsed.faqItems > maxItems) {
          violations.push({
            sectionId: section.id,
            sectionType: section.type,
            violationType: 'item_count',
            description: `FAQ has ${parsed.faqItems} questions, maximum allowed: ${maxItems}`,
            severity: 'low',
            expected: maxItems,
            actual: parsed.faqItems
          });
        }
      }
      break;
  }

  return violations;
}

/**
 * Get the number of checks performed for a section (for scoring)
 */
function getCheckCountForSection(section: StructureSection): number {
  switch (section.type) {
    case "title": return 1;
    case "intro": return 1;
    case "tldr": return section.minItems || section.maxItems ? 2 : 1;
    case "section": return section.minWords ? 2 : 1;
    case "video": return section.enabled !== false ? 1 : 0;
    case "table": return section.enabled !== false ? 1 : 0;
    case "faq": return section.minItems || section.maxItems ? 2 : 1;
    default: return 1;
  }
}

/**
 * Generate actionable recommendations based on violations
 */
function generateRecommendations(
  violations: TemplateViolation[], 
  template: StructureTemplate
): string[] {
  const recommendations: string[] = [];
  
  const criticalViolations = violations.filter(v => v.severity === 'critical');
  const highViolations = violations.filter(v => v.severity === 'high');
  const mediumViolations = violations.filter(v => v.severity === 'medium');

  if (criticalViolations.length > 0) {
    recommendations.push("🚨 CRITICAL: Fix structural issues with H1 titles and basic formatting before proceeding.");
  }

  if (highViolations.length > 0) {
    const missingRequired = highViolations.filter(v => v.violationType === 'missing');
    if (missingRequired.length > 0) {
      recommendations.push(`📝 Add missing required sections: ${missingRequired.map(v => v.sectionId).join(', ')}`);
    }
  }

  if (mediumViolations.length > 0) {
    const wordCountIssues = mediumViolations.filter(v => v.violationType === 'word_count');
    if (wordCountIssues.length > 0) {
      recommendations.push("📊 Expand sections that don't meet minimum word count requirements.");
    }
    
    const itemCountIssues = mediumViolations.filter(v => v.violationType === 'item_count');
    if (itemCountIssues.length > 0) {
      recommendations.push("📋 Adjust the number of items in TL;DR and FAQ sections to meet requirements.");
    }
  }

  if (recommendations.length === 0) {
    recommendations.push("✅ Content structure fully complies with the template requirements.");
  }

  return recommendations;
}

/**
 * Format compliance result for display or logging
 */
export function formatComplianceReport(result: TemplateComplianceResult): string {
  const header = `Template Compliance Report (Score: ${result.score}/100)`;
  const status = result.isCompliant ? "✅ COMPLIANT" : "❌ NON-COMPLIANT";
  
  let report = `${header}\n${status}\n\n`;
  
  if (result.violations.length > 0) {
    report += "Violations:\n";
    for (const violation of result.violations) {
      const severity = violation.severity.toUpperCase();
      report += `- [${severity}] ${violation.description}\n`;
    }
    report += "\n";
  }
  
  if (result.recommendations.length > 0) {
    report += "Recommendations:\n";
    for (const rec of result.recommendations) {
      report += `- ${rec}\n`;
    }
  }
  
  return report;
}
