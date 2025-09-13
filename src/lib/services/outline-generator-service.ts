/**
 * Simplified AI-First Outline Generator Service
 * Replaces complex template parsing with direct AI-driven markdown outline generation
 * Uses Gemini Flash model for fast, reliable outline creation
 */

import { generateObject } from "ai";
import { getModel } from "@/lib/ai-models";
import { MODELS } from "@/constants";
import { logger } from "@/lib/utils/logger";
import { z } from "zod";
import { selectBestScreenshotUrls } from "./screenshot-url-validator";

// Zod schema for structured outline generation with more lenient parsing
const outlineSchema = z
  .object({
    summary: z
      .string()
      .min(10)
      .describe("Brief summary of what this article will cover"),
    outlineMarkdown: z
      .string()
      .min(50)
      .describe(
        "Complete markdown outline with H2 headings and detailed section descriptions",
      ),
    // Optional: AI-selected links to use during writing (subset of available sources)
    recommendedLinks: z
      .array(
        z.object({
          url: z.string().url(),
          title: z.string().optional(),
          sectionHeading: z.string().optional(),
        }),
      )
      .optional(),
    // Optional: where to take screenshots and place them in the article
    screenshotPlan: z
      .array(
        z.object({
          url: z.string().url(),
          title: z.string().optional(),
          sectionHeading: z.string(),
          placement: z.enum(["start", "middle", "end"]),
        }),
      )
      .optional(),
  })
  .strict(); // Ensure only these fields are allowed

export interface OutlineRequest {
  title: string;
  keywords: string[];
  researchData: string;
  projectArticleStructure: string;
  userNotes?: string;
  maxWords?: number;
  toneOfVoice?: string;
  languageCode?: string;
  sources?: Array<{ url: string; title?: string }>; // available sources to pick from
}

export type OutlineResponse = z.infer<typeof outlineSchema>;

/**
 * Generates a structured markdown outline using AI
 * This replaces complex template parsing with natural language understanding
 */
export async function generateStructuredOutline(
  request: OutlineRequest,
): Promise<OutlineResponse> {
  const startTime = Date.now();

  logger.debug("[OUTLINE_GENERATOR] Starting AI-driven outline generation", {
    title: request.title,
    keywordsCount: request.keywords.length,
    hasNotes: !!request.userNotes,
  });

  const prompt = buildOutlinePrompt(request);

  logger.debug("[OUTLINE_GENERATOR] Sending request to AI model", {
    model: MODELS.GEMINI_2_5_FLASH,
    promptLength: prompt.length,
    title: request.title.substring(0, 50),
  });

  try {
    const result = await generateObject({
      model: await getModel(
        "google",
        MODELS.GEMINI_2_5_FLASH,
        "outline-generator",
      ),
      schema: outlineSchema,
      prompt,
      maxRetries: 2,
      maxOutputTokens: 10000,
      temperature: 0.1,
    });

    logger.debug("[OUTLINE_GENERATOR] AI model response received", {
      hasObject: !!result.object,
      objectKeys: result.object ? Object.keys(result.object) : [],
      summaryLength: result.object?.summary?.length ?? 0,
      outlineLength: result.object?.outlineMarkdown?.length ?? 0,
    });

    const outline = result.object;

    // Filter screenshot plan to ensure only valid URLs are included
    if (outline.screenshotPlan && outline.screenshotPlan.length > 0) {
      const validScreenshotUrls = selectBestScreenshotUrls(
        outline.screenshotPlan.map(item => ({ 
          url: item.url, 
          title: item.title 
        })),
        [], // Project excluded domains will be checked later in the screenshot service
        3   // Max 3 screenshots
      );
      
      // Update screenshot plan with only valid URLs
      outline.screenshotPlan = outline.screenshotPlan
        .filter(item => validScreenshotUrls.some(valid => valid.url === item.url))
        .slice(0, 3);

      logger.debug("[OUTLINE_GENERATOR] Filtered screenshot plan", {
        originalCount: result.object.screenshotPlan?.length ?? 0,
        validCount: outline.screenshotPlan.length
      });
    }

    logger.debug("[OUTLINE_GENERATOR] Outline generated successfully");

    return outline;
  } catch (error) {
    const processingTime = Date.now() - startTime;

    logger.error("[OUTLINE_GENERATOR] Failed to generate outline", {
      error: error instanceof Error ? error.message : "Unknown error",
      processingTimeMs: processingTime,
      title: request.title,
    });

    throw new Error(
      `Outline generation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

/**
 * Builds the comprehensive prompt for AI outline generation
 */
function buildOutlinePrompt(request: OutlineRequest): string {
  const {
    title,
    keywords,
    researchData,
    projectArticleStructure,
    userNotes,
    maxWords = 1800,
    toneOfVoice = "professional and informative",
    languageCode = "en",
    sources,
  } = request;

  if (!projectArticleStructure) {
    throw new Error("Article structure is required for outline generation");
  }

  return `You are an expert content strategist creating a structured article outline. You must respond with valid JSON containing exactly two fields: "summary" and "outlineMarkdown".

<article_requirements>
Title: ${title}
Target Keywords: ${keywords.join(", ")}
Max Words: ${maxWords}
Tone: ${toneOfVoice}
Language: ${languageCode}
${userNotes ? `User Notes: ${userNotes}` : ""}
</article_requirements>

<structure_template>
Use this exact structure template to create your outlineMarkdown:

${projectArticleStructure}

Follow this structure exactly, but adapt the content and section details based on the research data and article requirements.
</structure_template>

<research_data>
${researchData}
</research_data>

<available_sources>
${(sources ?? []).map((s, i) => `[S${i + 1}] ${s.url}${s.title ? ` - ${s.title}` : ""}`).join("\n")}
</available_sources>

<output_format>
You must respond with a JSON object containing these fields:

{
  "summary": "A brief 2-3 sentence overview of what this article will cover and why it's valuable",
  "outlineMarkdown": "A complete markdown outline with H2 headings following the structure template",
  "recommendedLinks": [
    { "url": "https://example.com/a", "title": "Example A", "sectionHeading": "Main Content Section Heading" }
  ],
  "screenshotPlan": [
    { "url": "https://example.com/a", "title": "Example A", "sectionHeading": "Main Content Section Heading", "placement": "start" }
  ]
}

SCREENSHOT SELECTION CRITERIA:
The screenshotPlan should contain URLs that will provide meaningful website previews to enhance the article. Think of these as visual references that readers can see inline with the content. 

Select websites that:
✓ Show relevant tools, dashboards, or interfaces mentioned in the article
✓ Display important data, charts, or visual information  
✓ Provide examples of concepts being discussed
✓ Are legitimate business/informational websites with clean, professional layouts

DO NOT select:
✗ Social media posts or profiles (no visual value, privacy concerns)
✗ Video pages (screenshots won't show the actual video content)
✗ Login pages or paywalled content (readers can't access)
✗ File download pages (not useful as website previews)
✗ Major brand homepages (often have anti-scraping measures)
</output_format>

<requirements_for_outlineMarkdown>
Your outlineMarkdown must:
1. FOLLOW THE STRUCTURE TEMPLATE ABOVE exactly - do not add, remove, or reorder sections
2. Use H2 headings (##) for each main section as shown in the template
3. Add 3-5 sentences under each heading explaining what specific content to include
4. Reference research data where relevant
5. Include specific writing instructions like "Include 2-3 bullet points" or "Add a relevant statistic"
6. Provide word count targets for each section that sum to approximately ${maxWords} words
7. Be specific, not generic (avoid phrases like "discuss the basics")
8. Reference actual research findings where possible
9. Ensure logical flow between sections within the given structure
</requirements_for_outlineMarkdown>

<link_and_screenshot_rules>
- Choose up to 6 URLs from <available_sources> as "recommendedLinks" that best support the planned sections.
- For screenshots, choose up to 3 high-value URLs from the recommended set that are suitable for web screenshots. Provide a "screenshotPlan" with the exact sectionHeading where each screenshot should appear and a placement of start | middle | end.

IMPORTANT: NEVER include these types of domains in screenshotPlan:
• Social Media: facebook.com, instagram.com, twitter.com, x.com, linkedin.com, tiktok.com, snapchat.com, discord.com, reddit.com, pinterest.com, tumblr.com
• Video Platforms: youtube.com, youtu.be, vimeo.com, twitch.tv, dailymotion.com
• Major Tech Brands: google.com, apple.com, microsoft.com, amazon.com, netflix.com, salesforce.com, github.com
• File Sharing: dropbox.com, drive.google.com, onedrive.live.com, box.com, wetransfer.com
• Payment/Auth: paypal.com, stripe.com, any URLs containing /login, /signin, /checkout, /payment

PREFERRED for screenshots: News websites, educational sites (.edu, .org, .gov), independent blogs, industry publications, research sites, and informational websites that provide valuable visual context for the article content.

Only select URLs that will show useful website previews that complement the article content.
</link_and_screenshot_rules>

Remember: Your response must be valid JSON matching the fields described above.`;
}
