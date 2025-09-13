import type { SeoReport } from "@/lib/services/seo-audit-service";
import type { SeoChecklist } from "@/types";
import { SEO_MIN_SCORE } from "@/constants";

export type GateResult = {
  passed: boolean;
  failures: { code: string; reason: string }[];
};

export interface QualityGateOptions {
  minScore?: number; // default SEO_MIN_SCORE
  requireNoHighIssues?: boolean; // default true
  requireImageAlt?: boolean; // default false for now
  minH2?: number; // default 3
  minChars?: number; // default 800
  // Link health
  observedBrokenExternalLinks?: number; // default 0
  maxBrokenExternalLinks?: number; // default 0
}

export function passesQualityGates(
  report: SeoReport,
  opts: QualityGateOptions = {},
): GateResult {
  const {
    minScore = SEO_MIN_SCORE,
    requireNoHighIssues = true,
    requireImageAlt = false,
    minH2 = 3,
    minChars = 800,
    observedBrokenExternalLinks = 0,
    maxBrokenExternalLinks = 0,
  } = opts;

  const failures: { code: string; reason: string }[] = [];

  if (report.score < minScore) {
    failures.push({
      code: "SCORE_BELOW_THRESHOLD",
      reason: `SEO score ${report.score} is below ${minScore}`,
    });
  }

  if (requireNoHighIssues) {
    const hasHigh = report.issues.some(
      (i) => i.severity === "HIGH" || i.severity === "CRITICAL",
    );
    if (hasHigh) {
      failures.push({
        code: "HIGH_OR_CRITICAL_ISSUES",
        reason: "Report contains HIGH/CRITICAL issues",
      });
    }
  }

  // Structure
  const { headings, images, chars } = report.metrics;
  if (!headings.hasSingleH1) {
    failures.push({ code: "INVALID_H1_COUNT", reason: "Exactly one H1 required" });
  }
  if (headings.h2Count < minH2) {
    failures.push({ code: "INSUFFICIENT_H2", reason: `At least ${minH2} H2 headings required` });
  }
  if (chars < minChars) {
    failures.push({ code: "CONTENT_TOO_SHORT", reason: `Content must be ≥ ${minChars} chars` });
  }

  // Image alt
  if (requireImageAlt && !images.hasAtLeastOneWithAlt) {
    failures.push({ code: "MISSING_IMAGE_ALT", reason: "At least one image with alt text required" });
  }

  // Link health
  if (observedBrokenExternalLinks > maxBrokenExternalLinks) {
    failures.push({
      code: "BROKEN_EXTERNAL_LINKS",
      reason: `${observedBrokenExternalLinks} broken external links detected (allowed: ${maxBrokenExternalLinks})`,
    });
  }

  return { passed: failures.length === 0, failures };
}

export interface ChecklistGateOptions {
  allowNoImages?: boolean; // default true: if no images, don't require alt
  requireFaq?: boolean; // default true
  maxBrokenExternalLinks?: number; // default 0
}

export function passesChecklist(
  checklist: SeoChecklist,
  opts: ChecklistGateOptions = {},
): GateResult {
  const {
    allowNoImages = true,
    requireFaq = true,
    maxBrokenExternalLinks = 0,
  } = opts;

  const failures: { code: string; reason: string }[] = [];

  // Structure
  if (!checklist.structure.singleH1) failures.push({ code: "STRUCTURE_SINGLE_H1", reason: "Exactly one H1 required" });
  if (!checklist.structure.h2CountOk) failures.push({ code: "STRUCTURE_H2_RANGE", reason: "H2 count must be within expected range" });
  if (!checklist.structure.hasTldr) failures.push({ code: "STRUCTURE_TLDR_MISSING", reason: "TL;DR section missing" });
  if (requireFaq && !checklist.structure.hasFaq) failures.push({ code: "STRUCTURE_FAQ_MISSING", reason: "FAQ section missing" });

  // Section-level validators
  if (typeof (checklist).structure?.tldrCountOk === "boolean" && !(checklist).structure.tldrCountOk) {
    failures.push({ code: "TLDR_COUNT_INVALID", reason: "TL;DR must contain 3–6 items" });
  }
  if (typeof (checklist).structure?.sectionMinWordsOk === "boolean" && !(checklist).structure.sectionMinWordsOk) {
    failures.push({ code: "SECTION_MIN_WORDS", reason: "One or more sections below minimum words" });
  }
  if (typeof (checklist).structure?.faqItemsCountOk === "boolean" && !(checklist).structure.faqItemsCountOk) {
    failures.push({ code: "FAQ_ITEMS_COUNT", reason: "FAQ must contain 2–5 questions" });
  }

  // Links
  if (!checklist.links.internalMin) failures.push({ code: "LINKS_INTERNAL_MIN", reason: "At least 2 internal links required" });
  if (!checklist.links.externalMin) failures.push({ code: "LINKS_EXTERNAL_MIN", reason: "At least 3 external links required" });
  if (checklist.links.brokenExternalLinks > maxBrokenExternalLinks) failures.push({ code: "LINKS_BROKEN", reason: `${checklist.links.brokenExternalLinks} broken external links detected` });

  // Citations
  if (!checklist.citations.citedSourcesMin) failures.push({ code: "CITATIONS_MISSING", reason: "Citations or Sources section required" });

  // Quotes & stats
  if (!checklist.quotes.hasExpertQuote) failures.push({ code: "QUOTE_MISSING", reason: "At least one expert quote required" });
  if (!checklist.stats.hasTwoDataPoints) failures.push({ code: "STATS_INSUFFICIENT", reason: "At least two numeric data points required" });

  // Images
  if (checklist.images.requiredWhenLinks === false) {
    failures.push({ code: "IMAGES_REQUIRED_WHEN_LINKS", reason: "At least one image is required when external links are present" });
  }
  if (checklist.images.maxThree === false) {
    failures.push({ code: "IMAGES_MAX_THREE", reason: "No more than 3 images allowed" });
  }
  if (checklist.images.spreadOut === false) {
    failures.push({ code: "IMAGES_SPREAD", reason: "Images should not be back-to-back; spread across the article" });
  }
  if (!checklist.images.allHaveAlt && !allowNoImages) failures.push({ code: "IMAGES_ALT_MISSING", reason: "All images must have alt text" });

  // Keywords
  if (!checklist.keywords.h1HasPrimary) failures.push({ code: "KEYWORD_H1_MISSING", reason: "H1 must include a primary keyword" });

  // Meta
  if (!checklist.meta.metaDescriptionOk) failures.push({ code: "META_DESCRIPTION", reason: "Meta description missing or too long" });
  if (!checklist.meta.slugPresent) failures.push({ code: "META_SLUG", reason: "Slug is missing" });

  // JSON-LD
  if (!checklist.jsonLd.blogPosting) failures.push({ code: "JSONLD_BLOGPOSTING", reason: "BlogPosting JSON-LD missing" });
  if (requireFaq && !checklist.jsonLd.faqPage) failures.push({ code: "JSONLD_FAQPAGE", reason: "FAQPage JSON-LD missing" });

  return { passed: failures.length === 0, failures };
}
