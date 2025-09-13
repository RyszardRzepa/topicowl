/**
 * Template parser service
 * Converts Markdown template strings to StructureTemplate objects for compliance validation
 */

import type { StructureTemplate, StructureSection } from "@/types";
import { logger } from "@/lib/utils/logger";

export interface ParsedMarkdownTemplate {
  structureTemplate: StructureTemplate;
  isValid: boolean;
  errors: string[];
}

/**
 * Parse a Markdown template string into a StructureTemplate object
 */
export function parseMarkdownTemplate(markdownTemplate: string): ParsedMarkdownTemplate {
  logger.debug("template-parser:start", { templateLength: markdownTemplate.length });

  const errors: string[] = [];
  const sections: StructureSection[] = [];

  try {
    const lines = markdownTemplate.split(/\r?\n/);
    let sectionCounter = 0;

    for (const currentLine of lines) {
      const line = currentLine?.trim() ?? "";
      
      // H1 Title
      if (/^#\s+/.test(line)) {
        sections.push({
          id: `title-${++sectionCounter}`,
          type: "title",
          label: line.replace(/^#\s+/, '').trim(),
          required: true
        });
      }
      
      // Table of Contents / TL;DR detection
      else if (/^##\s*(Table of Contents|TL;?DR|Quick Summary)/i.test(line)) {
        const heading = line.replace(/^##\s+/, '').trim();
        
        if (/TL;?DR/i.test(heading)) {
          sections.push({
            id: `tldr-${++sectionCounter}`,
            type: "tldr",
            label: heading,
            required: true,
            minItems: 3,
            maxItems: 6
          });
        } else if (/Quick Summary/i.test(heading)) {
          sections.push({
            id: `table-${++sectionCounter}`,
            type: "table",
            label: heading,
            required: false
          });
        }
      }
      
      // Regular H2 sections
      else if (/^##\s+/.test(line) && !/^##\s*(Table of Contents|TL;?DR|Quick Summary)/i.test(line)) {
        const heading = line.replace(/^##\s+/, '').trim();
        
        sections.push({
          id: `section-${++sectionCounter}`,
          type: "section",
          label: heading,
          required: true,
          minWords: 100 // Default minimum for content sections
        });
      }
      
      // Video detection (YouTube embeds)
      else if (line.includes('youtube.com/watch') || line.includes('youtu.be/') || line.includes('youtube.com/embed/')) {
        sections.push({
          id: `video-${++sectionCounter}`,
          type: "video",
          label: "Video Content",
          required: false
        });
      }
    }

    // Add intro section if we have a title but no explicit intro
    const hasTitle = sections.some(s => s.type === "title");
    const hasIntro = sections.some(s => s.type === "intro");
    
    if (hasTitle && !hasIntro) {
      sections.splice(1, 0, {
        id: `intro-${++sectionCounter}`,
        type: "intro",
        label: "Introduction",
        required: true
      });
    }

    // Add FAQ section if content suggests it (common pattern)
    const contentSuggestionsFaq = /FAQ|frequently asked|questions/i.test(markdownTemplate);
    const hasFaq = sections.some(s => s.type === "faq");
    
    if (contentSuggestionsFaq && !hasFaq) {
      sections.push({
        id: `faq-${++sectionCounter}`,
        type: "faq",
        label: "FAQ",
        required: false,
        minItems: 3,
        maxItems: 8
      });
    }

    // Validation
    if (sections.length === 0) {
      errors.push("No valid sections found in template");
    }
    
    if (!sections.some(s => s.type === "title")) {
      errors.push("Template must include at least one H1 title");
    }

    const structureTemplate: StructureTemplate = {
      version: 1,
      sections
    };

    const result: ParsedMarkdownTemplate = {
      structureTemplate,
      isValid: errors.length === 0,
      errors
    };

    logger.debug("template-parser:result", {
      isValid: result.isValid,
      sectionsCount: sections.length,
      errorsCount: errors.length,
      sectionTypes: sections.map(s => s.type)
    });

    return result;

  } catch (error) {
    logger.error("template-parser:error", error);
    
    return {
      structureTemplate: { version: 1, sections: [] },
      isValid: false,
      errors: [`Failed to parse template: ${error instanceof Error ? error.message : 'Unknown error'}`]
    };
  }
}

/**
 * Check if a string is a Markdown template or JSON StructureTemplate
 */
export function detectTemplateFormat(template: string): 'markdown' | 'json' | 'unknown' {
  const trimmed = template.trim();
  
  // Check for JSON format
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (
        parsed &&
        typeof parsed === "object" &&
        "sections" in (parsed as Record<string, unknown>) &&
        Array.isArray((parsed as { sections?: unknown }).sections)
      ) {
        return 'json';
      }
    } catch {
      // Not valid JSON
    }
  }
  
  // Check for Markdown format
  if (/^#\s+.+/m.test(trimmed) || /^##\s+.+/m.test(trimmed)) {
    return 'markdown';
  }
  
  return 'unknown';
}

/**
 * Convert any template format to StructureTemplate for compliance validation
 */
export function normalizeTemplate(template: string): StructureTemplate | null {
  const format = detectTemplateFormat(template);
  
  switch (format) {
    case 'json':
      try {
        return JSON.parse(template) as StructureTemplate;
      } catch {
        return null;
      }
      
    case 'markdown':
      const parsed = parseMarkdownTemplate(template);
      return parsed.isValid ? parsed.structureTemplate : null;
      
    default:
      return null;
  }
}
