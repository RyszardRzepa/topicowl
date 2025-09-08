// Domain types for shared business entities
// API-specific request/response types are colocated with their routes

import { z } from "zod";
import type { projects } from "@/server/db/schema";
import type { articleStatusEnum } from "@/server/db/schema";

// OpenGraph metadata schema
export const ogMetadataSchema = z.object({
  title: z
    .string()
    .describe(
      "The title of the blog post that would appear in search results.",
    ),
  description: z
    .string()
    .describe(
      "A compelling description of the blog post (max 160 characters).",
    ),
  image: z
    .string()
    .url()
    .optional()
    .describe("A URL to a relevant image for the blog post."),
  url: z.string().url().describe("The canonical URL of the blog post."),
  siteName: z.string().describe("The name of the website."),
  type: z.literal("article").default("article"),
  publishedTime: z
    .string()
    .optional()
    .describe("The published time of the article in ISO format."),
  modifiedTime: z
    .string()
    .optional()
    .describe("The last modified time of the article in ISO format."),
  author: z.string().optional().describe("The author of the article."),
  section: z
    .string()
    .optional()
    .describe("The section/category of the article."),
  tags: z
    .array(z.string())
    .optional()
    .describe("An array of tags for the article."),
  relatedPosts: z
    .array(z.string())
    .optional()
    .describe("An array of related post slugs."),
});

export type BlogPost = z.infer<typeof ogMetadataSchema>;

// Video embed schema for YouTube integration
export const videoEmbedSchema = z.object({
  title: z.string().describe("Video title from research"),
  url: z.string().url().describe("YouTube video URL"),
  sectionHeading: z
    .string()
    .optional()
    .describe("The section heading where this video should be placed"),
  contextMatch: z
    .string()
    .optional()
    .describe("Brief explanation of why this video fits this section"),
  embedCode: z
    .string()
    .optional()
    .describe("Generated iframe HTML for the video"),
  thumbnail: z.string().url().optional().describe("Video thumbnail URL"),
  duration: z.number().optional().describe("Video duration in seconds"),
  uploadDate: z.string().optional().describe("Video upload date in ISO format"),
});

export type VideoEmbed = z.infer<typeof videoEmbedSchema>;

// Blog post schema for AI-generated content - includes all SEO fields
export const blogPostSchema = z.object({
  id: z
    .string()
    .describe(
      "A unique ID for the blog post. A random number as a string is fine.",
    ),
  title: z.string().describe("The title of the blog post."),
  slug: z.string().describe("A URL-friendly version of the title."),
  excerpt: z.string().describe("A short, compelling summary (1-2 sentences)."),
  metaDescription: z
    .string()
    .describe("An SEO-friendly description for the blog post. Max 160 char."),
  introParagraph: z
    .string()
    .describe(
      "The article intro (1–3 sentences) that appears immediately after the H1.",
    ),
  readingTime: z
    .string()
    .describe("An estimated reading time, e.g., '5 min read'."),
  content: z.string().describe("The full article content in Markdown format."),
  author: z
    .string()
    .default("Content Team")
    .describe("The author of the blog post."),
  date: z.string().describe("The publication date."),
  coverImage: z
    .string()
    .optional()
    .describe("A placeholder URL for the cover image."),
  imageCaption: z
    .string()
    .optional()
    .describe("A placeholder caption for the cover image."),
  tags: z
    .array(z.string())
    .optional()
    .describe("An array of relevant SEO keywords/tags."),
  relatedPosts: z
    .array(z.string())
    .optional()
    .describe("An array of related post slugs."),
});

// Enhanced blog post schema with optional video integration
export const enhancedBlogPostSchema = blogPostSchema.extend({
  videos: z
    .array(videoEmbedSchema)
    .max(1)
    .describe("Maximum one embedded video per article"),
  hasVideoIntegration: z
    .boolean()
    .default(false)
    .describe("Indicates if article includes video content"),
});

// Article status type - imported from database schema
export type ArticleStatus = (typeof articleStatusEnum.enumValues)[number];

// Workflow phases for new UI
export type WorkflowPhase = "planning" | "generations" | "publishing";

// Enhanced article status for workflow organization
export interface ArticleWorkflowStatus {
  status: ArticleStatus;
  phase: WorkflowPhase;
  isScheduled: boolean;
  isActive: boolean; // currently being processed
}

// Project types - inferred from database schema
// Use Drizzle's type inference for consistency with database schema
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;

// Article types - core domain entity
export interface Article {
  id: string;
  title: string;
  content?: string;
  status: ArticleStatus;
  projectId: number; // Required project association
  slug?: string; // URL slug for article page
  keywords?: string[];
  targetWordCount?: number;
  publishDate?: string;
  notes?: string; // User-provided context and requirements for AI guidance
  createdAt: string;
  updatedAt: string;

  // Enhanced fields for new workflow
  generationProgress?: number; // 0-100 percentage
  generationPhase?: "research" | "writing" | "validation" | "optimization";
  generationError?: string;
  estimatedReadTime?: number; // in minutes
  views?: number;
  clicks?: number;

  // Generation scheduling
  generationScheduledAt?: string;
  generationStartedAt?: string;
  generationCompletedAt?: string;

  // Publishing scheduling
  publishScheduledAt?: string; // Frontend compatibility field
  scheduledAt?: string; // Database field name
  publishedAt?: string;
}

// Settings types - domain entity for application configuration
export interface ArticleSettings {
  id: string;
  projectId: number; // Required project association
  name: string;
  defaultWordCount: number;
  tone: "professional" | "casual" | "authoritative" | "friendly";
  keywords: string[];
  competitorUrls: string[];
  publishingSchedule?: {
    frequency: "daily" | "weekly" | "monthly";
    time: string; // HH:MM format
    timezone: string;
  };
  seoSettings: {
    focusKeywordDensity: number; // percentage
    enableInternalLinking: boolean;
    metaDescriptionLength: number;
  };
  createdAt: string;
  updatedAt: string;
}

// Reddit integration types for project-specific connections
export interface ProjectRedditConnection {
  refreshToken: string;
  redditUsername: string;
  redditUserId: string;
  connectedAt: string;
  lastUsedAt?: string;
  scopes: string[];
}

// X (Twitter) integration types for project-specific connections
export interface ProjectXConnection {
  refreshToken: string;
  accessToken?: string; // optional cached token if we ever store it short-lived
  expiresAt?: string; // ISO timestamp when accessToken expires
  xUsername: string;
  xUserId: string;
  connectedAt: string;
  lastUsedAt?: string;
  scopes: string[];
}

// Clerk private metadata structure for Reddit tokens
export interface ClerkPrivateMetadata {
  redditTokens?: Record<string, ProjectRedditConnection>;
  xTokens?: Record<string, ProjectXConnection>;
  // Other existing metadata fields can be added here as needed
  [key: string]: unknown; // Index signature for Clerk compatibility
}

// Reddit token data from OAuth flow
export interface RedditTokenData {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  scope: string;
}

// Reddit user data from API
export interface RedditUserData {
  name: string;
  id: string;
}

// Reddit connection status response
export interface RedditConnectionStatus {
  connected: boolean;
  connection?: {
    projectId: number;
    redditUsername: string;
    connectedAt: string;
    lastUsedAt?: string;
    scopes: string[];
  };
}

// Utility types for Reddit token management
export type RedditTokens = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
};

export type RedditUserInfo = {
  username: string;
  userId: string;
};

// Session management types for preventing tab refetch
export interface SessionData {
  sessionId: string;
  timestamp: number;
  initialized: boolean;
  data?: unknown;
}

export interface OnboardingSession {
  status: boolean | null;
  timestamp: number;
  sessionId: string;
}

export interface ProjectProviderState {
  isSessionInitialized: boolean;
  lastFetchTimestamp: number;
  sessionId: string;
}

export interface CreditSession {
  credits: number | null;
  lastFetch: number;
  sessionId: string;
}

// Session storage keys
export const SESSION_KEYS = {
  ONBOARDING_STATUS: "contentbot-onboarding-session",
  PROJECTS_INITIALIZED: "contentbot-projects-session",
  CREDITS_INITIALIZED: "contentbot-credits-session",
  SESSION_ID: "contentbot-session-id",
} as const;

// Shared API response wrapper - used across all API routes
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Reddit Task Types
export interface RedditTask {
  id: number;
  projectId: number;
  userId: string;
  scheduledDate: Date;
  taskOrder: number;
  taskType: 'comment' | 'post';
  subreddit: string;
  searchKeywords: string | null;
  prompt: string;
  aiDraft: string | null;
  status: 'pending' | 'completed' | 'skipped';
  redditUrl: string | null;
  completedAt: Date | null;
  karmaEarned: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface WeeklyTasksResponse {
  success: boolean;
  weekStartDate: string;
  weekEndDate: string;
  tasks: Record<string, RedditTask[]>; // Grouped by day (YYYY-MM-DD format)
  statistics: {
    totalTasks: number;
    completedTasks: number;
    skippedTasks: number;
    pendingTasks: number;
    completionRate: number;
  };
}

export interface RedditSettings {
  tasksPerDay: number;
  commentRatio: number;
  targetSubreddits: string[];
  expertiseTopics: string[];
  autoGenerateWeekly: boolean;
  lastGeneratedDate?: string;
}

// Dashboard overview types
export interface ArticleMetrics {
  totalThisMonth: number;
  totalPublishedAllTime: number;
  plannedThisWeek: number;
  publishedThisWeek: number;
  publishedLastWeek: number;
  workflowCounts: {
    planning: number;
    generating: number;
    publishing: number;
  };
  recentActivity: Array<{
    id: string;
    title: string;
    action: 'created' | 'generated' | 'published';
    timestamp: string;
  }>;
  credits: {
    balance: number;
    usedThisMonth: number;
  };
}

export interface RedditMetrics {
  weeklyStats: {
    totalTasks: number;
    completedTasks: number;
    completionRate: number;
    karmaEarned: number;
  };
  todaysPendingTasks: number;
  upcomingTasks: Array<{
    id: number;
    title: string;
    subreddit: string;
    scheduledDate: string;
  }>;
}

export interface DashboardStatsResponse {
  articles: ArticleMetrics;
  reddit: {
    connected: boolean;
    data: RedditMetrics | null;
  };
}

export interface DashboardState {
  data: DashboardStatsResponse | null;
  loading: boolean;
  error: string | null;
}
