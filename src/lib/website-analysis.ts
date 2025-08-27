import { generateObject, generateText } from "ai";
import { google } from "@ai-sdk/google";
import { MODELS } from "@/constants";
import { z } from "zod";
import { prompts } from "@/prompts";

// Schema for AI website analysis
export const WebsiteAnalysisSchema = z.object({
  companyName: z.string().min(1),
  productDescription: z.string().min(1),
  industryCategory: z.string().min(1),
  targetAudience: z.string().min(1),
  toneOfVoice: z.string().min(1),
  suggestedKeywords: z.array(z.string()).max(10),
  contentStrategy: z.object({
    maxWords: z.number().int().min(800).max(2000),
  }),
  // Detected primary content language of the website content
  languageCode: z.string().min(2).max(10), // e.g., "en", "en-US", "pl"
  languageName: z.string().min(2), // e.g., "English", "Polish"
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

  let markdown: string;
  try {
    markdown = await jinaUrlToMd(normalizedUrl);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    throw new Error(`Content extraction failed: ${msg}`);
  }

  // First, use web search to gather additional context about the company
  let researchData = "";
  try {
    console.log(`[WEBSITE_ANALYSIS] Starting web research for: ${domain}`);

    const result = await generateText({
      model: google(MODELS.GEMINI_FLASH_2_5),
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
    const { object } = await generateObject({
      model: google(MODELS.GEMINI_FLASH_2_5),
      schema: WebsiteAnalysisSchema,
      prompt: combinedContent +
        "\n\nDetect the primary content language of the website. Return both a BCP-47 compliant code (e.g., 'en', 'en-US', 'pl') in languageCode and a human-readable languageName.",
    });

    return {
      domain,
      ...object,
      contentStrategy: {
        ...object.contentStrategy,
        articleStructure: prompts.articleStructure(),
      },
    };
  } catch (err) {
    const aiErrorMsg =
      err instanceof Error ? err.message : "AI analysis failed";
    throw new Error(
      `Unable to analyze website: ${aiErrorMsg}. Please try again.`,
    );
  }
}
