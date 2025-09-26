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
import { extractClaimsPrompt } from './extract-claims';
import { verifyClaimsPrompt } from './verify-claims';
import write from './write';
import update from './update';

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
  extractClaimsPrompt,
  verifyClaimsPrompt,
  write,
  update,
};