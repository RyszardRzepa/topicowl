import { openai } from '@ai-sdk/openai';

import { generateObject } from "ai";
import { NextResponse } from "next/server";
import { prompts } from "@/prompts";
import { MODELS } from "@/constants";
import { db } from "@/server/db";
import { articleSettings, users, articleGeneration } from "@/server/db/schema";
import type { ResearchResponse } from "@/app/api/articles/research/route";
import { blogPostSchema } from "@/types";
import { eq } from "drizzle-orm";
import { getRelatedArticles } from "@/lib/utils/related-articles";

// Set maximum duration for AI operations to prevent timeouts
export const maxDuration = 800;

// Types colocated with this API route
interface WriteRequest {
  researchData: ResearchResponse; // Changed from outlineData to researchData
  title: string;
  keywords: string[];
  author?: string;
  publicationName?: string;
  coverImage?: string; // URL of the selected cover image
  videos?: Array<{
    title: string;
    url: string;
  }>;
  sources?: Array<{
    url: string;
    title?: string;
  }>;
  notes?: string; // User-provided context and requirements
  userId: string;
  relatedArticles?: string[]; // Pre-generated related articles to avoid re-generating them
  generationId?: number; // Optional generation ID to save the prompt
}

export interface WriteResponse {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  metaDescription: string;
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

export async function POST(request: Request) {
  let body: WriteRequest | undefined;
  try {
    body = (await request.json()) as WriteRequest;

    if (
      !body.researchData ||
      !body.title ||
      !body.keywords ||
      body.keywords.length === 0
    ) {
      throw new Error("Research data, title, and keywords are required");
    }

    // Retrieve user's excluded domains
    let excludedDomains: string[] = [];
    try {
      console.log(
        `[DOMAIN_FILTER] Retrieving excluded domains for Clerk user: ${body.userId}`,
      );

      // First, get the internal user ID from the Clerk user ID
      const [userRecord] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.clerk_user_id, body.userId))
        .limit(1);

      if (userRecord) {
        const settings = await db
          .select({ excluded_domains: articleSettings.excluded_domains })
          .from(articleSettings)
          .where(eq(articleSettings.user_id, userRecord.id))
          .limit(1);

        excludedDomains =
          settings.length > 0 ? settings[0]!.excluded_domains : [];

        console.log(
          `[DOMAIN_FILTER] Found ${excludedDomains.length} excluded domains for user ${userRecord.id}`,
        );
      } else {
        console.log(
          `[DOMAIN_FILTER] User not found for Clerk ID: ${body.userId}`,
        );
      }
    } catch (error) {
      console.error(
        `[DOMAIN_FILTER] Error retrieving excluded domains for Clerk user ${body.userId}:`,
        error,
      );
      // Return empty array on error to avoid blocking article generation
      excludedDomains = [];
    }

    // Filter sources to remove excluded domains
    let filteredSources = body.sources;
    if (body.sources && excludedDomains && excludedDomains.length > 0) {
      filteredSources = body.sources.filter((source) => {
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
              `[DOMAIN_FILTER] Filtered out source: ${source.url} (domain: ${domain})`,
            );
          }

          return !isExcluded;
        } catch (error) {
          // If URL parsing fails, keep the source (don't filter invalid URLs)
          console.warn(
            `[DOMAIN_FILTER] Could not parse URL for filtering: ${source.url}`,
            error,
          );
          return true;
        }
      });

      const filteredCount = body.sources.length - filteredSources.length;
      if (filteredCount > 0) {
        console.log(
          `[DOMAIN_FILTER] Filtered out ${filteredCount} sources due to excluded domains`,
        );
      }
    }

    // Fetch article settings
    let settingsData;
    try {
      const settings = await db.select().from(articleSettings).limit(1);
      settingsData =
        settings.length > 0
          ? {
              toneOfVoice: settings[0]!.toneOfVoice ?? "",
              articleStructure: settings[0]!.articleStructure ?? "",
              maxWords: settings[0]!.maxWords ?? 1800, // Provide default if column doesn't exist
              notes: body.notes ?? "", // Add notes field
            }
          : {
              toneOfVoice: "",
              articleStructure: "",
              maxWords: 1800,
              notes: body.notes ?? "", // Add notes field
            };
      console.log("[WRITE] Article settings loaded", {
        settingsFound: settings.length > 0,
      });
    } catch (error) {
      // If there's an error (like missing column), use defaults
      console.log(
        "[WRITE] Using default article settings due to database error",
        error,
      );
      settingsData = {
        toneOfVoice: "",
        articleStructure: "",
        maxWords: 1800,
        notes: body.notes ?? "", // Add notes field
      };
    }

    // Check if videos are available for enhanced generation
    const hasVideos = body.videos && body.videos.length > 0;
    // Always use basic schema for now to avoid schema validation issues
    const schemaToUse = blogPostSchema;

    let articleObject;
    // Create excluded domains prompt instruction
    const excludedDomainsInstruction =
      excludedDomains && excludedDomains.length > 0
        ? `\n\nIMPORTANT: Do not include any links to the following excluded domains in your response: ${excludedDomains.join(", ")}. If any of these domains appear in your source material, do not reference them or include links to them in the generated content.`
        : "";

    // Build the complete prompt
    const writePrompt =
      prompts.writing(
        {
          title: body.title,
          researchData: body.researchData.researchData,
          videos: body.videos,
          sources: filteredSources ?? [],
          notes: body.notes,
        },
        settingsData,
        body.relatedArticles ?? [], // Pass relatedArticles to the prompt
        excludedDomains,
      ) + excludedDomainsInstruction;

    // Save the write prompt to the database if generationId is provided
    if (body.generationId) {
      try {
        await db
          .update(articleGeneration)
          .set({
            writePrompt: writePrompt,
            updatedAt: new Date(),
          })
          .where(eq(articleGeneration.id, body.generationId));

        console.log("[WRITE] Write prompt saved to database", {
          generationId: body.generationId,
          promptLength: writePrompt.length,
        });
      } catch (error) {
        console.error("[WRITE] Failed to save write prompt to database", {
          generationId: body.generationId,
          error: error instanceof Error ? error.message : error,
        });
        // Continue with generation even if prompt saving fails
      }
    }

    try {
      const result = await generateObject({
        model: openai(MODELS.OPENAI_GPT_5),
        schema: schemaToUse,
        prompt: writePrompt,
        maxRetries: 2,
        maxOutputTokens: 10000,
      });
      articleObject = result.object;
    } catch (aiError) {
      console.error("[WRITE] AI content generation failed", {
        error:
          aiError instanceof Error
            ? {
                name: aiError.name,
                message: aiError.message,
                stack: aiError.stack?.slice(0, 500),
              }
            : aiError,
        model: MODELS.CLAUDE_SONET_4,
        hasVideos,
        schemaUsed: "blogPostSchema",
        requiredFields: Object.keys(blogPostSchema.shape),
      });
      throw aiError;
    }

    // Log video usage for analytics
    if (hasVideos) {
      const videoCount =
        "videos" in articleObject
          ? ((articleObject as { videos?: Array<unknown> }).videos?.length ?? 0)
          : 0;
      console.log(
        `[WRITE] Article generated with ${videoCount} videos embedded`,
      );
    }

    // Validate the AI response has required fields
    if (!articleObject.content || !articleObject.title || !articleObject.slug) {
      console.error("[WRITE] AI generated invalid article object", {
        hasContent: !!articleObject.content,
        hasTitle: !!articleObject.title,
        hasSlug: !!articleObject.slug,
        articleObject: JSON.stringify(articleObject).slice(0, 500) + "...",
      });
      throw new Error(
        "AI generated article is missing required fields (content, title, or slug)",
      );
    }

    // Get related articles - use pre-generated ones if provided, otherwise generate them
    let finalRelatedArticles: string[] = body.relatedArticles ?? [];

    if (finalRelatedArticles.length === 0) {
      try {
        // First get the internal user ID from Clerk user ID
        const [userRecord] = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.clerk_user_id, body.userId))
          .limit(1);

        if (userRecord) {
          finalRelatedArticles = await getRelatedArticles(
            userRecord.id,
            body.title,
            body.keywords,
            3,
          );
          console.log("[WRITE] Generated related articles", {
            count: finalRelatedArticles.length,
            articles: finalRelatedArticles,
          });
        }
      } catch (error) {
        console.error("[WRITE] Error generating related articles:", error);
        // Continue with empty array if related articles generation fails
      }
    } else {
      console.log("[WRITE] Using pre-generated related articles", {
        count: finalRelatedArticles.length,
        articles: finalRelatedArticles,
      });
    }

    // Include the cover image and related articles in the response
    const responseObject = {
      ...articleObject,
      relatedPosts: finalRelatedArticles,
      ...(body.coverImage && { coverImage: body.coverImage }),
    } as WriteResponse;

    console.log("[WRITE] Article write completed successfully", {
      finalContentLength: responseObject.content.length,
      hasMetaDescription: !!responseObject.metaDescription,
      tagsCount: responseObject.tags?.length ?? 0,
      relatedPostsCount: responseObject.relatedPosts?.length ?? 0,
    });

    return NextResponse.json(responseObject);
  } catch (error) {
    console.error("Write endpoint error - Full details:", {
      error:
        error instanceof Error
          ? {
              name: error.name,
              message: error.message,
              stack: error.stack,
            }
          : error,
      timestamp: new Date().toISOString(),
      request: {
        title: body?.title ?? "unknown",
        hasResearchData: !!body?.researchData,
        keywordsCount: body?.keywords?.length ?? 0,
        researchDataLength: body?.researchData?.researchData?.length ?? 0,
      },
    });

    // Return more specific error information for debugging
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json(
      {
        error: "Failed to write article",
        details: errorMessage,
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}
