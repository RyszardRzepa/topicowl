import { z } from "zod";
import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { logger } from "@/lib/utils/logger";
import { captureSpecificScreenshots, validatePagesBeforeScreenshots } from "./capture";
import { MODELS } from "@/constants";

const screenshotPlacementSchema = z.object({
  placements: z
    .array(
      z.object({
        screenshotUrl: z.string().url(),
        reason: z.string(),
        altText: z.string(),
        sectionTitle: z
          .string()
          .describe(
            "The exact title of the markdown section (e.g., '## Section Title') where the screenshot should be placed. The screenshot will be inserted at the end of this section.",
          ),
      }),
    )
    .max(3)
    .describe(
      "An array of screenshot placements. Choose up to 3 of the most visually impactful sources.",
    ),
});

type ScreenshotPlacement = z.infer<typeof screenshotPlacementSchema>;

interface ScreenshotEnhancementResult {
  content: string;
}

function injectScreenshots(
  originalContent: string,
  placements: ScreenshotPlacement,
  screenshotResults: Array<{
    sourceUrl: string;
    storagePath: string;
    success: boolean;
  }>,
): string {
  let updatedContent = originalContent;

  const sortedPlacements = placements.placements
    .map((placement) => {
      const index = updatedContent.indexOf(placement.sectionTitle);
      return { ...placement, index };
    })
    .filter((p) => p.index !== -1)
    .sort((a, b) => b.index - a.index);

  for (const placementInfo of sortedPlacements) {
    const result = screenshotResults.find(
      (r) => r.sourceUrl === placementInfo.screenshotUrl,
    );

    if (!result?.success) continue;

    const { sectionTitle, altText } = placementInfo;
    const screenshotMarkdown = `\n\n![${altText}](${result.storagePath})\n\n`;

    const sectionStartIndex = placementInfo.index;
    const contentAfterSection = updatedContent.substring(
      sectionStartIndex + sectionTitle.length,
    );
    const nextSectionMatch = /^##\s/m.exec(contentAfterSection);
    let insertPosition;

    if (nextSectionMatch?.index !== undefined) {
      insertPosition =
        sectionStartIndex + sectionTitle.length + nextSectionMatch.index;
    } else {
      insertPosition = updatedContent.length;
    }

    updatedContent = `${updatedContent.slice(
      0,
      insertPosition,
    )}${screenshotMarkdown}${updatedContent.slice(insertPosition)}`;
  }

  // Handle fallback for any screenshots where the section title wasn't found
  const unplacedResults = screenshotResults.filter(
    (result) =>
      result.success &&
      !sortedPlacements.some((p) => p.screenshotUrl === result.sourceUrl),
  );

  for (const result of unplacedResults) {
    const placementInfo = placements.placements.find(
      (p) => p.screenshotUrl === result.sourceUrl,
    );
    if (placementInfo) {
      updatedContent += `\n\n![${placementInfo.altText}](${result.storagePath})`;
    }
  }

  return updatedContent;
}

export async function enhanceArticleWithScreenshots(params: {
  content: string;
  sources: Array<{ url: string; title?: string }>;
  articleId: number;
  projectId: number;
  generationId: number;
  articleTitle: string;
}): Promise<ScreenshotEnhancementResult | null> {
  const { content, articleId, generationId, projectId, articleTitle } = params;

  try {
    logger.info("screenshot_enhancement_started", { generationId });

    const { object: screenshotPlacement } = await generateObject({
      model: google(MODELS.GEMINI_2_5_FLASH),
      schema: screenshotPlacementSchema,
      prompt: `You are a content strategist. Your task is to analyze the following article, which is structured in markdown sections, and decide where to place screenshots to enhance it.
The article is titled "${articleTitle}".

Your process is as follows:
1.  **Analyze each section**: Go through the article section by section (demarcated by '##' headings).
2.  **Identify topic and links**: For each section, understand its topic and identify any external links within it.
3.  **Select the best link**: If a section has external links, choose the single most relevant and visually compelling URL for a screenshot. This URL should directly support the section's content.
4.  **Ensure Uniqueness**: The URLs for screenshots must be unique across the entire article. Do not select the same URL for different sections.

IMPORTANT RULES:
1.  ONLY select URLs from UNIQUE WEBSITES and BLOGS - avoid social media, marketplaces, and generic platforms.
2.  BLACKLISTED DOMAINS (DO NOT screenshot): facebook.com, instagram.com, twitter.com, x.com, linkedin.com, youtube.com, tiktok.com, amazon.com, ebay.com, walmart.com, target.com, wikipedia.org, reddit.com, quora.com, pinterest.com, snapchat.com, telegram.org, whatsapp.com, discord.com, slack.com, zoom.us, microsoft.com, google.com, apple.com, github.com
3.  PREFER: Independent blogs, company websites, news sites, research sites, specialized tools, and unique web applications.
4.  Screenshots should be placed at the END of a section, right before the next section's title heading.
5.  Select up to 3 URLs in total for the entire article.

For each selected screenshot, provide the exact markdown heading of the section (e.g., '## This is a Section Title') where it should be placed.

Article Content:
---
${content}
---`,
    });

    if (!screenshotPlacement.placements.length) {
      logger.info("screenshot_enhancement_no_placements", { generationId });
      return null;
    }

    const urlsToCapture = screenshotPlacement.placements.map(
      (p) => p.screenshotUrl,
    );

    // Validate pages before capturing screenshots
    const validatedUrls = await validatePagesBeforeScreenshots(urlsToCapture);
    
    const screenshotResults = await captureSpecificScreenshots({
      screenshotRequests: validatedUrls.map((url: string) => ({ url })),
      articleId,
      projectId,
      generationId,
    });

    const finalContent = injectScreenshots(
      content,
      {
        placements: screenshotPlacement.placements.filter((p) =>
          validatedUrls.includes(p.screenshotUrl)
        ),
      },
      Object.entries(screenshotResults.screenshots).map(([url, record]) => ({
        sourceUrl: url,
        storagePath: record.imageUrl,
        success: record.status === 200,
      })),
    );

    logger.info("screenshot_enhancement_completed", {
      generationId,
      screenshotsProcessed: screenshotResults.usageStats.requestsAttempted,
    });

    return {
      content: finalContent,
    };
  } catch (error) {
    logger.error("screenshot_enhancement_failed", {
      generationId,
      error:
        error instanceof Error
          ? error.message
          : "An unknown error occurred during screenshot enhancement.",
    });
    return null;
  }
}
