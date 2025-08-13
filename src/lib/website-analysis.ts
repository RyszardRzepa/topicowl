import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { MODELS } from "@/constants";
import { z } from "zod";

// Schema for AI website analysis
export const WebsiteAnalysisSchema = z.object({
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

export type WebsiteAnalysis = z.infer<typeof WebsiteAnalysisSchema> & { domain: string };

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
export async function analyzeWebsitePure(rawUrl: string): Promise<WebsiteAnalysis> {
  const urlObj = new URL(/^(https?:)?\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`);
  const normalizedUrl = urlObj.toString();
  const domain = urlObj.hostname.replace(/^www\./, "");

  let markdown: string;
  try {
    markdown = await jinaUrlToMd(normalizedUrl);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    throw new Error(`Content extraction failed: ${msg}`);
  }

  try {
    const { object } = await generateObject({
      model: google(MODELS.GEMINI_FLASH_2_5),
      schema: WebsiteAnalysisSchema,
      prompt: `Analyze the following company website content and extract structured info for content marketing setup.\nURL: ${normalizedUrl}\n\nContent:\n${markdown}\n\nReturn JSON only.`,
    });
    return { domain, ...object };
  } catch {
    // Fallback minimal analysis (still satisfies downstream expectations)
    return {
      domain,
      companyName: domain,
      productDescription: `${domain} provides professional services and solutions.`,
      industryCategory: "business",
      targetAudience: "business professionals",
      toneOfVoice: "Professional and informative tone directed at business professionals.",
      suggestedKeywords: [],
      contentStrategy: {
        articleStructure: "introduction, main points, conclusion",
        maxWords: 800,
        publishingFrequency: "weekly",
      },
    };
  }
}
