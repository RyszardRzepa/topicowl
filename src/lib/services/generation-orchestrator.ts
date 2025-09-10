import { db } from "@/server/db";
import { articles, articleGeneration, users, projects } from "@/server/db/schema";
import { eq, and, desc, ne } from "drizzle-orm";
import type { VideoEmbed, StructureTemplate } from "@/types";

import { getProjectExcludedDomains } from "@/lib/utils/article-generation";
import { getRelatedArticles } from "@/lib/utils/related-articles";
import { hasCredits, deductCredit } from "@/lib/utils/credits";
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

import { runSeoAudit } from "@/lib/services/seo-audit-service";
import { passesQualityGates, passesChecklist } from "@/lib/services/quality-gates";
import type { SeoChecklist } from "@/types";
import { performSeoRemediation } from "@/lib/services/seo-remediation-service";
import { SEO_MAX_REMEDIATION_PASSES } from "@/constants";
import { captureAndAttachScreenshots } from "@/lib/services/screenshot-service";
import { generateJsonLd } from "@/lib/services/schema-generator-service";
import { validateTemplateCompliance, formatComplianceReport } from "@/lib/services/template-compliance-service";
import type { TemplateComplianceResult } from "@/lib/services/template-compliance-service";
import { normalizeTemplate } from "@/lib/services/template-parser-service";

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
  const next = { ...(current?.artifacts ?? {}), ...fragment } as Record<string, unknown>;
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

  const userHasCredits = await hasCredits(userRecord.id);
  if (!userHasCredits) throw new Error("Insufficient credits");

  if (!articleId || isNaN(parseInt(articleId))) throw new Error("Invalid article ID");
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
  const effectiveKeywords = keywords.length > 0 ? keywords : [existingArticle.title];

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
  userId: string,
  projectId: number,
  notes?: string,
): Promise<ResearchResponse> {
  await updateGenerationProgress(generationId, "researching", 10);
  logger.debug("research:start", { title, keywordsCount: keywords.length });

  const excludedDomains = await getProjectExcludedDomains(projectId);
  const researchData = await performResearchDirect({
    title,
    keywords,
    notes,
    excludedDomains,
  });

  await updateGenerationProgress(generationId, "researching", 25, {
    researchData,
  });
  return researchData;
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
  outline?: StructureTemplate,
): Promise<WriteResponse> {
  await updateGenerationProgress(generationId, "writing", 50);
  logger.debug("writing:start", { title, hasCoverImage: !!coverImageUrl });

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
    sources: researchData.sources ?? [],
    notes: notes ?? undefined,
    outline,
  });

  await updateGenerationProgress(generationId, "quality-control", 60, {
    draftContent: writeData.content ?? "",
  });
  return writeData;
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

    const processingTime = Date.now() - startTime;
    logger.debug("quality-control:done", {
      isValid: qualityControlData.isValid,
      processingTimeMs: processingTime,
    });

    // Save the report (string or null)
    await updateGenerationProgress(generationId, "quality-control", 70, {
      qualityControlReport: qualityControlData.issues ?? null,
    });

    return qualityControlData;
  } catch (error) {
    const processingTime = Date.now() - startTime;
    logger.warn("quality-control:error", { error, processingTimeMs: processingTime });
    const fallbackResponse: QualityControlResponse = { issues: null, isValid: true };
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
    status: "wait_for_publish" | "to_generate";
    updatedAt: Date;
    coverImageUrl?: string;
    coverImageAlt?: string;
    introParagraph?: string;
  } = {
    draft: finalContentWithIntro,
    videos: videos ?? [],
    metaDescription: writeData.metaDescription ?? "",
    status: publishReady ? "wait_for_publish" : "to_generate",
    updatedAt: new Date(),
  };
  if (writeData.slug) updateData.slug = writeData.slug;
  if (writeData.tags && writeData.tags.length > 0) updateData.metaKeywords = writeData.tags;
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
  await db.update(articleGeneration).set(generationUpdate).where(eq(articleGeneration.id, generationId));

  const creditDeducted = await deductCredit(userId);
  if (!creditDeducted) logger.warn("credits:deduct_failed", { userId, articleId });
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
      if (lines[i + 1] && /^=+$/.test(lines[i + 1]!) && lines[i] && lines[i]!.trim().length > 0) {
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
  const stopIdx = tldrIdx !== -1 ? tldrIdx : firstH2Idx !== -1 ? firstH2Idx : -1;

  const head = lines.slice(0, h1Idx + 1).join("\n");
  const tail = stopIdx !== -1 ? lines.slice(stopIdx).join("\n") : lines.slice(h1Idx + 1).join("\n");

  // Rebuild so that between H1 and stopIdx there is exactly one intro paragraph
  const rebuilt = `${head}\n\n${intro.trim()}\n\n${tail}`.replace(/\n{3,}/g, "\n\n");
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
      await db.update(articles).set({ status: "idea", updatedAt: new Date() }).where(eq(articles.id, articleId));
    }
    if (generationId) {
      try {
        await db
          .update(articleGeneration)
          .set({
            status: "failed",
            error: error.message,
            errorDetails: { timestamp: new Date().toISOString(), articleId, originalStatus: currentArticle.status },
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
    await db.update(articles).set({ status: "generating", updatedAt: new Date() }).where(eq(articles.id, articleId));
    await db
      .update(articleGeneration)
      .set({ startedAt: new Date(), updatedAt: new Date() })
      .where(eq(articleGeneration.id, generationRecord.id));

    // Related articles
    const existingRelated = Array.isArray(generationRecord.relatedArticles) ? generationRecord.relatedArticles : [];
    const shouldUpdateRelatedArticles = (context.relatedArticles?.length ?? 0) > 0 && existingRelated.length === 0;
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
      userId,
      article.projectId,
      article.notes ?? undefined,
    );

    // Phase 2: Image selection (optional)
    const { coverImageUrl, coverImageAlt } = await selectCoverImage(
      articleId,
      generationRecord.id,
      article.title,
      keywords,
      userId,
      article.projectId,
    );

    // Phase 3: Write
    // Get project article structure
    const [projectData] = await db
      .select({ articleStructure: projects.articleStructure })
      .from(projects)
      .where(eq(projects.id, article.projectId))
      .limit(1);

    // Convert string template to StructureTemplate if available
    let normalizedOutline: StructureTemplate | undefined;
    if (projectData?.articleStructure?.trim()) {
      normalizedOutline = normalizeTemplate(projectData.articleStructure) ?? undefined;
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
      normalizedOutline,
    );

    // Phase 3.5: Screenshots of linked pages -> upload via Vercel Blob and embed
    try {
      logger.debug("screenshots:starting", { articleId, generationId: generationRecord.id });
      const { updatedMarkdown, screenshots } = await captureAndAttachScreenshots({
        articleId,
        generationId: generationRecord.id,
        markdown: writeData.content ?? "",
        projectId: article.projectId,
      });
      
      const screenshotCount = Object.keys(screenshots).length;
      const successfulScreenshots = Object.values(screenshots).filter(s => s.status === 200).length;
      
      logger.debug("screenshots:completed", { 
        articleId, 
        generationId: generationRecord.id,
        totalScreenshots: screenshotCount,
        successfulScreenshots,
        hasUpdatedMarkdown: updatedMarkdown && updatedMarkdown !== (writeData.content ?? "")
      });
      
      if (updatedMarkdown && updatedMarkdown !== (writeData.content ?? "")) {
        await updateGenerationProgress(generationRecord.id, "writing", 58, {
          draftContent: updatedMarkdown,
        });
        logger.debug("screenshots:markdown_updated", { articleId, generationId: generationRecord.id });
      }
      await mergeArtifacts(generationRecord.id, { screenshots });
      // Use the version with screenshots for downstream steps
      writeData.content = updatedMarkdown || writeData.content;
    } catch (e) {
      logger.error("screenshots:failed", { 
        error: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? e.stack : undefined,
        articleId, 
        generationId: generationRecord.id,
        projectId: article.projectId
      });
    }

    // Phase 4: Quality Control
    const qualityControlData = await performQualityControl(
      writeData.content ?? "",
      generationRecord.id,
      userId,
      article.projectId,
    );

    // Phase 4.5: Template Compliance Validation - Simplified
    let templateComplianceResult: TemplateComplianceResult | null = null;
    // Template compliance validation is simplified - just check if project has article structure
    try {
      const [proj] = await db
        .select({ articleStructure: projects.articleStructure })
        .from(projects)
        .where(eq(projects.id, article.projectId))
        .limit(1);
      
      const projectTemplate = proj?.articleStructure?.trim();
      if (projectTemplate && projectTemplate.length > 0) {
        const normalizedTemplate = normalizeTemplate(projectTemplate);
        if (normalizedTemplate) {
          templateComplianceResult = validateTemplateCompliance(writeData.content ?? "", normalizedTemplate);
          
          logger.debug("template-compliance:validated", {
            isCompliant: templateComplianceResult.isCompliant,
            score: templateComplianceResult.score,
            violationsCount: templateComplianceResult.violations.length
          });

          // Store compliance result in artifacts
          await mergeArtifacts(generationRecord.id, { 
            templateCompliance: templateComplianceResult,
            complianceReport: formatComplianceReport(templateComplianceResult)
          });

          // Log compliance issues if any
          if (!templateComplianceResult.isCompliant) {
            logger.warn("template-compliance:violations", {
              articleId,
              generationId: generationRecord.id,
              violations: templateComplianceResult.violations.map(v => ({
                section: v.sectionId,
                type: v.violationType,
                severity: v.severity,
                description: v.description
              }))
            });
          }
        } else {
          logger.debug("template-compliance:skipped", { reason: "invalid_template_format" });
        }
      } else {
        logger.debug("template-compliance:skipped", { reason: "no_template_found" });
      }
    } catch (error) {
      logger.warn("template-compliance:error", error);
      // Don't fail generation due to compliance validation errors
    }

    // Phase 5: Validation + initial SEO audit in parallel
    await updateGenerationProgress(generationRecord.id, "validating", 80, { currentPhase: "seo-audit" });
    const [validationData] = await Promise.all([
      validateArticle(writeData.content ?? "", generationRecord.id),
      runSeoAudit({
        generationId: generationRecord.id,
        articleId,
        content: writeData.content ?? "",
        targetKeywords: keywords,
        updateArticleScore: false,
      }),
    ]);

    // Phase 6: Update content if needed (factual/QC/template compliance)
    // Combine all issues for content update
    let combinedIssues = "";
    
    // Add validation issues
    const hasValidationIssues =
      validationData.rawValidationText &&
      !validationData.rawValidationText.includes("No factual issues identified") &&
      !validationData.rawValidationText.toLowerCase().includes("validation skipped");
    if (hasValidationIssues) {
      combinedIssues += `## Validation Issues\n\n${validationData.rawValidationText}\n\n`;
    }
    
    // Add quality control issues
    const hasQualityControlIssues = qualityControlData.issues !== null && qualityControlData.issues !== undefined;
    if (hasQualityControlIssues) {
      combinedIssues += `## Quality Control Issues\n\n${qualityControlData.issues}\n\n`;
    }
    
    // Add template compliance issues
    const hasTemplateIssues = templateComplianceResult && !templateComplianceResult.isCompliant;
    if (hasTemplateIssues && templateComplianceResult) {
      const complianceReport = formatComplianceReport(templateComplianceResult);
      combinedIssues += `## Template Compliance Issues\n\n${complianceReport}\n\n`;
      combinedIssues += `## Template Requirements\n\nThe article must follow the project's article structure requirements.\n\n`;
    }

    // Update content if there are any issues
    let finalContent = writeData.content ?? "";
    if (combinedIssues.trim().length > 0) {
      logger.debug("update:start", { 
        hasValidationIssues,
        hasQualityControlIssues,
        hasTemplateIssues,
        combinedIssuesLength: combinedIssues.length 
      });
      
      const updateResult = await performGenericUpdate({
        article: finalContent,
        validationText: combinedIssues,
        settings: undefined,
      });
      finalContent = updateResult.updatedContent ?? finalContent;

      // Re-validate template compliance after updates if there were template issues
      if (hasTemplateIssues && templateComplianceResult) {
        try {
          // Get project template again for re-validation
          const [proj] = await db
            .select({ articleStructure: projects.articleStructure })
            .from(projects)
            .where(eq(projects.id, article.projectId))
            .limit(1);
          
          const projectTemplate = proj?.articleStructure?.trim();
          if (projectTemplate && projectTemplate.length > 0) {
            const normalizedTemplate = normalizeTemplate(projectTemplate);
            if (normalizedTemplate) {
              const updatedCompliance = validateTemplateCompliance(finalContent, normalizedTemplate);
              
              logger.debug("template-compliance:post-update", {
                originalScore: templateComplianceResult.score,
                updatedScore: updatedCompliance.score,
                improved: updatedCompliance.score > templateComplianceResult.score,
                isNowCompliant: updatedCompliance.isCompliant
              });

              // Store the updated compliance result
              await mergeArtifacts(generationRecord.id, { 
                templateCompliancePostUpdate: updatedCompliance,
                complianceImprovement: updatedCompliance.score - templateComplianceResult.score
              });
            }
          }
        } catch (error) {
          logger.warn("template-compliance:post-update-error", error);
        }
      }
    } else {
      logger.debug("update:skip", { reason: "no issues" });
    }

    // Phase 7: SEO remediation loop with re-audit
    let contentForSeo = finalContent;
    let passedGates = false;
    let lastSeoScore = 0;
    for (let pass = 1; pass <= SEO_MAX_REMEDIATION_PASSES; pass++) {
      const report = await runSeoAudit({
        generationId: generationRecord.id,
        articleId,
        content: contentForSeo,
        targetKeywords: keywords,
        updateArticleScore: false,
      });
      lastSeoScore = report.score;
      const gate = passesQualityGates(report);
      if (gate.passed) {
        passedGates = true;
        break;
      }

      const remediation = await performSeoRemediation({
        articleMarkdown: contentForSeo,
        seoReport: report,
        validationReportJson: validationData ? JSON.stringify(validationData) : undefined,
        targetKeywords: keywords,
      });
      contentForSeo = remediation.updatedMarkdown || contentForSeo;

      await updateGenerationProgress(generationRecord.id, "updating", 96, {
        currentPhase: "seo-remediation",
        draftContent: contentForSeo,
      });
    }

    if (!passedGates) {
      // Persist the latest SEO score but continue generation.
      await runSeoAudit({
        generationId: generationRecord.id,
        articleId,
        content: contentForSeo,
        targetKeywords: keywords,
        updateArticleScore: true,
      });
      logger.warn("generation:seo_gates_not_met", {
        articleId,
        generationId: generationRecord.id,
        lastSeoScore,
        passesAttempted: SEO_MAX_REMEDIATION_PASSES,
      });
      // Do not throw; continue to finalize the article so the user can edit later.
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
        const gate = passesChecklist(checklist, { allowNoImages: false, requireFaq: true, maxBrokenExternalLinks: 0 });
        publishReady = gate.passed;
        if (!gate.passed) logger.warn("gates:checklist_failed", { failures: gate.failures });
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
        .set({ schemaJson: schema.raw, updatedAt: new Date(), lastUpdated: new Date() })
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
