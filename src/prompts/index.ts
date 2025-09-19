// Export all prompt functions to maintain the same API as the original prompts.ts
export { generateIdeas } from './generate-ideas';
export { research } from './research';
export { seoAuditFix } from './seo-audit-fix';
export { validation } from './validation';
export { outline } from './outline';
export { qualityControl } from './quality-control';
export { updateWithQualityControl } from './update-with-quality-control';
export { websiteAnalysis } from './website-analysis';
export { articleStructure, articleStructureTemplate2 } from './article-structure';
export { writingWithOutline } from './writing-with-outline';

// Import individual prompt functions/objects
import { generateIdeas } from './generate-ideas';
import { research } from './research';
import { seoAuditFix } from './seo-audit-fix';
import { validation } from './validation';
import { outline } from './outline';
import { qualityControl } from './quality-control';
import { updateWithQualityControl } from './update-with-quality-control';
import { websiteAnalysis } from './website-analysis';
import { articleStructure, articleStructureTemplate2 } from './article-structure';
import { writingWithOutline } from './writing-with-outline';

// Import default exports for write and update
import write from './write';
import update from './update';

// Export default exports for backward compatibility
export { default as write } from './write';
export { default as update } from './update';

// Aggregate exports under prompts object for backward compatibility
export const prompts = {
  generateIdeas,
  research,
  seoAuditFix,
  validation,
  outline,
  qualityControl,
  updateWithQualityControl,
  websiteAnalysis,
  articleStructure,
  articleStructureTemplate2,
  writingWithOutline,
  write,
  update,
};