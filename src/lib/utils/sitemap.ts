// Utility functions for sitemap handling
import { z } from "zod";

export const sitemapUrlSchema = z
  .string()
  .url()
  .refine(
    (url) => {
      // Allow various sitemap URL formats
      return url.includes("sitemap") || url.endsWith(".xml");
    },
    {
      message:
        "URL must be a valid sitemap (should contain 'sitemap' or end with '.xml')",
    },
  );

export function normalizeSitemapUrl(websiteUrl: string): string {
  try {
    // Remove trailing slashes
    const baseUrl = websiteUrl.endsWith("/")
      ? websiteUrl.slice(0, -1)
      : websiteUrl;

    // If it's already a sitemap URL, return as is
    if (baseUrl.includes("sitemap") && baseUrl.endsWith(".xml")) {
      return baseUrl;
    }

    // Otherwise, construct the standard sitemap URL
    return `${baseUrl}/sitemap.xml`;
  } catch {
    return websiteUrl;
  }
}

export function extractDomainFromSitemapUrl(sitemapUrl: string): string {
  try {
    const url = new URL(sitemapUrl);
    return url.hostname.replace("www.", "");
  } catch {
    return "";
  }
}

export function validateSitemapUrl(url: string): {
  isValid: boolean;
  error?: string;
} {
  try {
    sitemapUrlSchema.parse(url);
    return { isValid: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        isValid: false,
        error: error.errors[0]?.message ?? "Invalid sitemap URL",
      };
    }
    return { isValid: false, error: "Invalid sitemap URL" };
  }
}
