import { generateObject, generateText } from "ai";
import { google } from "@ai-sdk/google";
import { MODELS } from "@/constants";
import { z } from "zod";
import { prompts } from "@/prompts";

// Schema for AI website analysis
export const WebsiteAnalysisSchema = z.object({
  companyName: z.string().min(1).max(100),
  productDescription: z.string().min(1).max(500),
  industryCategory: z.string().min(1).max(50),
  targetAudience: z.string().min(1).max(100),
  toneOfVoice: z.string().min(1).max(50),
  suggestedKeywords: z.array(z.string().min(1).max(50)).min(3).max(10),
  contentStrategy: z.object({
    maxWords: z.number().int().min(800).max(2000),
  }),
  // Detected primary content language of the website content
  languageCode: z.string().min(2).max(10).default("en"), // e.g., "en", "en-US", "pl"
  languageName: z.string().min(2).max(30).default("English"), // e.g., "English", "Polish"
});

export type WebsiteAnalysis = z.infer<typeof WebsiteAnalysisSchema> & {
  domain: string;
  contentStrategy: z.infer<typeof WebsiteAnalysisSchema>["contentStrategy"] & {
    articleStructure: string;
  };
};

// Fetch public website content via Jina (markdown)
async function jinaUrlToMd(url: string): Promise<string> {
  const jinaUrl = `https://r.jina.ai/${url}`;
  const response = await fetch(jinaUrl, {
    headers: { Accept: "text/markdown" },
    signal: AbortSignal.timeout(30000), // 30s timeout
  });
  if (!response.ok) {
    throw new Error(`Jina AI fetch failed: ${response.status}`);
  }
  const text = await response.text();
  if (!text.trim()) throw new Error("Empty content returned");
  return text;
}

// Pure analysis (no DB side effects)
export async function analyzeWebsitePure(
  rawUrl: string,
): Promise<WebsiteAnalysis> {
  const urlObj = new URL(
    /^(https?:)?\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`,
  );
  const normalizedUrl = urlObj.toString();
  const domain = urlObj.hostname.replace(/^www\./, "");

  console.log(`[WEBSITE_ANALYSIS] Starting analysis for domain: ${domain}`);

  let markdown: string;
  try {
    console.log(`[WEBSITE_ANALYSIS] Fetching content via Jina for: ${normalizedUrl}`);
    markdown = await jinaUrlToMd(normalizedUrl);
    console.log(`[WEBSITE_ANALYSIS] Content extracted successfully, length: ${markdown.length} chars`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    console.error(`[WEBSITE_ANALYSIS] Content extraction failed for ${domain}:`, msg);
    throw new Error(`Content extraction failed: ${msg}`);
  }

  // First, use web search to gather additional context about the company
  let researchData = "";
  try {
    console.log(`[WEBSITE_ANALYSIS] Starting web research for: ${domain}`);

    const result = await generateText({
      model: google(MODELS.GEMINI_2_5_FLASH),
      providerOptions: {
        google: {
          thinkingConfig: {
            thinkingBudget: 0,
          },
        },
      },
      tools: {
        google_search: google.tools.googleSearch({}),
      },
      system: `Ensure the intent is current and based on real-time top results.`,
      prompt: prompts.websiteAnalysis(normalizedUrl),
    });

    researchData = result.text;
    console.log(
      `[WEBSITE_ANALYSIS] Research completed, length: ${researchData.length} chars`,
    );
  } catch (err) {
    console.warn(
      `[WEBSITE_ANALYSIS] Research failed, using only website content:`,
      err,
    );
    // If research fails, we'll still proceed with just the website content
  }

  // Combine website content with research data for analysis
  const combinedContent = `
# Website Content Analysis
URL: ${normalizedUrl}
Domain: ${domain}

## Direct Website Content:
${markdown}

${
  researchData
    ? `## Additional Research Context:
${researchData}`
    : ""
}
  `.trim();

  try {
    console.log(`[WEBSITE_ANALYSIS] Starting AI analysis for: ${domain}`);
    
    const { object } = await generateObject({
      model: google(MODELS.GEMINI_2_5_FLASH),
      schema: WebsiteAnalysisSchema,
      system: `You are an expert website analyzer. You must always provide a response that exactly matches the required JSON schema. If information is missing, use reasonable defaults based on the website content and industry.

Required fields:
- companyName: Extract from website or use domain name as fallback
- productDescription: Brief description of what the company does
- industryCategory: General industry category (e.g., "Technology", "E-commerce", "Consulting")
- targetAudience: Who the company serves (e.g., "Businesses", "Consumers", "Developers")
- toneOfVoice: Writing style (e.g., "Professional", "Casual", "Technical", "Friendly")
- suggestedKeywords: Array of 5-10 relevant keywords
- contentStrategy.maxWords: Integer between 800-2000 for article length
- languageCode: Primary language code (e.g., "en", "es", "fr")
- languageName: Full language name (e.g., "English", "Spanish", "French")`,
      prompt: `${combinedContent}

ANALYSIS TASK:
Analyze the website content and return a JSON object with the following information:
1. Company name (if not clear, use the domain name)
2. Product/service description (1-2 sentences)
3. Industry category
4. Target audience
5. Appropriate tone of voice for their content
6. 5-10 relevant keywords for SEO
7. Recommended article length (800-2000 words)
8. Primary content language of the website

Provide specific, actionable data. If any information is unclear, make reasonable assumptions based on the available content.`,
    });

    console.log(`[WEBSITE_ANALYSIS] AI analysis completed successfully for: ${domain}`);

    return {
      domain,
      ...object,
      contentStrategy: {
        ...object.contentStrategy,
        articleStructure: prompts.articleStructure(),
      },
    };
  } catch (err) {
    console.error(`[WEBSITE_ANALYSIS] AI analysis failed for ${domain}:`, err);
    
    // Provide fallback analysis based on basic information
    console.log(`[WEBSITE_ANALYSIS] Providing fallback analysis for: ${domain}`);
    
    const fallbackCompanyName = domain.split('.')[0]?.replace(/[-_]/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ') ?? 'Company';

    return {
      domain,
      companyName: fallbackCompanyName,
      productDescription: `${fallbackCompanyName} provides products and services through their website.`,
      industryCategory: "Business",
      targetAudience: "General audience",
      toneOfVoice: "Professional",
      suggestedKeywords: [domain.split('.')[0] ?? 'business', 'services', 'products', 'solutions'],
      contentStrategy: {
        maxWords: 1200,
        articleStructure: prompts.articleStructure(),
      },
      languageCode: "en",
      languageName: "English",
    };
  }
}
