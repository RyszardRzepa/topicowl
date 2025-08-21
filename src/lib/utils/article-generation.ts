/**
 * Utility functions for article generation with domain filtering support
 */

import { db } from "../../server/db";
import { articleSettings, projects } from "../../server/db/schema";
import { eq } from "drizzle-orm";
import { isDomainExcluded } from "./domain";

/**
 * Retrieves excluded domains for a project from article settings
 * @param projectId - The project ID
 */
export async function getProjectExcludedDomains(
  projectId: number,
): Promise<string[]> {
  try {
    console.log(
      `[DOMAIN_FILTER] Retrieving excluded domains for project: ${projectId}`,
    );

    // Try article settings first (new structure)
    const settings = await db
      .select({ excludedDomains: articleSettings.excludedDomains })
      .from(articleSettings)
      .where(eq(articleSettings.projectId, projectId))
      .limit(1);

    if (settings.length > 0) {
      const excludedDomains = settings[0]!.excludedDomains;
      console.log(
        `[DOMAIN_FILTER] Found ${excludedDomains.length} excluded domains from article_settings for project ${projectId}`,
      );
      return excludedDomains;
    }

    // Fallback to project table settings
    const projectSettings = await db
      .select({ excludedDomains: projects.excludedDomains })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    const excludedDomains =
      projectSettings.length > 0 ? projectSettings[0]!.excludedDomains : [];

    console.log(
      `[DOMAIN_FILTER] Found ${excludedDomains.length} excluded domains from projects table for project ${projectId}`,
    );

    return excludedDomains;
  } catch (error) {
    console.error(
      `[DOMAIN_FILTER] Error retrieving excluded domains for project ${projectId}:`,
      error,
    );
    // Return empty array on error to avoid blocking article generation
    return [];
  }
}

/**
 * Retrieves excluded domains for a user from their article settings
 * @param clerkUserId - The Clerk user ID from auth()
 * @deprecated Use getProjectExcludedDomains instead
 */
export async function getUserExcludedDomains(
  clerkUserId: string,
): Promise<string[]> {
  try {
    console.log(
      `[DOMAIN_FILTER] Retrieving excluded domains for Clerk user: ${clerkUserId}`,
    );

    // For backward compatibility, get all projects for the user and merge excluded domains
    const userProjects = await db
      .select({ excludedDomains: projects.excludedDomains })
      .from(projects)
      .where(eq(projects.userId, clerkUserId));

    const allExcludedDomains = new Set<string>();

    userProjects.forEach((project) => {
      project.excludedDomains.forEach((domain) =>
        allExcludedDomains.add(domain),
      );
    });

    const excludedDomains = Array.from(allExcludedDomains);
    console.log(
      `[DOMAIN_FILTER] Found ${excludedDomains.length} excluded domains for user ${clerkUserId}`,
    );

    return excludedDomains;
  } catch (error) {
    console.error(
      `[DOMAIN_FILTER] Error retrieving excluded domains for Clerk user ${clerkUserId}:`,
      error,
    );
    // Return empty array on error to avoid blocking article generation
    return [];
  }
}

/**
 * Filters sources by removing excluded domains
 */
export function filterSourcesByExcludedDomains(
  sources: Array<{ url: string; title?: string }>,
  excludedDomains: string[],
): Array<{ url: string; title?: string }> {
  if (!excludedDomains || excludedDomains.length === 0) {
    return sources;
  }

  const filteredSources = sources.filter((source) => {
    try {
      const url = new URL(source.url);
      const domain = url.hostname;
      const isExcluded = isDomainExcluded(domain, excludedDomains);

      if (isExcluded) {
        console.log(
          `[DOMAIN_FILTER] Filtered out source: ${source.url} (domain: ${domain})`,
        );
      }

      return !isExcluded;
    } catch (error) {
      // If URL parsing fails, keep the source (don't filter invalid URLs)
      console.warn(
        `[DOMAIN_FILTER] Could not parse URL for filtering: ${source.url}`,
        error,
      );
      return true;
    }
  });

  const filteredCount = sources.length - filteredSources.length;
  if (filteredCount > 0) {
    console.log(
      `[DOMAIN_FILTER] Filtered out ${filteredCount} sources due to excluded domains`,
    );
  }

  return filteredSources;
}

/**
 * Extracts domains from URLs in text content and filters out excluded ones
 */
export function filterDomainsFromText(
  text: string,
  excludedDomains: string[],
): string {
  if (!excludedDomains || excludedDomains.length === 0) {
    return text;
  }

  // Regular expression to find URLs in text
  const urlRegex = /https?:\/\/[^\s<>"{}|\\^`[\]]+/g;

  let filteredText = text;
  const matches = text.match(urlRegex);

  if (matches) {
    let filteredCount = 0;

    matches.forEach((url) => {
      try {
        const urlObj = new URL(url);
        const domain = urlObj.hostname;

        if (isDomainExcluded(domain, excludedDomains)) {
          // Remove the URL from the text
          filteredText = filteredText.replace(url, "");
          filteredCount++;
          console.log(
            `[DOMAIN_FILTER] Removed URL from text: ${url} (domain: ${domain})`,
          );
        }
      } catch (error) {
        // If URL parsing fails, leave it as is
        console.warn(
          `[DOMAIN_FILTER] Could not parse URL in text: ${url}`,
          error,
        );
      }
    });

    if (filteredCount > 0) {
      console.log(
        `[DOMAIN_FILTER] Filtered out ${filteredCount} URLs from text content`,
      );
      // Clean up any double spaces or line breaks left by URL removal
      filteredText = filteredText.replace(/\s+/g, " ").trim();
    }
  }

  return filteredText;
}

/**
 * Creates a prompt instruction for AI to avoid linking to excluded domains
 */
export function createExcludedDomainsPromptInstruction(
  excludedDomains: string[],
): string {
  if (!excludedDomains || excludedDomains.length === 0) {
    return "";
  }

  const domainList = excludedDomains.join(", ");

  return `\n\nIMPORTANT: Do not include any links to the following excluded domains in your response: ${domainList}. If any of these domains appear in your source material, do not reference them or include links to them in the generated content.`;
}
