import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/server/db";
import { projects, users } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { normalizeSitemapUrl, validateSitemapUrl } from "@/lib/utils/sitemap";

// Types colocated with this API route
export interface FetchSitemapRequest {
  projectId: number;
  websiteUrl: string;
  refreshCache?: boolean;
}

export interface FetchSitemapResponse {
  success: boolean;
  data?: {
    websiteUrl: string;
    blogSlugs: string[];
    totalBlogPosts: number;
    lastFetched: string;
    cacheExpiresAt: string;
  };
  error?: string;
}

const fetchSitemapSchema = z.object({
  projectId: z.number().min(1, "Project ID is required"),
  websiteUrl: z.string().min(1, "Website URL is required"),
  refreshCache: z.boolean().optional().default(false),
});

// Inline sitemap fetching function for API routes
async function fetchWebsiteSitemap(websiteUrl: string): Promise<{
  blogSlugs: string[];
  sitemapUrl: string;
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
      headers: {
        "User-Agent": "Contentbot Sitemap Fetcher",
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(
        `Failed to fetch sitemap: ${response.status} ${response.statusText}`,
      );
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

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate user with Clerk
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    // 2. Verify user exists in database
    const [userRecord] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!userRecord) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 },
      );
    }

    const body = (await req.json()) as unknown;
    const validatedData = fetchSitemapSchema.parse(body);

    // 3. For project-scoped operations, verify project ownership
    const [projectRecord] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(
        and(
          eq(projects.id, validatedData.projectId),
          eq(projects.userId, userRecord.id),
        ),
      )
      .limit(1);

    if (!projectRecord) {
      return NextResponse.json(
        { success: false, error: "Project not found or access denied" },
        { status: 404 },
      );
    }

    // Fetch sitemap data
    const sitemapResult = await fetchWebsiteSitemap(validatedData.websiteUrl);

    if (sitemapResult.error) {
      return NextResponse.json(
        {
          success: false,
          error: `Failed to fetch sitemap: ${sitemapResult.error}`,
        },
        { status: 400 },
      );
    }

    // Update project's sitemap URL directly
    await db
      .update(projects)
      .set({
        sitemapUrl: sitemapResult.sitemapUrl,
        updatedAt: new Date(),
      })
      .where(eq(projects.id, validatedData.projectId));

    const now = new Date();
    const cacheExpiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours from now

    const response: FetchSitemapResponse = {
      success: true,
      data: {
        websiteUrl: validatedData.websiteUrl,
        blogSlugs: sitemapResult.blogSlugs,
        totalBlogPosts: sitemapResult.blogSlugs.length,
        lastFetched: now.toISOString(),
        cacheExpiresAt: cacheExpiresAt.toISOString(),
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Fetch sitemap error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: "Invalid input data", details: error.errors },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { success: false, error: "Failed to fetch sitemap" },
      { status: 500 },
    );
  }
}
