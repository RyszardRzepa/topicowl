import type { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { MODELS } from "@/constants";
import { z } from "zod";
import { normalizeSitemapUrl, validateSitemapUrl } from "@/lib/utils/sitemap";

export interface AnalyzeWebsiteRequest {
  websiteUrl: string;
}

// Default article structure template
const DEFAULT_ARTICLE_STRUCTURE = `**You are a SaaS content writer. Create a blog post in clean Markdown (.md) that follows the exact structure below. Obey every heading, formatting, and length instruction. Replace the ALL-CAPS text inside {curly-braces} with original content — do NOT output the braces themselves.**

# {COMPELLING H1 TITLE — ≤ 60 characters, capitalized headline style}

{1–2 sentence teaser that sums up the problem + payoff. Keep it punchy.}

![{ALT-TEXT DESCRIBING A RELEVANT HERO IMAGE}]( {IMAGE-URL-PLACEHOLDER} )

{Casual greeting, 1–2 sentences. Then a brief hook (~120 words) explaining why the topic matters for online sellers. Use a conversational tone. End with a forward-looking "In this post, we'll …" statement.}

## The Basics of {TOPIC}   <!-- SECTION 1 -->

{~200–250 words. Explain the core concept in plain language. Use second-person POV ("you"). Give 2–3 concrete, easily visualized examples. Close with a one-sentence benefit statement.}

## How {TECHNOLOGY / TREND} Is Changing {TOPIC}   <!-- SECTION 2 -->

{~300–350 words. Focus on how AI/automation disrupts traditional workflow. Cover:  1. Specific pain points it solves (bullet list of 3–4 items).  2. A mini-case/example featuring a brand or tool.  3. A brief note on challenges or caveats.  End with a rhetorical question that invites the reader to imagine future gains.}

![{SECOND IMAGE ALT-TEXT}]( {IMAGE-URL-PLACEHOLDER} )

## Learn More with Our {RESOURCE}   <!-- SECTION 3 / CTA -->

{100–150 words. Recap key takeaways in bold opening sentence. Highlight time-saving and ROI. Issue a direct call-to-action (CTA) to explore a course, demo, or signup link. One short sentence of positive urgency.}

---

**Article Information**  
- **Meta Description:** {META DESCRIPTION ≤ 155 characters, written in second person, includes primary keyword once}  
- **Target Keyword:** {PRIMARY FOCUS KEYWORD}`;

// Zod schema for AI analysis response
const WebsiteAnalysisSchema = z.object({
  companyName: z.string().min(1),
  productDescription: z.string().min(1),
  industryCategory: z.string().min(1),
  targetAudience: z.string().min(1),
  toneOfVoice: z.string().min(1),
  suggestedKeywords: z.array(z.string()).max(10),
  contentStrategy: z.object({
    articleStructure: z.string().min(1),
    maxWords: z.number().int().min(200).max(2000),
    publishingFrequency: z.enum(["daily", "weekly", "bi-weekly", "monthly"]),
  }),
});

type WebsiteAnalysis = z.infer<typeof WebsiteAnalysisSchema>;

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
      publishingFrequency: string;
    };
    onboardingCompleted: boolean;
  };
  error?: string;
}

// Enhanced website content extraction using Jina AI
async function jinaUrlToMd(url: string): Promise<string> {
  const jinaUrl = `https://r.jina.ai/${url}`;

  try {
    const response = await fetch(jinaUrl, {
      headers: {
        Accept: "text/markdown", // Request markdown if possible, otherwise text
      },
      // Add timeout to prevent hanging requests
      signal: AbortSignal.timeout(30000), // 30 second timeout
    });

    if (!response.ok) {
      throw new Error(
        `Jina AI request failed with status ${response.status}: ${await response.text()}`,
      );
    }

    const markdownContent = await response.text();

    if (!markdownContent || markdownContent.trim().length === 0) {
      throw new Error("No content received from Jina AI");
    }

    return markdownContent;
  } catch (error) {
    console.error("Error fetching content with Jina AI:", error);
    throw new Error(
      `Failed to extract website content: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

// Inline sitemap fetching function (same as in sitemap API)
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
        'User-Agent': 'Contentbot Sitemap Fetcher',
      },
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Failed to fetch sitemap: ${response.status} ${response.statusText}`);
    }

    const xmlData = await response.text();
    
    // Simple regex parsing to extract blog URLs - support multiple patterns
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
      console.log('No blog URLs found in sitemap');
      return { blogSlugs: [], sitemapUrl };
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
    
    console.log(`Found ${blogSlugs.length} blog posts in sitemap using pattern: /${matchedPattern}/`);
    return { blogSlugs, sitemapUrl };
    
  } catch (error) {
    console.error('Error fetching sitemap:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return { blogSlugs: [], sitemapUrl: normalizeSitemapUrl(websiteUrl), error: errorMessage };
  }
}

// Enhanced AI analysis using Google Gemini with generateObject
async function analyzeWebsiteWithAI(
  url: string,
  markdownContent: string,
): Promise<WebsiteAnalysis & { domain: string }> {
  try {
    const domain = new URL(url).hostname.replace("www.", "");

    // Use Gemini with generateObject for type-safe AI analysis
    const { object: analysis } = await generateObject({
      model: google(MODELS.GEMINI_FLASH_2_5),
      schema: WebsiteAnalysisSchema,
      prompt: `Analyze the following company website content and extract detailed information for content marketing setup.

Website URL: ${url}
Website content:
${markdownContent}

Focus on:
1. Understanding their business model and value proposition
2. Identifying their target market and customer base
3. Extracting relevant keywords from their actual content
4. Determining the appropriate tone based on their existing content
5. Suggesting content strategy that fits their industry

For industryCategory, use one of: technology, healthcare, finance, education, business, retail, manufacturing, consulting, marketing, legal, real-estate, food-beverage, travel, fitness, entertainment, non-profit, or other.

For toneOfVoice, provide a detailed description of the appropriate writing tone and style for this company's content. Be specific about the voice, personality, and communication approach that would resonate with their target audience. Write 1-2 sentences describing the ideal tone.

For publishingFrequency, choose from: daily, weekly, bi-weekly, or monthly based on industry standards.

Provide 5-10 relevant keywords for content marketing based on their actual content.`,
    });

    return {
      domain,
      ...analysis,
    };
  } catch (error) {
    console.error("Error analyzing website with AI:", error);

    // Fallback to basic analysis if AI fails
    const domain = new URL(url).hostname.replace("www.", "");
    return {
      domain,
      companyName: domain,
      productDescription: `${domain} provides professional services and solutions.`,
      industryCategory: "business",
      targetAudience: "business professionals",
      toneOfVoice:
        "Professional and informative tone that speaks directly to business professionals. Use clear, authoritative language while remaining approachable and practical.",
      suggestedKeywords: [],
      contentStrategy: {
        articleStructure: "introduction, main points, conclusion",
        maxWords: 800,
        publishingFrequency: "weekly",
      },
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

    // Enhanced website content extraction using Jina AI
    let markdownContent: string;
    try {
      markdownContent = await jinaUrlToMd(normalizedUrl);
      console.log(
        `Successfully extracted content from ${normalizedUrl}, length: ${markdownContent.length} characters`,
      );
    } catch (error) {
      console.error(`Failed to extract content from ${normalizedUrl}:`, error);
      const response: AnalyzeWebsiteResponse = {
        success: false,
        error: `Failed to analyze website. Please ensure the URL is accessible and try again. Error: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
      return Response.json(response, { status: 500 });
    }

    // AI analysis using Google Gemini
    let aiAnalysis;
    try {
      aiAnalysis = await analyzeWebsiteWithAI(normalizedUrl, markdownContent);
      console.log(`AI analysis completed for ${normalizedUrl}:`, {
        companyName: aiAnalysis.companyName,
        industryCategory: aiAnalysis.industryCategory,
        keywordCount: aiAnalysis.suggestedKeywords.length,
      });
    } catch (error) {
      console.error(`AI analysis failed for ${normalizedUrl}:`, error);
      const response: AnalyzeWebsiteResponse = {
        success: false,
        error: `Failed to analyze website content with AI. Please try again. Error: ${error instanceof Error ? error.message : "Unknown error"}`,
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
        console.log(`Attempting to fetch sitemap for ${normalizedUrl} during onboarding`);
        const sitemapResult = await fetchWebsiteSitemap(normalizedUrl);
        if (!sitemapResult.error) {
          sitemapUrl = sitemapResult.sitemapUrl;
          console.log(`Successfully fetched sitemap: ${sitemapUrl}, found ${sitemapResult.blogSlugs.length} blog posts`);
        } else {
          console.log(`Sitemap fetch failed: ${sitemapResult.error}`);
        }
      } catch (sitemapError) {
        console.log(`Sitemap fetch failed during onboarding: ${sitemapError instanceof Error ? sitemapError.message : 'Unknown error'}`);
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

        // Create or update article settings based on AI analysis
        const { articleSettings } = await import("@/server/db/schema");

        // Check if article settings already exist
        const [existingSettings] = await tx
          .select({ id: articleSettings.id })
          .from(articleSettings)
          .where(eq(articleSettings.userId, userRecord.id))
          .limit(1);

        if (existingSettings) {
          // Update existing settings
          await tx
            .update(articleSettings)
            .set({
              toneOfVoice: aiAnalysis.toneOfVoice,
              articleStructure: DEFAULT_ARTICLE_STRUCTURE,
              maxWords: aiAnalysis.contentStrategy.maxWords,
              sitemapUrl: sitemapUrl, // Store sitemap URL if found, null otherwise
              updatedAt: new Date(),
            })
            .where(eq(articleSettings.userId, userRecord.id));
        } else {
          // Create new settings
          await tx.insert(articleSettings).values({
            userId: userRecord.id,
            toneOfVoice: aiAnalysis.toneOfVoice,
            articleStructure: DEFAULT_ARTICLE_STRUCTURE,
            maxWords: aiAnalysis.contentStrategy.maxWords,
            sitemapUrl: sitemapUrl, // Store sitemap URL if found, null otherwise
          });
        }
      });

      console.log(
        `Successfully saved analysis data and completed onboarding for user ${userId}${sitemapUrl ? `, sitemap stored: ${sitemapUrl}` : ', no sitemap found'}`,
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
