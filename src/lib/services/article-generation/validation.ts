import { db } from "@/server/db";
import {
  articleGenerations,
  articles,
  projects,
  users,
} from "@/server/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { getRelatedArticles } from "@/lib/utils/related-articles";
import { hasEnoughCredits } from "@/lib/utils/credits";
import { getCreditCost } from "@/lib/utils/credit-costs";

export interface GenerationContext {
  articleId: number;
  userId: string;
  article: typeof articles.$inferSelect;
  keywords: string[];
  relatedArticles: string[];
}

export async function claimArticleForGeneration(
  articleId: number,
): Promise<"claimed" | "already_generating" | "not_claimable"> {
  const [article] = await db
    .select({ id: articles.id })
    .from(articles)
    .where(eq(articles.id, articleId))
    .limit(1);

  if (!article) return "not_claimable";

  const [latestGeneration] = await db
    .select({ status: articleGenerations.status })
    .from(articleGenerations)
    .where(eq(articleGenerations.articleId, articleId))
    .orderBy(desc(articleGenerations.createdAt))
    .limit(1);

  if (
    latestGeneration &&
    latestGeneration.status !== "failed" &&
    latestGeneration.status !== "completed"
  ) {
    return "already_generating";
  }

  return "claimed";
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
  const userHasEnoughCredits = await hasEnoughCredits(
    userRecord.id,
    requiredCredits,
  );
  if (!userHasEnoughCredits)
    throw new Error(
      `Insufficient credits for article generation (requires ${requiredCredits} credits)`,
    );

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
): Promise<typeof articleGenerations.$inferSelect> {
  const [article] = await db
    .select({ projectId: articles.projectId })
    .from(articles)
    .where(eq(articles.id, articleId))
    .limit(1);
  if (!article) throw new Error(`Article ${articleId} not found`);

  await db
    .update(articles)
    .set({ status: "generating", updatedAt: new Date() })
    .where(eq(articles.id, articleId));

  const [existingRecord] = await db
    .select()
    .from(articleGenerations)
    .where(eq(articleGenerations.articleId, articleId))
    .orderBy(desc(articleGenerations.createdAt))
    .limit(1);

  if (existingRecord) {
    const [updatedRecord] = await db
      .update(articleGenerations)
      .set({
        status: "scheduled",
        progress: 0,
        startedAt: null,
        completedAt: null,
        error: null,
        errorDetails: null,
        artifacts: {},
        updatedAt: new Date(),
      })
      .where(eq(articleGenerations.id, existingRecord.id))
      .returning();

    if (!updatedRecord) throw new Error("Failed to reset generation record");
    return updatedRecord;
  }

  const result = await db
    .insert(articleGenerations)
    .values({
      articleId,
      userId,
      projectId: article.projectId,
      status: "scheduled",
      progress: 0,
      startedAt: null,
      artifacts: {},
    })
    .returning();

  const record = result[0];
  if (!record) throw new Error("Failed to create generation record");
  return record;
}