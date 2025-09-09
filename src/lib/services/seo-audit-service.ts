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
import type { SeoChecklist, StructureTemplate } from "@/types";

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

  // Compute and persist checklist snapshot for gates/UX
  try {
    const h1Text = extractHeadings(content).find((h) => h.level === 1)?.text?.toLowerCase() ?? "";
    const h1HasPrimary = (targetKeywords ?? []).some((k) => h1Text.includes((k || "").toLowerCase()));

    // Derive broken external link count from artifacts.screenshots statuses when available
    const [gen] = await db
      .select({ artifacts: articleGeneration.artifacts, schemaJson: articleGeneration.schemaJson, outline: articleGeneration.outline })
      .from(articleGeneration)
      .where(eq(articleGeneration.id, generationId))
      .limit(1);
    // Resolve outline template if present
    let outlineTemplate: StructureTemplate | null = null;
    try {
      const raw = gen?.outline as unknown;
      if (
        raw &&
        typeof raw === "object" &&
        raw !== null &&
        "sections" in (raw as Record<string, unknown>) &&
        Array.isArray((raw as { sections?: unknown }).sections)
      ) {
        outlineTemplate = raw as StructureTemplate;
      }
    } catch {
      outlineTemplate = null;
    }

    // Template-derived expectations
    const requiresTldr = !!outlineTemplate?.sections.some((s) => s.type === "tldr" && (s.enabled ?? true));
    const requiresFaq = !!outlineTemplate?.sections.some((s) => s.type === "faq" && (s.enabled ?? true));
    const tldrSection = outlineTemplate?.sections.find((s) => s.type === "tldr");
    const faqSection = outlineTemplate?.sections.find((s) => s.type === "faq");
    const minWordsFromTemplate = (() => {
      if (!outlineTemplate) return undefined as number | undefined;
      const mins = outlineTemplate.sections
        .filter((s) => s.type === "section" && typeof s.minWords === "number")
        .map((s) => s.minWords as number);
      if (mins.length === 0) return undefined;
      return Math.min(...mins);
    })();
    const expectedH2Min = (() => {
      if (!outlineTemplate) return 3;
      const base = outlineTemplate.sections.filter((s) => s.type === "section" && (s.enabled ?? true)).length;
      return base + (requiresTldr ? 1 : 0) + (requiresFaq ? 1 : 0);
    })();

    // Presence checks depend on template: if not required, treat as satisfied
    const hasTldr = requiresTldr ? /\n##\s*TL;DR\s*\n/i.test(content) : true;
    const hasFaq = requiresFaq ? /\n##\s*FAQ\s*\n/i.test(content) : true;
    let brokenExternalLinks = 0;
    try {
      const artifacts = gen?.artifacts as Record<string, unknown> | undefined;
      const shots = artifacts?.screenshots as Record<string, { status?: number } | undefined> | undefined;
      if (shots && typeof shots === "object") {
        for (const k of Object.keys(shots)) {
          const st = shots[k]?.status ?? 200;
          if (typeof st === "number" && st >= 400) brokenExternalLinks += 1;
        }
      }
    } catch {
      brokenExternalLinks = 0;
    }

    // Meta info from articles
    const [art] = await db
      .select({ slug: articles.slug, metaDescription: articles.metaDescription })
      .from(articles)
      .where(eq(articles.id, articleId))
      .limit(1);

    // JSON-LD presence from schema_json
    let hasBlogPosting = false;
    let hasFaqPage = false;
    try {
      const raw = gen?.schemaJson ?? null;
      if (raw) {
        const parsed = JSON.parse(String(raw)) as unknown;
        const arr = Array.isArray(parsed) ? parsed : [parsed];
        hasBlogPosting = arr.some((obj: unknown) => obj && typeof obj === 'object' && obj !== null && (obj as Record<string, unknown>)["@type"] === "BlogPosting");
        hasFaqPage = arr.some((obj: unknown) => obj && typeof obj === 'object' && obj !== null && (obj as Record<string, unknown>)["@type"] === "FAQPage");
      }
    } catch {
      // ignore parse errors
    }

    // Section-level checks
    const tldrCountOk = (() => {
      if (!requiresTldr) return true;
      const lines = content.split(/\r?\n/);
      const idx = lines.findIndex((l) => /^\s*##\s*TL;DR\s*$/i.test(l));
      if (idx === -1) return false;
      let count = 0;
      for (let i = idx + 1; i < lines.length; i++) {
        const l = lines[i];
        if (l && /^\s*##\s+/.test(l)) break; // next H2
        if (l && /^\s*[-*]\s+/.test(l)) count += 1;
      }
      const min = tldrSection?.minItems ?? 3;
      const max = tldrSection?.maxItems ?? 6;
      return count >= min && count <= max;
    })();

    const sectionMinWordsOk = (() => {
      // Gather H2 blocks excluding TL;DR and FAQ
      const lines = content.split(/\r?\n/);
      const h2Idxs: { index: number; text: string }[] = [];
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line && /^\s*##\s+/.test(line)) {
          const text = line.replace(/^\s*##\s+/, "").trim();
          if (!/^TL;DR$/i.test(text) && !/^FAQ$/i.test(text) && text.length > 0) {
            h2Idxs.push({ index: i, text });
          }
        }
      }
      h2Idxs.push({ index: lines.length, text: "__END__" });
      const minWords = (minWordsFromTemplate ?? 120); // conservative lower bound fallback
      for (let i = 0; i < h2Idxs.length - 1; i++) {
        const h2Idx = h2Idxs[i];
        const nextH2Idx = h2Idxs[i + 1];
        if (h2Idx && nextH2Idx) {
          const start = h2Idx.index + 1;
          const end = nextH2Idx.index;
          const block = lines.slice(start, end).join("\n");
          const words = countWords(block);
          if (words > 0 && words < minWords) return false;
        }
      }
      return true;
    })();

    const faqItemsCountOk = (() => {
      if (!requiresFaq) return true;
      const lines = content.split(/\r?\n/);
      const idx = lines.findIndex((l) => /^\s*##\s*FAQ\s*$/i.test(l));
      if (idx === -1) return false;
      let count = 0;
      for (let i = idx + 1; i < lines.length; i++) {
        const l = lines[i];
        if (l && /^\s*##\s+/.test(l)) break; // next H2
        if (l && /^\s*####\s+/.test(l)) count += 1;
      }
      const min = faqSection?.minItems ?? 2;
      const max = faqSection?.maxItems ?? 5;
      return count >= min && count <= max;
    })();

    // Image spread check: ensure image lines aren't consecutive
    const imgLineIdxs = (() => {
      const lns = content.split(/\r?\n/);
      const out: number[] = [];
      for (let i = 0; i < lns.length; i++) {
        const line = lns[i];
        if (line && /^\s*!\[[^\]]*\]\([^\)]+\)/.test(line)) out.push(i);
      }
      return out;
    })();

    const spreadOut = (() => {
      if (imgLineIdxs.length <= 1) return true;
      for (let i = 1; i < imgLineIdxs.length; i++) {
        const current = imgLineIdxs[i];
        const previous = imgLineIdxs[i - 1];
        if (current !== undefined && previous !== undefined && current - previous <= 1) {
          return false; // no back-to-back
        }
      }
      return true;
    })();

    const totalLinks = metrics.links.total ?? (metrics.links.external + metrics.links.internal);
    const requireImagesWhenLinks = totalLinks > 0 ? metrics.images.total > 0 : true;

    const checklist: SeoChecklist = {
      structure: {
        singleH1: metrics.headings.hasSingleH1,
        h2CountOk: outlineTemplate ? metrics.headings.h2Count >= expectedH2Min : metrics.headings.h2Count >= 3 && metrics.headings.h2Count <= 6,
        hasTldr,
        hasFaq,
        tldrCountOk,
        sectionMinWordsOk,
        faqItemsCountOk,
      },
      links: {
        internalMin: metrics.links.internal >= 2,
        externalMin: metrics.links.external >= 3,
        brokenExternalLinks,
      },
      citations: {
        citedSourcesMin: /\n##\s*Sources\s*\n/.test(content) || /\[S\d+\]/.test(content),
      },
      quotes: {
        hasExpertQuote: />\s*[^\n]+/.test(content),
      },
      stats: {
        hasTwoDataPoints: (() => {
          const matches = content.match(/\b\d{2,}\s?(%|percent|\$|€|USD)|\b\d{4,}\b/gi) ?? [];
          return matches.length >= 2;
        })(),
      },
      images: {
        allHaveAlt: metrics.images.total === metrics.images.withAlt,
        requiredWhenLinks: requireImagesWhenLinks,
        maxThree: metrics.images.total <= 3,
        spreadOut,
      },
      keywords: { h1HasPrimary },
      meta: {
        metaDescriptionOk: !!(art?.metaDescription && art.metaDescription.length > 0 && art.metaDescription.length <= 160),
        slugPresent: !!(art?.slug && art.slug.length > 0),
      },
      jsonLd: { blogPosting: hasBlogPosting, faqPage: hasFaqPage },
    };

    // Persist checklist
    // 1) Update column
    await db
      .update(articleGeneration)
      .set({ checklist: checklist, updatedAt: new Date(), lastUpdated: new Date() })
      .where(eq(articleGeneration.id, generationId));

    // 2) Merge into artifacts
    try {
      const [cur] = await db
        .select({ artifacts: articleGeneration.artifacts })
        .from(articleGeneration)
        .where(eq(articleGeneration.id, generationId))
        .limit(1);
      const merged = { ...(cur?.artifacts ?? {}), checklist } as Record<string, unknown>;
      await db
        .update(articleGeneration)
        .set({ artifacts: merged, updatedAt: new Date(), lastUpdated: new Date() })
        .where(eq(articleGeneration.id, generationId));
    } catch {}
  } catch {
    // checklist best-effort; continue
  }

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
