import { db } from "@/server/db";
import { articles, articleGeneration } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { SEO_MIN_SCORE } from "@/constants";
import {
  extractHeadings,
  extractLinks,
  countWords,
  estimateReadingEase,
} from "@/lib/utils/markdown";

export type IssueSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface SeoIssue {
  code: string;
  severity: IssueSeverity;
  message: string;
}

export interface SeoMetrics {
  words: number;
  chars: number;
  readingEase: number;
  headings: {
    h1Count: number;
    h2Count: number;
    h3Count: number;
    hasSingleH1: boolean;
  };
  links: {
    total: number;
    external: number;
    internal: number;
  };
  images: {
    total: number;
    withAlt: number;
    hasAtLeastOneWithAlt: boolean;
  };
}

export interface SeoReport {
  score: number; // 0-100
  issues: SeoIssue[];
  metrics: SeoMetrics;
  rubricVersion: string; // bump if scoring changes
}

export interface SeoAuditParams {
  generationId: number;
  articleId: number;
  content: string;
  targetKeywords?: string[];
  updateArticleScore?: boolean;
}

// Regexes kept local for determinism and performance
const imageRe = /!\[([^\]]*)\]\(([^)]+)\)/g;

function analyze(content: string, targetKeywords?: string[]): {
  metrics: SeoMetrics;
  issues: SeoIssue[];
  score: number;
} {
  const words = countWords(content);
  const chars = content.replace(/```[\s\S]*?```/g, "").length;
  const readingEase = estimateReadingEase(content);

  const headings = extractHeadings(content);
  const h1Count = headings.filter((h) => h.level === 1).length;
  const h2Count = headings.filter((h) => h.level === 2).length;
  const h3Count = headings.filter((h) => h.level === 3).length;

  const links = extractLinks(content);
  const external = links.filter((l) => !l.internal).length;
  const internal = links.filter((l) => l.internal).length;

  let imgMatch: RegExpExecArray | null;
  let imagesTotal = 0;
  let withAlt = 0;
  imageRe.lastIndex = 0;
  while ((imgMatch = imageRe.exec(content))) {
    imagesTotal += 1;
    const alt = (imgMatch[1] ?? "").trim();
    if (alt.length > 0) withAlt += 1;
  }

  const metrics: SeoMetrics = {
    words,
    chars,
    readingEase,
    headings: {
      h1Count,
      h2Count,
      h3Count,
      hasSingleH1: h1Count === 1,
    },
    links: {
      total: links.length,
      external,
      internal,
    },
    images: {
      total: imagesTotal,
      withAlt,
      hasAtLeastOneWithAlt: imagesTotal > 0 && withAlt > 0,
    },
  };

  // Scoring rubric (deterministic)
  // Start at 100, apply deductions based on metrics. Keep rubricVersion in sync when changing.
  let score = 100;
  const issues: SeoIssue[] = [];

  // Heading structure
  if (h1Count !== 1) {
    score -= 15;
    issues.push({
      code: "HEADING_H1_COUNT",
      severity: h1Count === 0 ? "HIGH" : "MEDIUM",
      message: h1Count === 0 ? "Missing H1 heading" : "Multiple H1 headings",
    });
  }
  if (h2Count < 3) {
    const deficit = 3 - h2Count;
    score -= Math.min(15, deficit * 5);
    issues.push({
      code: "HEADING_H2_MIN",
      severity: "MEDIUM",
      message: `Add at least ${deficit} more H2 headings (need 3 total)`,
    });
  }

  // Length
  if (chars < 800) {
    score -= 20;
    issues.push({
      code: "LENGTH_MIN_CHARS",
      severity: "HIGH",
      message: "Article should be at least 800 characters",
    });
  } else if (words < 300) {
    score -= 10;
    issues.push({
      code: "LENGTH_LOW_WORDS",
      severity: "MEDIUM",
      message: "Article may be too short; aim for 300+ words",
    });
  }

  // Readability
  if (readingEase < 50) {
    score -= 10;
    issues.push({
      code: "READABILITY_LOW",
      severity: "MEDIUM",
      message: `Reading Ease is low (${readingEase}). Aim for ≥ 50`,
    });
  }

  // Keyword in H1 (optional)
  if (targetKeywords && targetKeywords.length > 0) {
    const h1 = headings.find((h) => h.level === 1)?.text?.toLowerCase() ?? "";
    const hasKeyword = targetKeywords.some((k) => h1.includes(k.toLowerCase()));
    if (!hasKeyword) {
      score -= 5;
      issues.push({
        code: "H1_KEYWORD_MISSING",
        severity: "LOW",
        message: "Consider including a target keyword in the H1",
      });
    }
  }

  // Clamp score
  score = Math.max(0, Math.min(100, Math.round(score)));

  return { metrics, issues, score };
}

export async function runSeoAudit({
  generationId,
  articleId,
  content,
  targetKeywords,
  updateArticleScore = true,
}: SeoAuditParams): Promise<SeoReport> {
  const { metrics, issues, score } = analyze(content, targetKeywords);

  const report: SeoReport = {
    score,
    issues,
    metrics,
    rubricVersion: "v1.0.0",
  };

  // Persist to DB: set currentPhase to seo-audit and save report
  await db
    .update(articleGeneration)
    .set({
      currentPhase: "seo-audit",
      seoReport: report as unknown as Record<string, unknown>,
      updatedAt: new Date(),
      lastUpdated: new Date(),
    })
    .where(eq(articleGeneration.id, generationId));

  if (updateArticleScore) {
    await db
      .update(articles)
      .set({ seoScore: score, updatedAt: new Date() })
      .where(eq(articles.id, articleId));
  }

  // Optional log to help tuning
  console.log("SEO_AUDIT", {
    generationId,
    articleId,
    score,
    meetsThreshold: score >= SEO_MIN_SCORE,
  });

  return report;
}
