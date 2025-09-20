/**
 * Barrel file for the content generation service.
 */
export * from "./writer";
export * from "./types";




export * from "./writer";import { generateObject } from "ai";

export * from "./types";import { MODELS } from "@/constants";

import { getModel } from "@/lib/ai-models";
import { db } from "@/server/db";
import { projects, users, articleGenerations } from "@/server/db/schema";
import { blogPostSchema } from "@/types";
import { eq } from "drizzle-orm";
import { getUserExcludedDomains } from "@/lib/utils/article-generation";
import { getRelatedArticles } from "@/lib/utils/related-articles";
import write from "@/prompts/write";
import { logger } from "@/lib/utils/logger";

export interface ResearchResponse {
  researchData: string;
  sources: Array<{
    url: string;
    title?: string;
  }>;
}

export interface WriteRequest {
  researchData: ResearchResponse;
  title: string;
  keywords: string[];
  author?: string;
  publicationName?: string;
  coverImage?: string;
  videos?: Array<{
    title: string;
    url: string;
  }>;
  screenshots?: Array<{
    url: string;
    alt?: string;
    sectionHeading?: string;
    placement?: "start" | "middle" | "end";
  }>;
  sources?: Array<{
    url: string;
    title?: string;
  }>;
  notes?: string;
  outlineMarkdown?: string;
  userId: string;
  projectId: number;
  relatedArticles?: string[];
  generationId?: number;
}

export interface WriteResponse {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  metaDescription: string;
  introParagraph: string;
  readingTime: string;
  content: string;
  author: string;
  date: string;
  coverImage?: string;
  imageCaption?: string;
  tags?: string[];
  relatedPosts?: string[];
  videos?: Array<{
    title: string;
    url: string;
    sectionHeading: string;
    contextMatch: string;
  }>;
  hasVideoIntegration?: boolean;
}

/**
 * Core write function that can be called directly without HTTP
 * Extracted from /api/articles/write/route.ts
 */
export async function performWriteLogic(
  request: WriteRequest,
): Promise<WriteResponse> {
  logger.info("[WRITE_SERVICE] Starting write process");

  if (
    !request.researchData ||
    !request.title ||
    !request.keywords ||
    request.keywords.length === 0
  ) {
    throw new Error("Research data, title, and keywords are required");
  }

  // Retrieve user's excluded domains
  let excludedDomains: string[] = [];
  console.log(
    `[WRITE_SERVICE] Retrieving excluded domains for user: ${request.userId}`,
  );

  // Verify user exists in database using Clerk user ID
  const [userRecord] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, request.userId))
    .limit(1);

  if (userRecord) {
    excludedDomains = await getUserExcludedDomains(userRecord.id);
    console.log(
      `[WRITE_SERVICE] Found ${excludedDomains.length} excluded domains for user ${userRecord.id}`,
    );
  } else {
    console.log(`[WRITE_SERVICE] User not found for ID: ${request.userId}`);
  }

  // Filter sources to remove excluded domains
  let filteredSources = request.sources;
  if (request.sources && excludedDomains && excludedDomains.length > 0) {
    filteredSources = request.sources.filter((source) => {
      try {
        const url = new URL(source.url);
        const domain = url.hostname;

        // Normalize domain (remove www and convert to lowercase)
        const normalizedDomain = domain.toLowerCase().replace(/^www\./, "");

        // Check if domain is excluded
        const isExcluded = excludedDomains.some((excludedDomain) => {
          const normalizedExcluded = excludedDomain
            .toLowerCase()
            .replace(/^www\./, "");

          // Exact match
          if (normalizedDomain === normalizedExcluded) {
            return true;
          }

          // Check if the domain is a subdomain of the excluded domain
          if (normalizedDomain.endsWith("." + normalizedExcluded)) {
            return true;
          }

          return false;
        });

        if (isExcluded) {
          console.log(
            `[WRITE_SERVICE] Filtered out source: ${source.url} (domain: ${domain})`,
          );
        }

        return !isExcluded;
      } catch (error) {
        // If URL parsing fails, keep the source (don't filter invalid URLs)
        console.warn(
          `[WRITE_SERVICE] Could not parse URL for filtering: ${source.url}`,
          error,
        );
        return true;
      }
    });

    const filteredCount = request.sources.length - filteredSources.length;
    if (filteredCount > 0) {
      console.log(
        `[WRITE_SERVICE] Filtered out ${filteredCount} sources due to excluded domains`,
      );
    }
  }

  // Fetch project settings
  const [projectSettings] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, request.projectId))
    .limit(1);

  const settingsData = {
    toneOfVoice: projectSettings?.toneOfVoice ?? "",
    articleStructure: projectSettings?.articleStructure ?? "",
    maxWords: projectSettings?.maxWords ?? 1800,
    notes: request.notes ?? "",
    includeVideo: projectSettings?.includeVideo ?? true,
    includeTables: projectSettings?.includeTables ?? true,
    languageCode: (projectSettings as { language?: string })?.language ?? "en",
  };

  const outlineText = settingsData.articleStructure;

  const systemPrompt = write.system();
  const userPrompt = write.user(
    {
      title: request.title,
      researchData: request.researchData.researchData,
      videos: request.videos,
      screenshots: request.screenshots,
      sources: filteredSources,
      notes: request.notes,
    },
    settingsData,
    request.relatedArticles,
    excludedDomains,
    settingsData.articleStructure,
  );

  // Save the complete prompt if generationId is provided
  if (request.generationId) {
    const [existingArtifacts] = await db
      .select({ artifacts: articleGenerations.artifacts })
      .from(articleGenerations)
      .where(eq(articleGenerations.id, request.generationId))
      .limit(1);

    const artifacts = existingArtifacts?.artifacts;
    await db
      .update(articleGenerations)
      .set({
        artifacts: {
          ...(artifacts ?? {}),
          write: {
            ...(artifacts?.write ?? {}),
            prompt: `SYSTEM:\n${systemPrompt}\n\nUSER:\n${userPrompt}`,
          },
        },
        updatedAt: new Date(),
      })
      .where(eq(articleGenerations.id, request.generationId));
  }

  const result = await generateObject({
    model: await getModel("anthropic", MODELS.CLAUDE_SONNET_4, "write-service"),
    schema: blogPostSchema,
    messages: [
      {
        role: "system",
        content: write.system(),
        providerOptions: {
          anthropic: { cacheControl: { type: "ephemeral" } },
        },
      },
      {
        role: "user",
        content: write.user(
          {
            title: request.title,
            researchData: request.researchData.researchData,
            videos: request.videos,
            screenshots: request.screenshots,
            sources: filteredSources,
            notes: request.notes,
          },
          settingsData,
          request.relatedArticles,
          excludedDomains,
          outlineText,
        ),
      },
    ],
    maxRetries: 2,
    maxOutputTokens: 10000,
  });
  const articleObject = result.object;

  // Get related articles - use pre-generated ones if provided, otherwise generate them
  let finalRelatedArticles: string[] = request.relatedArticles ?? [];

  if (finalRelatedArticles.length === 0) {
    finalRelatedArticles = await getRelatedArticles(
      request.projectId,
      request.title,
      request.keywords,
      3,
    );
    console.log("[WRITE_SERVICE] Generated related articles (project-scoped)", {
      projectId: request.projectId,
      count: finalRelatedArticles.length,
      articles: finalRelatedArticles,
    });
  } else {
    console.log("[WRITE_SERVICE] Using pre-generated related articles", {
      count: finalRelatedArticles.length,
      articles: finalRelatedArticles,
    });
  }

  // Include the cover image and related articles in the response
  const responseObject = {
    ...articleObject,
    relatedPosts: finalRelatedArticles,
    ...(request.coverImage && { coverImage: request.coverImage }),
  } as WriteResponse;

  console.log("[WRITE_SERVICE] Article write completed successfully");

  return responseObject;
}