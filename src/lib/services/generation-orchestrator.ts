import { db } from "@/server/db";
import {
  articles,
  articleGeneration,
  users,
  projects,
} from "@/server/db/schema";
import { eq, and, desc, ne } from "drizzle-orm";
import type { VideoEmbed } from "@/types";

import { getProjectExcludedDomains } from "@/lib/utils/article-generation";
import { getRelatedArticles } from "@/lib/utils/related-articles";
import { hasEnoughCredits, deductCredits } from "@/lib/utils/credits";
import { getCreditCost } from "@/lib/utils/credit-costs";
import { logger } from "@/lib/utils/logger";

import { performResearchDirect } from "@/lib/services/research-service";
import type { ResearchResponse } from "@/lib/services/research-service";
import { performWriteLogic } from "@/lib/services/write-service";
import type { WriteResponse } from "@/lib/services/write-service";
import { performQualityControlLogic } from "@/lib/services/quality-control-service";
import type { QualityControlResponse } from "@/lib/services/quality-control-service";
import { performValidateLogic } from "@/lib/services/validation-service";
import type { ValidateResponse } from "@/lib/services/validation-service";
import { performGenericUpdate } from "@/lib/services/update-service";
import { performImageSelectionLogic } from "@/lib/services/image-selection-service";

import { generateStructuredOutline } from "@/lib/services/outline-generator-service";
import { runSeoAudit } from "@/lib/services/seo-audit-service";
import {
  passesQualityGates,
  passesChecklist,
} from "@/lib/services/quality-gates";
import type { SeoChecklist } from "@/types";
import { performSeoRemediation } from "@/lib/services/seo-remediation-service";
import { captureSpecificScreenshots } from "@/lib/services/screenshot-service";
import { generateJsonLd } from "@/lib/services/schema-generator-service";

export interface GenerationContext {
  articleId: number;
  userId: string;
  article: typeof articles.$inferSelect;
  keywords: string[];
  relatedArticles: string[];
}

async function mergeArtifacts(
  generationId: number,
  fragment: Record<string, unknown>,
): Promise<void> {
  const [current] = await db
    .select({ artifacts: articleGeneration.artifacts })
    .from(articleGeneration)
    .where(eq(articleGeneration.id, generationId))
    .limit(1);
  const next = { ...(current?.artifacts ?? {}), ...fragment } as Record<
    string,
    unknown
  >;
  await db
    .update(articleGeneration)
    .set({ artifacts: next, updatedAt: new Date(), lastUpdated: new Date() })
    .where(eq(articleGeneration.id, generationId));
}

// Attempt to atomically claim an article for generation by flipping its status
// to "generating" if and only if it is not already generating/published/deleted.
// Returns:
// - "claimed" when this caller acquired the claim
// - "already_generating" when another worker has the claim
// - "not_claimable" for other states (e.g., published/deleted)
export async function claimArticleForGeneration(
  articleId: number,
): Promise<"claimed" | "already_generating" | "not_claimable"> {
  const [updated] = await db
    .update(articles)
    .set({ status: "generating", updatedAt: new Date() })
    .where(
      and(
        eq(articles.id, articleId),
        ne(articles.status, "generating"),
        ne(articles.status, "published"),
        ne(articles.status, "deleted"),
      ),
    )
    .returning({ id: articles.id });

  if (updated) return "claimed";

  const [current] = await db
    .select({ status: articles.status })
    .from(articles)
    .where(eq(articles.id, articleId))
    .limit(1);
  if (!current) return "not_claimable";
  if (current.status === "generating") return "already_generating";
  return "not_claimable";
}

export async function validateAndSetupGeneration(
  userId: string,
  articleId: string,
  forceRegenerate?: boolean,
): Promise<GenerationContext> {
  const [userRecord] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!userRecord) throw new Error("User not found");

  const requiredCredits = getCreditCost("ARTICLE_GENERATION");
  const userHasEnoughCredits = await hasEnoughCredits(userRecord.id, requiredCredits);
  if (!userHasEnoughCredits) throw new Error(`Insufficient credits for article generation (requires ${requiredCredits} credits)`);

  if (!articleId || isNaN(parseInt(articleId)))
    throw new Error("Invalid article ID");
  const id = parseInt(articleId);

  const [result] = await db
    .select()
    .from(articles)
    .innerJoin(projects, eq(articles.projectId, projects.id))
    .where(and(eq(articles.id, id), eq(projects.userId, userRecord.id)))
    .limit(1);

  if (!result) throw new Error("Article not found or access denied");

  const existingArticle = result.articles;

  if (existingArticle.status === "generating" && !forceRegenerate)
    throw new Error("Article generation already in progress");

  const keywords = Array.isArray(existingArticle.keywords)
    ? (existingArticle.keywords as string[])
    : [];
  const effectiveKeywords =
    keywords.length > 0 ? keywords : [existingArticle.title];

  const relatedArticles = await getRelatedArticles(
    existingArticle.projectId,
    existingArticle.title,
    effectiveKeywords,
  );

  return {
    articleId: id,
    userId: userRecord.id,
    article: existingArticle,
    keywords: effectiveKeywords,
    relatedArticles,
  };
}

export async function createOrResetArticleGeneration(
  articleId: number,
  userId: string,
): Promise<typeof articleGeneration.$inferSelect> {
  const [article] = await db
    .select({ projectId: articles.projectId })
    .from(articles)
    .where(eq(articles.id, articleId))
    .limit(1);
  if (!article) throw new Error(`Article ${articleId} not found`);

  const [existingRecord] = await db
    .select()
    .from(articleGeneration)
    .where(eq(articleGeneration.articleId, articleId))
    .orderBy(desc(articleGeneration.createdAt))
    .limit(1);

  if (existingRecord) {
    const existingRelated = Array.isArray(existingRecord.relatedArticles)
      ? existingRecord.relatedArticles
      : [];

    const [updatedRecord] = await db
      .update(articleGeneration)
      .set({
        status: "pending",
        progress: 0,
        startedAt: null,
        completedAt: null,
        error: null,
        errorDetails: null,
        draftContent: null,
        validationReport: {},
        qualityControlReport: null,
        researchData: {},
        seoReport: {},
        imageKeywords: [],
        relatedArticles: existingRelated.length > 0 ? existingRelated : [],
        updatedAt: new Date(),
      })
      .where(eq(articleGeneration.id, existingRecord.id))
      .returning();

    if (!updatedRecord) throw new Error("Failed to reset generation record");
    return updatedRecord;
  }

  const result = await db
    .insert(articleGeneration)
    .values({
      articleId,
      userId,
      projectId: article.projectId,
      status: "pending",
      progress: 0,
      startedAt: null,
      validationReport: {},
      researchData: {},
      seoReport: {},
      imageKeywords: [],
      relatedArticles: [],
    })
    .returning();

  const record = result[0];
  if (!record) throw new Error("Failed to create generation record");
  return record;
}

export async function updateGenerationProgress(
  generationId: number,
  status: string,
  progress: number,
  additionalData?: Record<string, unknown>,
): Promise<void> {
  await db
    .update(articleGeneration)
    .set({ status, progress, updatedAt: new Date(), ...additionalData })
    .where(eq(articleGeneration.id, generationId));
}

async function performResearch(
  title: string,
  keywords: string[],
  generationId: number,
  projectId: number,
  notes?: string,
): Promise<ResearchResponse> {
  await updateGenerationProgress(generationId, "researching", 10);
  logger.debug("research:start", { title, keywordsCount: keywords.length });

  const excludedDomains = await getProjectExcludedDomains(projectId);
  const comprehensiveResearchData = await performResearchDirect({
    title,
    keywords,
    notes,
    excludedDomains,
  });

  // Save the comprehensive research data structure to the database
  await updateGenerationProgress(generationId, "researching", 25, {
    researchData: comprehensiveResearchData,
  });

  // Return the unified response for backwards compatibility
  return comprehensiveResearchData.unified;
}

async function selectCoverImage(
  articleId: number,
  generationId: number,
  title: string,
  keywords: string[],
  userId: string,
  projectId: number,
): Promise<{ coverImageUrl: string; coverImageAlt: string }> {
  try {
    logger.debug("image-selection:start", { articleId, generationId });
    const imageResult = await performImageSelectionLogic({
      articleId,
      generationId,
      title,
      keywords,
      orientation: "landscape",
      userId,
      projectId,
    });
    if (imageResult.success && imageResult.data?.coverImageUrl) {
      return {
        coverImageUrl: imageResult.data.coverImageUrl,
        coverImageAlt: imageResult.data.coverImageAlt ?? "",
      };
    }
  } catch (error) {
    logger.warn("image-selection:error", error);
  }
  return { coverImageUrl: "", coverImageAlt: "" };
}

async function writeArticle(
  researchData: ResearchResponse,
  title: string,
  keywords: string[],
  coverImageUrl: string,
  generationId: number,
  userId: string,
  projectId: number,
  relatedArticles: string[],
  videos?: Array<{ title: string; url: string }>,
  notes?: string,
  outlineMarkdown?: string,
  sourcesOverride?: Array<{ url: string; title?: string }>,
  screenshotsForWriter?: Array<{
    url: string;
    alt?: string;
    sectionHeading?: string;
    placement?: "start" | "middle" | "end";
  }>,
): Promise<WriteResponse> {
  await updateGenerationProgress(generationId, "writing", 35);
  logger.debug("ai-first-writing:start", {
    title,
    hasCoverImage: !!coverImageUrl,
    hasOutline: !!outlineMarkdown,
  });

  try {
    // Use the simplified write service with the AI-generated outline
    const writeData = await performWriteLogic({
      researchData: researchData,
      title,
      keywords,
      coverImage: coverImageUrl ?? undefined,
      videos,
      userId,
      projectId,
      relatedArticles,
      generationId,
      sources:
        sourcesOverride && sourcesOverride.length > 0
          ? sourcesOverride
          : (researchData.sources ?? []),
      notes: notes ?? undefined,
      outlineMarkdown, // Pass the markdown outline directly
      screenshots: screenshotsForWriter,
    });

    await updateGenerationProgress(generationId, "writing", 60);
    logger.debug("ai-first-writing:completed");

    return writeData;
  } catch (error) {
    logger.error("ai-first-writing:error", {
      error: error instanceof Error ? error.message : "Unknown error",
      generationId,
    });
    throw error;
  }
}

async function performQualityControl(
  content: string,
  generationId: number,
  userId: string,
  projectId: number,
): Promise<QualityControlResponse> {
  const startTime = Date.now();
  logger.debug("quality-control:start", { generationId });
  try {
    const generationRecord = await db
      .select()
      .from(articleGeneration)
      .where(eq(articleGeneration.id, generationId))
      .limit(1)
      .then((rows) => rows[0]);

    const qualityControlData = await performQualityControlLogic({
      articleContent: content,
      userSettings: undefined,
      originalPrompt: generationRecord?.writePrompt ?? "",
      userId: userId,
      projectId: projectId,
      generationId: generationId,
    });

    logger.debug("quality-control:done");

    // Save the report (string or null)
    await updateGenerationProgress(generationId, "quality-control", 70, {
      qualityControlReport: qualityControlData.issues ?? null,
    });

    return qualityControlData;
  } catch (error) {
    const processingTime = Date.now() - startTime;
    logger.warn("quality-control:error", {
      error,
      processingTimeMs: processingTime,
    });
    const fallbackResponse: QualityControlResponse = {
      issues: null,
      isValid: true,
    };
    await updateGenerationProgress(generationId, "quality-control", 70, {
      qualityControlReport: null,
    });
    return fallbackResponse;
  }
}

async function validateArticle(
  content: string,
  generationId: number,
): Promise<ValidateResponse> {
  logger.debug("validation:start", { generationId });
  try {
    const validationData = await performValidateLogic(content);
    await updateGenerationProgress(generationId, "updating", 85, {
      validationReport: validationData,
    });
    return validationData;
  } catch (error) {
    logger.warn("validation:error", error);
    const fallbackResponse: ValidateResponse = {
      isValid: true,
      issues: [],
      rawValidationText: "Validation skipped due to timeout or error",
    };
    await updateGenerationProgress(generationId, "updating", 90, {
      validationReport: {
        isValid: true,
        issues: [],
        rawValidationText: `Validation skipped: ${error instanceof Error ? error.message : "Unknown error"}`,
      },
    });
    return fallbackResponse;
  }
}

async function finalizeArticle(
  articleId: number,
  writeData: WriteResponse,
  content: string,
  coverImageUrl: string,
  coverImageAlt: string,
  generationId: number,
  userId: string,
  publishReady: boolean,
  videos?: VideoEmbed[],
): Promise<void> {
  // Ensure intro paragraph exists immediately after H1
  const intro = (writeData.introParagraph ?? "").trim();
  const finalContentWithIntro = intro
    ? ensureSingleIntro(content, intro)
    : content;

  const updateData: {
    draft: string;
    videos?: VideoEmbed[];
    slug?: string;
    metaDescription: string;
    metaKeywords?: string[];
    status: "wait_for_publish" | "scheduled";
    updatedAt: Date;
    coverImageUrl?: string;
    coverImageAlt?: string;
    introParagraph?: string;
  } = {
    draft: finalContentWithIntro,
    videos: videos ?? [],
    metaDescription: writeData.metaDescription ?? "",
    status: publishReady ? "wait_for_publish" : "scheduled",
    updatedAt: new Date(),
  };
  if (writeData.slug) updateData.slug = writeData.slug;
  if (writeData.tags && writeData.tags.length > 0)
    updateData.metaKeywords = writeData.tags;
  if (coverImageUrl) {
    updateData.coverImageUrl = coverImageUrl;
    updateData.coverImageAlt = coverImageAlt;
  }

  // Persist intro paragraph to articles if provided by AI
  if (intro) {
    updateData.introParagraph = intro;
  }

  await db.update(articles).set(updateData).where(eq(articles.id, articleId));

  const generationUpdate: Record<string, unknown> = {
    status: "completed",
    progress: 100,
    completedAt: new Date(),
    draftContent: finalContentWithIntro,
    updatedAt: new Date(),
  };
  if (writeData.relatedPosts && writeData.relatedPosts.length > 0) {
    generationUpdate.relatedArticles = writeData.relatedPosts;
  }
  await db
    .update(articleGeneration)
    .set(generationUpdate)
    .where(eq(articleGeneration.id, generationId));

  const creditsToDeduct = getCreditCost("ARTICLE_GENERATION");
  const creditDeducted = await deductCredits(userId, creditsToDeduct);
  if (!creditDeducted)
    logger.warn("credits:deduct_failed", { userId, articleId, amount: creditsToDeduct });
}

// Ensure exactly one intro paragraph exists between H1 and TL;DR (or first H2 if TL;DR missing)
function ensureSingleIntro(markdown: string, intro: string): string {
  const lines = markdown.split(/\r?\n/);
  if (lines.length === 0) return markdown;

  // Find H1
  let h1Idx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i] && /^\s*#\s+.+/.test(lines[i]!)) {
      h1Idx = i;
      break;
    }
  }
  if (h1Idx === -1) {
    for (let i = 0; i < lines.length - 1; i++) {
      if (
        lines[i + 1] &&
        /^=+$/.test(lines[i + 1]!) &&
        lines[i] &&
        lines[i]!.trim().length > 0
      ) {
        h1Idx = i + 1;
        break;
      }
    }
  }
  if (h1Idx === -1) return markdown; // can't enforce safely

  // Find TL;DR heading after H1 (case-insensitive)
  const tldrIdx = lines.findIndex(
    (l, idx) => idx > h1Idx && /^\s*##\s*TL;DR\s*$/i.test(l),
  );

  // Fallback: first H2+ heading after H1 if TL;DR not found
  const firstH2Idx = lines.findIndex(
    (l, idx) => idx > h1Idx && /^\s*##\s+/.test(l),
  );
  const stopIdx =
    tldrIdx !== -1 ? tldrIdx : firstH2Idx !== -1 ? firstH2Idx : -1;

  const head = lines.slice(0, h1Idx + 1).join("\n");
  const tail =
    stopIdx !== -1
      ? lines.slice(stopIdx).join("\n")
      : lines.slice(h1Idx + 1).join("\n");

  // Rebuild so that between H1 and stopIdx there is exactly one intro paragraph
  const rebuilt = `${head}\n\n${intro.trim()}\n\n${tail}`.replace(
    /\n{3,}/g,
    "\n\n",
  );
  return rebuilt;
}

export async function handleGenerationError(
  articleId: number,
  generationId: number | null,
  error: Error,
): Promise<void> {
  logger.error("generation:error", error.message);
  try {
    const [currentArticle] = await db
      .select({ status: articles.status })
      .from(articles)
      .where(eq(articles.id, articleId))
      .limit(1);
    if (!currentArticle) return;
    if (currentArticle.status === "generating") {
      await db
        .update(articles)
        .set({ status: "idea", updatedAt: new Date() })
        .where(eq(articles.id, articleId));
    }
    if (generationId) {
      try {
        await db
          .update(articleGeneration)
          .set({
            status: "failed",
            error: error.message,
            errorDetails: {
              timestamp: new Date().toISOString(),
              articleId,
              originalStatus: currentArticle.status,
            },
            updatedAt: new Date(),
          })
          .where(eq(articleGeneration.id, generationId));
      } catch (updateError) {
        logger.warn("generation:error_update_failed", updateError);
      }
    }
  } catch (dbError) {
    logger.warn("generation:error_db", dbError);
  }
}

export async function generateArticle(
  context: GenerationContext,
): Promise<void> {
  const { articleId, userId, article, keywords } = context;
  let generationRecord: typeof articleGeneration.$inferSelect | null = null;

  try {
    logger.info("generation:start", { articleId, title: article.title });

    generationRecord = await createOrResetArticleGeneration(articleId, userId);
    await db
      .update(articles)
      .set({ status: "generating", updatedAt: new Date() })
      .where(eq(articles.id, articleId));
    await db
      .update(articleGeneration)
      .set({ startedAt: new Date(), updatedAt: new Date() })
      .where(eq(articleGeneration.id, generationRecord.id));

    // Related articles
    const existingRelated = Array.isArray(generationRecord.relatedArticles)
      ? generationRecord.relatedArticles
      : [];
    const shouldUpdateRelatedArticles =
      (context.relatedArticles?.length ?? 0) > 0 &&
      existingRelated.length === 0;
    if (shouldUpdateRelatedArticles) {
      await db
        .update(articleGeneration)
        .set({ relatedArticles: context.relatedArticles })
        .where(eq(articleGeneration.id, generationRecord.id));
    }

    // Phase 1: Research
    const researchData = await performResearch(
      article.title,
      keywords,
      generationRecord.id,
      article.projectId,
      article.notes!,
    );

    // Phase 2: Image selection
    const { coverImageUrl, coverImageAlt } = await selectCoverImage(
      articleId,
      generationRecord.id,
      article.title,
      keywords,
      userId,
      article.projectId,
    );

    // Phase 3: Write - AI-First Approach
    // Get project article structure for outline generation
    const [projectData] = await db
      .select({
        articleStructure: projects.articleStructure,
        toneOfVoice: projects.toneOfVoice,
        maxWords: projects.maxWords,
      })
      .from(projects)
      .where(eq(projects.id, article.projectId))
      .limit(1);

    // Generate AI-driven outline using the simplified approach
    const outlineResult = await generateStructuredOutline({
      title: article.title,
      keywords,
      researchData: researchData.researchData,
      projectArticleStructure: projectData?.articleStructure ?? "",
      userNotes: article.notes ?? undefined,
      maxWords: 1800,
      sources: researchData.sources ?? [],
    });

    // Store outline in artifacts for debugging and transparency
    await mergeArtifacts(generationRecord.id, {
      outline: {
        summary: outlineResult.summary,
        markdown: outlineResult.outlineMarkdown,
        approach: "ai-first-structured-generation",
        generatedAt: new Date().toISOString(),
      },
    });

    // Persist AI-decided link plan and screenshot plan for transparency
    try {
      await mergeArtifacts(generationRecord.id, {
        linkPlan: outlineResult.recommendedLinks ?? [],
        screenshotPlan: outlineResult.screenshotPlan ?? [],
      });
    } catch (e) {
      logger.warn("outline:plan_persist_error", e);
    }

    logger.debug("outline-generation:completed", {
      outlineLength: outlineResult.outlineMarkdown.length,
      summaryLength: outlineResult.summary.length,
    });

    // Prefer AI-selected links if provided by outline
    const chosenSources =
      outlineResult.recommendedLinks &&
      outlineResult.recommendedLinks.length > 0
        ? outlineResult.recommendedLinks.map((l) => ({
            url: l.url,
            title: l.title,
          }))
        : (researchData.sources ?? []);

    // Capture screenshots BEFORE writing so writer can embed them inline
    let screenshotsForWriter: Array<{
      url: string;
      alt?: string;
      sectionHeading?: string;
      placement?: "start" | "middle" | "end";
    }> = [];
    try {
      const planRequests = (outlineResult.screenshotPlan ?? []).map((p) => ({
        url: p.url,
        title: p.title,
        sectionHeading: p.sectionHeading,
        placement: p.placement,
      }));
      const useRequests =
        planRequests.length > 0 ? planRequests.slice(0, 3) : [];

      if (useRequests.length > 0) {
        const result = await captureSpecificScreenshots({
          articleId,
          generationId: generationRecord.id,
          projectId: article.projectId,
          screenshotRequests: useRequests,
        });

        await mergeArtifacts(generationRecord.id, {
          screenshots: result.screenshots,
        });

        // Build writer screenshots list with placement data
        screenshotsForWriter = useRequests
          .map((req) => {
            const s = result.screenshots[req.url];
            return s?.imageUrl && s?.status === 200
              ? {
                  url: s.imageUrl,
                  alt: req.title ?? s.alt,
                  sectionHeading: req.sectionHeading,
                  placement: req.placement,
                }
              : undefined;
          })
          .filter((v): v is NonNullable<typeof v> => v !== undefined);
      }
    } catch (e) {
      logger.warn("screenshots:prewrite_capture_failed", e);
      screenshotsForWriter = [];
    }

    const writeData = await writeArticle(
      researchData,
      article.title,
      keywords,
      coverImageUrl,
      generationRecord.id,
      userId,
      article.projectId,
      context.relatedArticles,
      researchData.videos,
      article.notes ?? undefined,
      outlineResult.outlineMarkdown,
      chosenSources,
      screenshotsForWriter,
    );

    // Phase 4: Quality Control
    const qualityControlData = await performQualityControl(
      writeData.content ?? "",
      generationRecord.id,
      userId,
      article.projectId,
    );

    // Phase 5: Validation
    await updateGenerationProgress(generationRecord.id, "validating", 80, {
      currentPhase: "validation",
    });

    const validationData = await validateArticle(
      writeData.content ?? "",
      generationRecord.id,
    );

    // Phase 6: Update content if needed (factual/QC issues only)
    // Combine validation and quality control issues for content update
    let combinedIssues = "";

    // Add validation issues
    const hasValidationIssues =
      validationData.rawValidationText &&
      !validationData.rawValidationText.includes(
        "No factual issues identified",
      ) &&
      !validationData.rawValidationText
        .toLowerCase()
        .includes("validation skipped");
    if (hasValidationIssues) {
      combinedIssues += `## Validation Issues\n\n${validationData.rawValidationText}\n\n`;
    }

    // Add quality control issues
    const hasQualityControlIssues =
      qualityControlData.issues !== null &&
      qualityControlData.issues !== undefined;
    if (hasQualityControlIssues) {
      combinedIssues += `## Quality Control Issues\n\n${qualityControlData.issues}\n\n`;
    }

    // Update content if there are any issues
    let finalContent = writeData.content ?? "";
    if (combinedIssues.trim().length > 0) {
      logger.debug("update:start", {
        hasValidationIssues,
        hasQualityControlIssues,
        combinedIssuesLength: combinedIssues.length,
      });

      const updateResult = await performGenericUpdate({
        article: finalContent,
        validationText: combinedIssues,
        settings: {
          toneOfVoice: projectData?.toneOfVoice ?? undefined,
          articleStructure: projectData?.articleStructure ?? undefined,
          maxWords: projectData?.maxWords ?? undefined,
        },
      });
      finalContent = updateResult.updatedContent ?? finalContent;
    } else {
      logger.debug("update:skip", { reason: "no issues" });
    }

    // Phase 7: Single SEO audit → optional one remediation → final audit
    let contentForSeo = finalContent;
    const initialReport = await runSeoAudit({
      generationId: generationRecord.id,
      articleId,
      content: contentForSeo,
      targetKeywords: keywords,
      updateArticleScore: false,
    });

    if (!passesQualityGates(initialReport).passed) {
      const remediation = await performSeoRemediation({
        articleMarkdown: contentForSeo,
        seoReport: initialReport,
        validationReportJson: validationData
          ? JSON.stringify(validationData)
          : undefined,
        targetKeywords: keywords,
      });
      contentForSeo = remediation.updatedMarkdown ?? contentForSeo;

      await updateGenerationProgress(generationRecord.id, "updating", 96, {
        currentPhase: "seo-remediation",
        draftContent: contentForSeo,
      });
    }

    // Final audit and score persistence
    await runSeoAudit({
      generationId: generationRecord.id,
      articleId,
      content: contentForSeo,
      targetKeywords: keywords,
      updateArticleScore: true,
    });

    // Evaluate checklist-based gates
    let publishReady = true;
    try {
      const [latest] = await db
        .select({ checklist: articleGeneration.checklist })
        .from(articleGeneration)
        .where(eq(articleGeneration.id, generationRecord.id))
        .limit(1);
      const checklist = latest?.checklist as SeoChecklist | undefined;
      if (checklist) {
        const gate = passesChecklist(checklist, {
          allowNoImages: false,
          requireFaq: true,
          maxBrokenExternalLinks: 0,
        });
        publishReady = gate.passed;
        if (!gate.passed)
          logger.warn("gates:checklist_failed", { failures: gate.failures });
      }
    } catch (e) {
      logger.warn("gates:checklist_eval_error", e);
      publishReady = false;
    }

    // JSON-LD generation and persistence (artifacts + column)
    try {
      const schema = await generateJsonLd({ article, markdown: contentForSeo });
      await db
        .update(articleGeneration)
        .set({
          schemaJson: schema.raw,
          updatedAt: new Date(),
          lastUpdated: new Date(),
        })
        .where(eq(articleGeneration.id, generationRecord.id));
      await mergeArtifacts(generationRecord.id, { jsonLd: schema });
    } catch (e) {
      logger.warn("schema:generate_failed", e);
    }

    // Finalize
    await finalizeArticle(
      articleId,
      writeData,
      contentForSeo,
      coverImageUrl,
      coverImageAlt,
      generationRecord.id,
      userId,
      publishReady,
      researchData.videos,
    );

    logger.info("generation:done", { articleId });
  } catch (error) {
    await handleGenerationError(
      articleId,
      generationRecord?.id ?? null,
      error instanceof Error ? error : new Error(String(error)),
    );
    throw error;
  }
}
