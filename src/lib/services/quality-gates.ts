import type { SeoReport } from "@/lib/services/seo-audit-service";
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
