import { db } from "@/server/db";
import { articleSettings, users } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { normalizeSitemapUrl, validateSitemapUrl } from "./sitemap";

// Interface for related article data
export interface RelatedArticle {
  slug: string;
  title: string;
  url: string;
}

// Function to fetch blog slugs from user's sitemap
async function fetchUserBlogSlugs(userId: string): Promise<string[]> {
  try {
    // Get user's sitemap URL from settings
    const [userSettings] = await db
      .select({
        sitemap_url: articleSettings.sitemap_url,
      })
      .from(articleSettings)
      .where(eq(articleSettings.user_id, userId))
      .limit(1);

    if (!userSettings?.sitemap_url) {
      console.log(`No sitemap URL found for user ${userId}`);
      return [];
    }

    // Normalize and validate the sitemap URL
    const sitemapUrl = normalizeSitemapUrl(userSettings.sitemap_url);
    const validation = validateSitemapUrl(sitemapUrl);
    
    if (!validation.isValid) {
      console.log(`Invalid sitemap URL for user ${userId}: ${validation.error}`);
      return [];
    }

    console.log(`Fetching blog slugs from sitemap: ${sitemapUrl}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    const response = await fetch(sitemapUrl, {
      headers: {
        'User-Agent': 'Contentbot Related Articles Fetcher',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Failed to fetch sitemap: ${response.status} ${response.statusText}`);
    }

    const xmlData = await response.text();

    // Support multiple blog URL patterns
    const blogPatterns = [
      /<loc>[^<]+\/blog\/[^<]+<\/loc>/g,     // /blog/ pattern
      /<loc>[^<]+\/articles\/[^<]+<\/loc>/g, // /articles/ pattern
      /<loc>[^<]+\/posts\/[^<]+<\/loc>/g,    // /posts/ pattern
    ];

    let urlMatches: RegExpMatchArray | null = null;
    let matchedPattern = '';

    for (const pattern of blogPatterns) {
      urlMatches = xmlData.match(pattern);
      if (urlMatches && urlMatches.length > 0) {
        matchedPattern = pattern.source.includes('/blog/') ? 'blog' : 
                        pattern.source.includes('/articles/') ? 'articles' : 'posts';
        break;
      }
    }

    if (!urlMatches) {
      console.log(`No blog URLs found in sitemap for user ${userId}`);
      return [];
    }

    // Convert URLs to slugs based on the matched pattern
    const blogSlugs = urlMatches
      .map(match => {
        const url = match.replace(/<\/?loc>/g, '');
        try {
          const urlPath = new URL(url).pathname;
          // Remove the appropriate prefix and trailing slash
          const prefix = `/${matchedPattern}/`;
          return urlPath.replace(prefix, '').replace(/\/$/, '');
        } catch {
          return null;
        }
      })
      .filter((slug): slug is string => slug !== null && slug.length > 0 && !['blog', 'articles', 'posts'].includes(slug));

    console.log(`Found ${blogSlugs.length} blog slugs for user ${userId}`);
    return blogSlugs;

  } catch (error) {
    console.error(`Error fetching blog slugs for user ${userId}:`, error);
    return [];
  }
}

// Function to select related articles based on keywords and topic similarity
export async function getRelatedArticles(
  userId: string,
  currentTitle: string,
  keywords: string[],
  maxArticles = 3
): Promise<string[]> {
  try {
    const blogSlugs = await fetchUserBlogSlugs(userId);
    
    if (blogSlugs.length === 0) {
      return [];
    }

    // Simple relevance scoring based on keyword matches in slug
    const scoredArticles = blogSlugs
      .map(slug => {
        const slugWords = slug.toLowerCase().split(/[-_\s]+/);
        const titleWords = currentTitle.toLowerCase().split(/\s+/);
        const keywordWords = keywords.map(k => k.toLowerCase());

        let score = 0;

        // Score based on keyword matches
        keywordWords.forEach(keyword => {
          if (slugWords.some(word => word.includes(keyword) || keyword.includes(word))) {
            score += 3;
          }
        });

        // Score based on title word matches
        titleWords.forEach(titleWord => {
          if (titleWord.length > 3 && slugWords.some(word => word.includes(titleWord) || titleWord.includes(word))) {
            score += 1;
          }
        });

        return { slug, score };
      })
      .filter(item => item.score > 0) // Only include articles with some relevance
      .sort((a, b) => b.score - a.score) // Sort by relevance score
      .slice(0, maxArticles) // Take top articles
      .map(item => item.slug);

    console.log(`Selected ${scoredArticles.length} related articles for "${currentTitle}":`, scoredArticles);
    return scoredArticles;

  } catch (error) {
    console.error('Error getting related articles:', error);
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
    console.error('Error getting user domain:', error);
    return null;
  }
}
