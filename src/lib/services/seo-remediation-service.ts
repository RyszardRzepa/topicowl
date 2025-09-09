import { generateText } from "ai";
import { MODELS } from "@/constants";
import { prompts } from "@/prompts";
import type { SeoReport } from "@/lib/services/seo-audit-service";
import { getModel } from "../ai-models";

export interface SeoRemediationParams {
  articleMarkdown: string;
  seoReport: SeoReport;
  // Pass-through for prompts to constrain link changes; can be object or pre-stringified JSON
  validationReportJson?: Record<string, unknown> | string;
  targetKeywords?: string[];
  internalLinks?: string[];
  languageCode?: string;
  maxWords?: number;
}

export interface SeoRemediationResponse {
  updatedMarkdown: string;
}

/**
 * Calls prompts.seoAuditFix to adjust headings/keywords/readability only; no new facts/links.
 * Returns updated Markdown.
 */
export async function performSeoRemediation(
  params: SeoRemediationParams,
): Promise<SeoRemediationResponse> {
  const seoReportJson = JSON.stringify(params.seoReport);
  const validationReportJson: string | undefined =
    typeof params.validationReportJson === "string"
      ? params.validationReportJson
      : params.validationReportJson
      ? JSON.stringify(params.validationReportJson)
      : undefined;

  const prompt = prompts.seoAuditFix(params.articleMarkdown, {
    seoReportJson,
    validationReportJson,
    targetKeywords: params.targetKeywords,
    internalLinks: params.internalLinks,
    languageCode: params.languageCode,
    maxWords: params.maxWords,
  });

  const model = await getModel('google',MODELS.GEMINI_2_5_FLASH, "seo-remedation-service")
  const { text } = await generateText({ model, prompt });

  return { updatedMarkdown: text };
}
