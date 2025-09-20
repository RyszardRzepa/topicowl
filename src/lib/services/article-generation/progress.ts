import { db } from "@/server/db";
import {
  articleGenerations,
  articles,
  type ArticleGenerationStatus,
  type ArticleStatus,
} from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { logger } from "@/lib/utils/logger";



export async function updateGenerationProgress(
  generationId: number,
  status: ArticleGenerationStatus,
  progress: number,
  additionalData?: Record<string, unknown>,
): Promise<void> {
  const now = new Date();
  const [updatedGeneration] = await db
    .update(articleGenerations)
    .set({ status, progress, updatedAt: now, ...additionalData })
    .where(eq(articleGenerations.id, generationId))
    .returning({ articleId: articleGenerations.articleId });

  const articleId = updatedGeneration?.articleId;
  if (!articleId) return;

  let nextArticleStatus: ArticleStatus | null = null;
  const inProgressStatuses: ArticleGenerationStatus[] = [
    "research",
    "image",
    "writing",
    "quality-control",
    "validating",
    "updating",
  ];
  if (inProgressStatuses.includes(status)) {
    nextArticleStatus = "generating";
  } else if (status === "scheduled") {
    nextArticleStatus = "scheduled";
  } else if (status === "failed") {
    nextArticleStatus = "failed";
  }

  if (!nextArticleStatus) return;

  await db
    .update(articles)
    .set({ status: nextArticleStatus, updatedAt: now })
    .where(eq(articles.id, articleId));
}

export async function handleGenerationError(
  articleId: number,
  generationId: number | null,
  error: Error,
): Promise<void> {
  logger.error("generation:error", error.message);
  try {
    // Update main article status to "failed"
    await db
      .update(articles)
      .set({ status: "failed", updatedAt: new Date() })
      .where(eq(articles.id, articleId));

    if (generationId) {
      // Update generation record with error details
      await db
        .update(articleGenerations)
        .set({
          status: "failed",
          progress: 100,
          error: error.message,
          errorDetails:
            error instanceof Error
              ? {
                  name: error.name,
                  stack: error.stack,
                  cause: error.cause,
                }
              : { info: "Non-error object thrown" },
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(articleGenerations.id, generationId));
    }
  } catch (dbError) {
    logger.error("generation:db_error_on_error_handling", dbError);
  }
}

// Ensure exactly one intro paragraph exists between H1 and TL;DR (or first H2 if TL;DR missing)
export function ensureSingleIntro(markdown: string, intro: string): string {
  const lines = markdown.split(/\r?\n/);
  if (lines.length === 0) return intro;

  // Find H1
  let h1Idx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i]?.startsWith("# ")) {
      h1Idx = i;
      break;
    }
  }
  if (h1Idx === -1) {
    // No H1 found, prepend intro to be safe
    const existingContent = lines.join("\n").trim();
    if (
      !existingContent
        .toLowerCase()
        .includes(intro.substring(0, 20).toLowerCase())
    ) {
      return `${intro}\n\n${existingContent}`;
    }
    return existingContent;
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
