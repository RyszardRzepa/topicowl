import type { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { analyzeWebsitePure } from "@/lib/website-analysis";
import { normalizeSitemapUrl, validateSitemapUrl } from "@/lib/utils/sitemap";

export interface AnalyzeWebsiteRequest {
  websiteUrl: string;
}

export interface AnalyzeWebsiteResponse {
  success: boolean;
  data?: {
    domain: string;
    companyName: string;
    productDescription: string;
    toneOfVoice: string;
    suggestedKeywords: string[];
    industryCategory: string;
    targetAudience: string;
    contentStrategy: {
      articleStructure: string;
      maxWords: number;
    };
    onboardingCompleted: boolean;
  };
  error?: string;
}

async function fetchWebsiteSitemap(websiteUrl: string): Promise<{
  blogSlugs: string[];
  sitemapUrl: string | null;
  error?: string;
}> {
  try {
    // Normalize the sitemap URL
    const sitemapUrl = normalizeSitemapUrl(websiteUrl);

    // Validate the sitemap URL
    const validation = validateSitemapUrl(sitemapUrl);
    if (!validation.isValid) {
      throw new Error(`Invalid sitemap URL: ${validation.error}`);
    }

    console.log(`Fetching sitemap from: ${sitemapUrl}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    const response = await fetch(sitemapUrl, {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      // Return error object instead of throwing for 404s (sitemap not found)
      return {
        error: `Failed to fetch sitemap: ${response.status} ${response.statusText}`,
        sitemapUrl: null,
        blogSlugs: [],
      };
    }

    const xmlData = await response.text();

    // Simple regex parsing to extract blog URLs - support multiple patterns
    const blogPatterns = [
      /<loc>[^<]+\/blog\/[^<]+<\/loc>/g, // /blog/ pattern
      /<loc>[^<]+\/articles\/[^<]+<\/loc>/g, // /articles/ pattern
      /<loc>[^<]+\/posts\/[^<]+<\/loc>/g, // /posts/ pattern
    ];

    let urlMatches: RegExpMatchArray | null = null;
    let matchedPattern = "";

    for (const pattern of blogPatterns) {
      urlMatches = xmlData.match(pattern);
      if (urlMatches && urlMatches.length > 0) {
        matchedPattern = pattern.source.includes("/blog/")
          ? "blog"
          : pattern.source.includes("/articles/")
            ? "articles"
            : "posts";
        break;
      }
    }

    if (!urlMatches) {
      console.log("No blog URLs found in sitemap");
      return { blogSlugs: [], sitemapUrl };
    }

    // Convert URLs to slugs based on the matched pattern
    const blogSlugs = urlMatches
      .map((match) => {
        const url = match.replace(/<\/?loc>/g, "");
        try {
          const urlPath = new URL(url).pathname;
          // Remove the appropriate prefix and trailing slash
          const prefix = `/${matchedPattern}/`;
          return urlPath.replace(prefix, "").replace(/\/$/, "");
        } catch {
          return null;
        }
      })
      .filter(
        (slug): slug is string =>
          slug !== null &&
          slug.length > 0 &&
          !["blog", "articles", "posts"].includes(slug),
      );

    console.log(
      `Found ${blogSlugs.length} blog posts in sitemap using pattern: /${matchedPattern}/`,
    );
    return { blogSlugs, sitemapUrl };
  } catch (error) {
    console.error("Error fetching sitemap:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    return {
      blogSlugs: [],
      sitemapUrl: normalizeSitemapUrl(websiteUrl),
      error: errorMessage,
    };
  }
}


export async function POST(request: NextRequest): Promise<Response> {
  try {
    // Authentication check
    const { userId } = await auth();
    if (!userId) {
      const response: AnalyzeWebsiteResponse = {
        success: false,
        error: "Unauthorized",
      };
      return Response.json(response, { status: 401 });
    }

    const body = (await request.json()) as AnalyzeWebsiteRequest;

    if (!body.websiteUrl) {
      const response: AnalyzeWebsiteResponse = {
        success: false,
        error: "Website URL is required",
      };
      return Response.json(response, { status: 400 });
    }

    // Validate and normalize URL format
    let normalizedUrl: string;
    try {
      const urlObj = new URL(body.websiteUrl);
      normalizedUrl = urlObj.toString();
    } catch {
      // Try adding https:// if no protocol is provided
      try {
        const urlObj = new URL(`https://${body.websiteUrl}`);
        normalizedUrl = urlObj.toString();
      } catch {
        const response: AnalyzeWebsiteResponse = {
          success: false,
          error: "Invalid URL format. Please provide a valid website URL.",
        };
        return Response.json(response, { status: 400 });
      }
    }

    console.log(`Starting website analysis for: ${normalizedUrl}`);

    // Combined extraction + AI analysis (pure helper)
    let aiAnalysis;
    try {
      aiAnalysis = await analyzeWebsitePure(normalizedUrl);
    } catch (error) {
      console.error("Website analysis failed:", error);
      const response: AnalyzeWebsiteResponse = {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to analyze website",
      };
      return Response.json(response, { status: 500 });
    }

    // Database operations with transaction for consistency
    try {
      // Get user record to check if article settings exist
      const [userRecord] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!userRecord) {
        const response: AnalyzeWebsiteResponse = {
          success: false,
          error: "User not found in database",
        };
        return Response.json(response, { status: 404 });
      }

      // Attempt to fetch sitemap (non-blocking)
      let sitemapUrl: string | null = null;
      try {
        console.log(
          `Attempting to fetch sitemap for ${normalizedUrl} during onboarding`,
        );
        const sitemapResult = await fetchWebsiteSitemap(normalizedUrl);
        if (!sitemapResult.error) {
          sitemapUrl = sitemapResult.sitemapUrl;
          console.log(
            `Successfully fetched sitemap: ${sitemapUrl}, found ${sitemapResult.blogSlugs.length} blog posts`,
          );
        } else {
          console.log(`Sitemap fetch failed: ${sitemapResult.error}`);
        }
      } catch (sitemapError) {
        console.log(
          `Sitemap fetch failed during onboarding: ${sitemapError instanceof Error ? sitemapError.message : "Unknown error"}`,
        );
        // Continue onboarding regardless of sitemap failure
      }

      // Use transaction to ensure data consistency and complete onboarding
      await db.transaction(async (tx) => {
        // Update user record with analysis data AND mark onboarding as complete
        await tx
          .update(users)
          .set({
            domain: aiAnalysis.domain,
            companyName: aiAnalysis.companyName,
            productDescription: aiAnalysis.productDescription,
            keywords: aiAnalysis.suggestedKeywords,
            onboardingCompleted: true, // Complete onboarding in the same transaction
            updatedAt: new Date(),
          })
          .where(eq(users.id, userId));

        // NOTE: article_settings now project-scoped; onboarding does not create a project here.
        // Creating default article settings should happen after project creation.
      });

      console.log(
        `Successfully saved analysis data and completed onboarding for user ${userId}${sitemapUrl ? `, sitemap stored: ${sitemapUrl}` : ", no sitemap found"}`,
      );

      const response: AnalyzeWebsiteResponse = {
        success: true,
        data: {
          ...aiAnalysis,
          onboardingCompleted: true,
        },
      };

      return Response.json(response);
    } catch (dbError) {
      console.error("Database error while saving analysis:", dbError);
      const response: AnalyzeWebsiteResponse = {
        success: false,
        error: "Failed to save analysis data. Please try again.",
      };
      return Response.json(response, { status: 500 });
    }
  } catch (error) {
    console.error("Error analyzing website:", error);

    const response: AnalyzeWebsiteResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };

    return Response.json(response, { status: 500 });
  }
}
