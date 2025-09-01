/**
 * Reddit utilities and validation functions
 * Provides helper functions for Reddit post processing and validation
 */

import { z } from 'zod';
import { clerkClient } from "@clerk/nextjs/server";
import { db } from "@/server/db";
import { redditSettings } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import type { ClerkPrivateMetadata } from "@/types";
import { refreshRedditToken, fetchUserSubreddits } from "./api";

// Validation schemas
const RedditPostSchema = z.object({
  id: z.string().min(1, 'Post ID is required'),
  title: z.string().min(1, 'Post title is required'),
  subreddit: z.string().min(1, 'Subreddit is required'),
  url: z.string().url('Invalid URL format'),
  permalink: z.string().optional(),
  author: z.string().optional(),
  created_utc: z.number().optional(),
  score: z.number().optional(),
  num_comments: z.number().optional(),
  selftext: z.string().optional(),
});

const SubredditNameSchema = z.string()
  .min(1, 'Subreddit name is required')
  .regex(/^[a-zA-Z0-9_]+$/, 'Invalid subreddit name format');

export type RedditPost = z.infer<typeof RedditPostSchema>;

/**
 * Normalizes Reddit post ID to consistent "t3_" format
 * @param postId - Reddit post ID in various formats
 * @returns Normalized post ID with "t3_" prefix
 */
export function normalizeRedditPostId(postId: string): string {
  if (!postId || typeof postId !== 'string') {
    throw new Error('Post ID must be a non-empty string');
  }

  const trimmedId = postId.trim();
  
  if (trimmedId.length === 0) {
    throw new Error('Post ID cannot be empty');
  }

  // If already has t3_ prefix, return as-is
  if (trimmedId.startsWith('t3_')) {
    return trimmedId;
  }

  // Add t3_ prefix to bare ID
  return `t3_${trimmedId}`;
}

/**
 * Validates Reddit post object structure and data
 * @param post - Reddit post object to validate
 * @returns Validated post object
 * @throws Error if validation fails
 */
export function validateRedditPost(post: unknown): RedditPost {
  try {
    const validatedPost = RedditPostSchema.parse(post);
    
    // Additional validation for normalized post ID
    validatedPost.id = normalizeRedditPostId(validatedPost.id);
    
    return validatedPost;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors.map(err => `${err.path.join('.')}: ${err.message}`);
      throw new Error(`Reddit post validation failed: ${errorMessages.join(', ')}`);
    }
    throw new Error(`Reddit post validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Extracts Reddit post ID from various URL formats
 * @param url - Reddit URL (full URL, permalink, or short URL)
 * @returns Extracted post ID with "t3_" prefix
 */
export function extractPostIdFromUrl(url: string): string {
  if (!url || typeof url !== 'string') {
    throw new Error('URL must be a non-empty string');
  }

  const trimmedUrl = url.trim();
  
  if (trimmedUrl.length === 0) {
    throw new Error('URL cannot be empty');
  }

  // Reddit URL patterns to match
  const patterns = [
    // Standard Reddit URLs: https://www.reddit.com/r/subreddit/comments/postid/title/
    /\/comments\/([a-zA-Z0-9]+)\//,
    // Short URLs: https://redd.it/postid
    /redd\.it\/([a-zA-Z0-9]+)/,
    // Direct post URLs: https://reddit.com/postid
    /reddit\.com\/([a-zA-Z0-9]+)$/,
    // Permalink format: /r/subreddit/comments/postid/
    /\/([a-zA-Z0-9]+)\/$/,
  ];

  for (const pattern of patterns) {
    const match = trimmedUrl.match(pattern);
    if (match?.[1]) {
      return normalizeRedditPostId(match[1]);
    }
  }

  throw new Error(`Could not extract post ID from URL: ${url}`);
}

/**
 * Formats subreddit name to consistent format (without r/ prefix)
 * @param subreddit - Subreddit name in various formats
 * @returns Formatted subreddit name without prefix
 */
export function formatSubredditName(subreddit: string): string {
  if (!subreddit || typeof subreddit !== 'string') {
    throw new Error('Subreddit name must be a non-empty string');
  }

  const trimmedName = subreddit.trim();
  
  if (trimmedName.length === 0) {
    throw new Error('Subreddit name cannot be empty');
  }

  // Remove r/ prefix if present
  const cleanName = trimmedName.startsWith('r/') ? trimmedName.slice(2) : trimmedName;
  
  // Remove /r/ prefix if present
  const finalName = cleanName.startsWith('/r/') ? cleanName.slice(3) : cleanName;
  
  // Validate the cleaned name
  try {
    SubredditNameSchema.parse(finalName);
    return finalName;
  } catch (error) {
    throw new Error(`Invalid subreddit name format: ${subreddit}`);
  }
}

/**
 * Validates an array of Reddit posts
 * @param posts - Array of Reddit post objects
 * @returns Array of validated posts
 */
export function validateRedditPosts(posts: unknown[]): RedditPost[] {
  if (!Array.isArray(posts)) {
    throw new Error('Posts must be an array');
  }

  const validatedPosts: RedditPost[] = [];
  const errors: string[] = [];

  posts.forEach((post, index) => {
    try {
      const validatedPost = validateRedditPost(post);
      validatedPosts.push(validatedPost);
    } catch (error) {
      errors.push(`Post ${index}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });

  if (errors.length > 0) {
    throw new Error(`Validation failed for ${errors.length} posts: ${errors.join('; ')}`);
  }

  return validatedPosts;
}

/**
 * Checks if a string is a valid Reddit post ID format
 * @param postId - String to check
 * @returns True if valid Reddit post ID format
 */
export function isValidRedditPostId(postId: string): boolean {
  if (!postId || typeof postId !== 'string') {
    return false;
  }

  const trimmedId = postId.trim();
  
  // Check for t3_ prefix format
  if (trimmedId.startsWith('t3_')) {
    const baseId = trimmedId.slice(3);
    return /^[a-zA-Z0-9]+$/.test(baseId) && baseId.length > 0;
  }

  // Check for bare ID format
  return /^[a-zA-Z0-9]+$/.test(trimmedId) && trimmedId.length > 0;
}

/**
 * Checks if a string is a valid subreddit name
 * @param subreddit - String to check
 * @returns True if valid subreddit name
 */
export function isValidSubredditName(subreddit: string): boolean {
  if (!subreddit || typeof subreddit !== 'string') {
    return false;
  }

  try {
    formatSubredditName(subreddit);
    return true;
  } catch {
    return false;
  }
}

/**
 * Sanitizes Reddit post title for safe display
 * @param title - Raw post title
 * @returns Sanitized title
 */
export function sanitizePostTitle(title: string): string {
  if (!title || typeof title !== 'string') {
    return '';
  }

  return title
    .trim()
    .replace(/[\r\n\t]/g, ' ') // Replace line breaks and tabs with spaces
    .replace(/\s+/g, ' ') // Collapse multiple spaces
    .slice(0, 300); // Limit length for database storage
}

/**
 * Creates a full Reddit URL from post data
 * @param subreddit - Subreddit name
 * @param postId - Reddit post ID
 * @param title - Post title (optional, for SEO-friendly URLs)
 * @returns Full Reddit URL
 */
export function createRedditUrl(subreddit: string, postId: string, title?: string): string {
  const formattedSubreddit = formatSubredditName(subreddit);
  const normalizedId = normalizeRedditPostId(postId);
  const baseId = normalizedId.startsWith('t3_') ? normalizedId.slice(3) : normalizedId;
  
  let url = `https://www.reddit.com/r/${formattedSubreddit}/comments/${baseId}/`;
  
  if (title) {
    // Create URL-friendly title slug
    const titleSlug = title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '_') // Replace spaces with underscores
      .slice(0, 50); // Limit length
    
    if (titleSlug) {
      url += `${titleSlug}/`;
    }
  }
  
  return url;
}

/**
 * Gets the start of the current week (Monday at 00:00:00)
 * @returns Date object representing the start of the current week
 */
export function getCurrentWeekStart(): Date {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Convert to days from Monday
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - daysFromMonday);
  weekStart.setHours(0, 0, 0, 0);
  return weekStart;
}

/**
 * Gets default subreddits based on project keywords and description
 * @param projectRecord - Project information containing keywords and description
 * @returns Array of default subreddit names
 */
export function getDefaultSubreddits(projectRecord: {
  companyName: string | null;
  productDescription: string | null;
  keywords: unknown;
}): string[] {
  const keywords = (projectRecord.keywords as string[]) ?? [];

  const relevantSubs = new Set<string>();

  // Technology and startup focused defaults
  relevantSubs.add("r/Entrepreneur");
  relevantSubs.add("r/startups");

  // Add based on keywords or description
  keywords.forEach((keyword) => {
    const lower = keyword.toLowerCase();
    if (lower.includes("saas") || lower.includes("software")) {
      relevantSubs.add("r/SaaS");
      relevantSubs.add("r/webdev");
    }
    if (lower.includes("ai") || lower.includes("machine learning")) {
      relevantSubs.add("r/MachineLearning");
      relevantSubs.add("r/artificial");
    }
    if (lower.includes("business") || lower.includes("marketing")) {
      relevantSubs.add("r/smallbusiness");
      relevantSubs.add("r/marketing");
    }
  });

  // Default fallback if no matches
  if (relevantSubs.size === 0) {
    return ["r/Entrepreneur", "r/startups", "r/smallbusiness"];
  }

  return Array.from(relevantSubs).slice(0, 7);
}

/**
 * Discovers user subreddits based on their Reddit connection and project settings
 * @param userId - User ID from Clerk
 * @param projectId - Project ID
 * @param projectRecord - Project information for fallback defaults
 * @returns Array of subreddit names to use
 */
export async function discoverUserSubreddits(
  userId: string,
  projectId: number,
  projectRecord: {
    companyName: string | null;
    productDescription: string | null;
    keywords: unknown;
  },
): Promise<string[]> {
  try {
    // Get Reddit access token from Clerk metadata
    const clerk = await clerkClient();
    const user = await clerk.users.getUser(userId);
    const metadata = (user.privateMetadata ?? {}) as ClerkPrivateMetadata;
    const projectConnection = metadata.redditTokens?.[projectId.toString()];

    if (projectConnection) {
      // User has Reddit connected - fetch their subscribed subreddits
      const accessToken = await refreshRedditToken(
        projectConnection.refreshToken,
      );
      const userSubreddits = await fetchUserSubreddits(accessToken);

      // Get settings for target subreddits
      const [settings] = await db
        .select({ targetSubreddits: redditSettings.targetSubreddits })
        .from(redditSettings)
        .where(eq(redditSettings.projectId, projectId));

      const targetSubs = (settings?.targetSubreddits as string[]) ?? [];

      // If user has explicitly selected target subreddits, use ONLY those
      if (targetSubs.length > 0) {
        console.log(
          `Using user-selected target subreddits: ${targetSubs.join(", ")}`,
        );
        return targetSubs;
      }

      // Fallback: if no target subreddits specified, use user's subscribed subreddits
      console.log(
        `No target subreddits specified, using user's subscriptions: ${userSubreddits.slice(0, 10).join(", ")}`,
      );
      return userSubreddits.slice(0, 10);
    }
  } catch (error) {
    console.warn("Failed to fetch user subreddits, using defaults:", error instanceof Error ? error.message : "Unknown error");
  }

  // Even without Reddit connection, check if user has specified target subreddits
  try {
    const [settings] = await db
      .select({ targetSubreddits: redditSettings.targetSubreddits })
      .from(redditSettings)
      .where(eq(redditSettings.projectId, projectId));

    const targetSubs = (settings?.targetSubreddits as string[]) ?? [];

    if (targetSubs.length > 0) {
      console.log(
        `Using user-specified target subreddits (no Reddit connection): ${targetSubs.join(", ")}`,
      );
      return targetSubs;
    }
  } catch (error) {
    console.warn("Failed to fetch target subreddits from settings:", error);
  }

  // Final fallback to default subreddits based on project
  console.log("Using default subreddits based on project");
  return getDefaultSubreddits(projectRecord);
}