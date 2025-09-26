import { db } from "@/server/db";
import { articleGenerations } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import type { ArticleGenerationArtifacts } from "@/types";

export async function mergeArtifacts(
  generationId: number,
  fragment: Partial<ArticleGenerationArtifacts>,
): Promise<void> {
  const [current] = await db
    .select({ artifacts: articleGenerations.artifacts })
    .from(articleGenerations)
    .where(eq(articleGenerations.id, generationId))
    .limit(1);

  const existingArtifacts = current?.artifacts;
  const next: ArticleGenerationArtifacts = {
    ...(existingArtifacts ?? {}),
    ...fragment,
    research: {
      ...(existingArtifacts?.research ?? {}),
      ...fragment.research,
    },
    validation: {
      ...(existingArtifacts?.validation ?? {}),
      ...fragment.validation,
    },
    write: {
      ...(existingArtifacts?.write ?? {}),
      ...fragment.write,
    },
    coverImage: {
      ...(existingArtifacts?.coverImage ?? {}),
      ...fragment.coverImage,
    },
  };

  await db
    .update(articleGenerations)
    .set({ artifacts: next, updatedAt: new Date() })
    .where(eq(articleGenerations.id, generationId));
}