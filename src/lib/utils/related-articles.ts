import { db } from "@/server/db";
import { projects, users } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { normalizeSitemapUrl, validateSitemapUrl } from "./sitemap";

// Interface for related article data
export interface RelatedArticle {
  slug: string;
  title: string;
  url: string;
}

// Function to fetch blog slugs from project's sitemap
async function fetchProjectBlogSlugs(projectId: number): Promise<string[]> {
  try {
    // Get sitemapUrl from projects table (single source of truth)
    const [projectRecord] = await db
      .select({ sitemapUrl: projects.sitemapUrl })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    const rawSitemapUrl = projectRecord?.sitemapUrl;

    if (!rawSitemapUrl) {
      console.log(`No sitemap URL configured for project ${projectId}`);
      return [];
    }

    // Normalize and validate the sitemap URL
    const sitemapUrl = normalizeSitemapUrl(rawSitemapUrl);
    const validation = validateSitemapUrl(sitemapUrl);

    if (!validation.isValid) {
      console.log(
        `Invalid sitemap URL for project ${projectId}: ${validation.error}`,
      );
      return [];
    }

    console.log(`Fetching blog slugs from sitemap: ${sitemapUrl}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    const response = await fetch(sitemapUrl, {
      headers: {
        "User-Agent": "Contentbot Related Articles Fetcher",
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

    // Support multiple blog URL patterns
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
      console.log(
        `No blog URLs found in sitemap for project ${projectId} (${sitemapUrl})`,
      );
      return [];
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
      `Found ${blogSlugs.length} blog slugs for project ${projectId}`,
    );
    return blogSlugs;
  } catch (error) {
    console.error(`Error fetching blog slugs for project ${projectId}:`, error);
    return [];
  }
}

// Function to select related articles based on keywords and topic similarity
export async function getRelatedArticles(
  projectId: number,
  currentTitle: string,
  keywords: string[],
  maxArticles = 3,
): Promise<string[]> {
  try {
    const blogSlugs = await fetchProjectBlogSlugs(projectId);

    if (blogSlugs.length === 0) {
      return [];
    }

    // Simple relevance scoring based on keyword matches in slug
    const scoredArticles = blogSlugs
      .map((slug) => {
        const slugWords = slug.toLowerCase().split(/[-_\s]+/);
        const titleWords = currentTitle.toLowerCase().split(/\s+/);
        const keywordWords = keywords.map((k) => k.toLowerCase());

        let score = 0;

        // Score based on keyword matches
        keywordWords.forEach((keyword) => {
          if (
            slugWords.some(
              (word) => word.includes(keyword) || keyword.includes(word),
            )
          ) {
            score += 3;
          }
        });

        // Score based on title word matches
        titleWords.forEach((titleWord) => {
          if (
            titleWord.length > 3 &&
            slugWords.some(
              (word) => word.includes(titleWord) || titleWord.includes(word),
            )
          ) {
            score += 1;
          }
        });

        return { slug, score };
      })
      .filter((item) => item.score > 0) // Only include articles with some relevance
      .sort((a, b) => b.score - a.score) // Sort by relevance score
      .slice(0, maxArticles) // Take top articles
      .map((item) => item.slug);

    console.log(
      `Selected ${scoredArticles.length} related articles for "${currentTitle}":`,
      scoredArticles,
    );
    return scoredArticles;
  } catch (error) {
    console.error("Error getting related articles:", error);
    return [];
  }
}

// Backward compatibility function that takes userId and gets the first project
export async function getRelatedArticlesByUserId(
  userId: string,
  currentTitle: string,
  keywords: string[],
  maxArticles = 3,
): Promise<string[]> {
  try {
    // Get the first project for this user (for backward compatibility)
    const [userProject] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.userId, userId))
      .limit(1);

    if (!userProject) {
      console.log(`No projects found for user ${userId}`);
      return [];
    }

    // Use the new function with the project ID
    return await getRelatedArticles(
      userProject.id,
      currentTitle,
      keywords,
      maxArticles,
    );
  } catch (error) {
    console.error("Error getting related articles by user ID:", error);
    return [];
  }
}

// Function to get user's domain for constructing full URLs
export async function getUserDomain(userId: string): Promise<string | null> {
  try {
    const [userRecord] = await db
      .select({ domain: users.domain })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    return userRecord?.domain ?? null;
  } catch (error) {
    console.error("Error getting user domain:", error);
    return null;
  }
}
