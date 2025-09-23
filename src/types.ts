// Domain types for shared business entities
// API-specific request/response types are colocated with their routes

import { z } from "zod";
import type { projects } from "@/server/db/schema";
import type {
  articleStatusEnum,
  articleGenerationStatusEnum,
} from "@/server/db/schema";

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

export interface ResearchArtifact {
  researchData?: string;
  sources?: Array<{ url: string; title?: string }>;
  videos?: Array<{ title: string; url: string; reason?: string }>;
  internalLinks?: string[];
}

export interface ValidationArtifact {
  isValid?: boolean;
  issues?: Array<{ fact: string; issue: string; correction: string }>;
  rawValidationText?: string;
  seoScore?: number;
  runLabel?: "initial" | "post-update";
}

export interface WriteArtifact {
  prompt?: string;
  content?: string;
  relatedPosts?: string[];
  tags?: string[];
  slug?: string;
  metaDescription?: string;
  introParagraph?: string;
  factCheckReport?: string;
  internalLinks?: string[];
}

export interface CoverImageArtifact {
  imageId?: string;
  imageUrl?: string;
  altText?: string;
  attribution?: {
    photographer?: string;
    sourceUrl?: string;
    downloadUrl?: string;
    [key: string]: string | undefined;
  };
  query?: string;
  keywords?: string[];
}

export interface GenerationArtifactErrors {
  research_error?: { error: string; timestamp: string; details?: string };
  write_error?: { error: string; timestamp: string; details?: string };
  validation_error?: { error: string; timestamp: string; details?: string };
  [key: string]: unknown;
}

export type QualityControlCategory =
  | "seo"
  | "writing"
  | "structure"
  | "requirements";

export type QualityControlSeverity = "critical" | "high" | "medium" | "low";

export interface QualityControlIssue {
  id: string;
  category: QualityControlCategory;
  severity: QualityControlSeverity;
  summary: string;
  location?: string;
  requiredFix: string;
}

export interface QualityControlCategoryResult {
  category: QualityControlCategory;
  status: "pass" | "fail";
  issues: QualityControlIssue[];
}

export interface ArticleGenerationArtifacts extends GenerationArtifactErrors {
  research_run_id?: string;
  research?: ResearchArtifact;
  validation?: ValidationArtifact;
  write?: WriteArtifact;
  coverImage?: CoverImageArtifact;
  qualityControl?: {
    report?: string;
    issues?: QualityControlIssue[];
    categories?: QualityControlCategoryResult[];
    isValid?: boolean;
    completedAt?: string;
    runLabel?: "initial" | "post-update";
    runCount?: number;
  };
  errors?: GenerationArtifactErrors;
  [key: string]: unknown;
}

export type SectionType =
  | "title"
  | "intro"
  | "tldr"
  | "section"
  | "video"
  | "table"
  | "faq";

export interface StructureSection {
  id: string;
  type: SectionType;
  label?: string;
  required?: boolean;
  enabled?: boolean;
  minWords?: number;
  minItems?: number;
  maxItems?: number;
}

export interface StructureTemplate {
  version: number;
  sections: StructureSection[];
}

export type EffectiveOutline = StructureTemplate;

export interface SeoChecklist {
  structure: {
    singleH1: boolean;
    h2CountOk: boolean;
    hasTldr: boolean;
    hasFaq: boolean;
    tldrCountOk?: boolean;
    sectionMinWordsOk?: boolean;
    faqItemsCountOk?: boolean;
  };
  links: { internalMin: boolean; externalMin: boolean; brokenExternalLinks: number };
  citations: { citedSourcesMin: boolean };
  quotes: { hasExpertQuote: boolean };
  stats: { hasTwoDataPoints: boolean };
  images: { allHaveAlt: boolean; requiredWhenLinks?: boolean; maxThree?: boolean; spreadOut?: boolean };
  keywords: { h1HasPrimary: boolean };
  meta: { metaDescriptionOk: boolean; slugPresent: boolean };
  jsonLd: { blogPosting: boolean; faqPage: boolean };
  templateCompliance?: {
    isCompliant: boolean;
    score: number;
    violations: number;
  };
}

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
export type ArticleGenerationStatus =
  (typeof articleGenerationStatusEnum.enumValues)[number];

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
  generationPhase?:
    | "research"
    | "writing"
    | "quality-control"
    | "validation"
    | "optimization";
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

// ArticleSettings interface removed - settings are now stored directly in projects table
// This eliminates duplication and provides a single source of truth for project settings

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

// Multi-Agent Article Generation Types

export interface WordTarget {
  min: number;
  max: number;
  target?: number;
}

export interface ContentRule {
  description: string;
  priority: 'high' | 'medium' | 'low';
}

export interface ValidationCriteria {
  description: string;
  type: 'content' | 'format' | 'compliance';
}

export interface EnhancedSectionSpec {
  id: string;
  type: SectionType;
  label: string;
  required: boolean;
  wordTarget: WordTarget;
  contentRules: ContentRule[];
  validationCriteria: ValidationCriteria[];
  talkingPoints: string[];
  researchCitations: string[];
  keywordTargets: string[];
  examples?: string[];
  assignedScreenshots?: Array<{ url: string; title?: string; reason: string; placement: 'start' | 'middle' | 'end' }>; // Section-specific screenshots
}

// Enhanced multi-agent system interfaces
export interface DetailedOutline {
  title: string;
  totalWordTarget: number;
  sections: EnhancedSectionSpec[];
  keywords: string[];
  researchSummary: string;
  contentStrategy: string;
  sources?: Array<{ url: string; title?: string }>; // Add sources for linking
  priorityScreenshots?: Array<{ url: string; title?: string; reason: string }>; // Strategic screenshots
}

export interface NarrativeContext {
  storyArc: {
    currentPosition: number; // Which section we're on (1-based)
    totalSections: number;
    phase: 'introduction' | 'development' | 'climax' | 'conclusion';
  };
  introducedConcepts: string[]; // Concepts already covered
  keyThemes: string[]; // Main themes to maintain
  narrativeThread: string; // The connecting story/argument
  pendingTransitions: {
    fromPreviousSection: string;
    toNextSection?: string;
  };
  contentCoverage: {
    topicsCovered: string[];
    statisticsUsed: string[];
    examplesGiven: string[];
  };
}

export interface ArticleContext {
  title: string;
  keywords: string[];
  toneOfVoice?: string;
  targetAudience?: string;
  existingSections: SectionResult[];
  projectSettings?: {
    toneOfVoice?: string;
    articleStructure?: string;
    maxWords?: number;
    languageCode?: string;
  };
}

export interface SectionResult {
  sectionId: string;
  heading: string;
  content: string;
  wordCount: number;
  qualityScore: number;
  citationsUsed: string[];
  keywordsUsed: string[];
  wasRewritten: boolean;
  rewriteAttempts: number;
  complianceIssues: string[];
  metadata: {
    generatedAt: string;
    processingTimeMs: number;
    modelUsed: string;
  };
}

export interface CritiqueResult {
  approved: boolean;
  overallScore: number;
  feedback: {
    contentCompleteness: {
      score: number;
      issues: string[];
      suggestions: string[];
    };
    structuralCompliance: {
      score: number;
      issues: string[];
      suggestions: string[];
    };
    qualityStandards: {
      score: number;
      issues: string[];
      suggestions: string[];
    };
  };
  actionableSteps: string[];
  criticalIssues: string[];
  approvable: boolean;
}

export interface QualityRubric {
  contentCompleteness: {
    weight: number;
    criteria: {
      keyPointsCovered: number;
      statisticsCited: number;
      depthAppropriate: number;
    };
  };
  structuralCompliance: {
    weight: number;
    criteria: {
      wordCountMet: number;
      headingFormatted: number;
      logicalFlow: number;
    };
  };
  qualityStandards: {
    weight: number;
    criteria: {
      toneConsistent: number;
      examplesConcrete: number;
      languageClear: number;
      engagementLevel: number;
    };
  };
}

export interface ComplianceResult {
  compliant: boolean;
  score: number;
  violations: TemplateViolation[];
  passedChecks: string[];
  recommendations: string[];
}

export interface TemplateViolation {
  sectionId: string;
  violationType: 'missing' | 'incomplete' | 'format' | 'word_count';
  severity: 'critical' | 'major' | 'minor';
  description: string;
  suggestion: string;
  expectedValue?: string | number;
  actualValue?: string | number;
}

export interface QualityMetrics {
  sectionsGenerated: number;
  sectionsRewritten: number;
  complianceScore: number;
  avgSectionQuality: number;
  totalProcessingTimeMs: number;
  modelTokensUsed: number;
  criticalIssuesFound: number;
  userSatisfactionPrediction: number;
}

export interface AssemblyResult {
  content: string;
  transitionsAdded: number;
  formattingFixesApplied: number;
  finalWordCount: number;
  sectionsAssembled: number;
  qualityChecks: {
    markdownValidation: boolean;
    headingHierarchy: boolean;
    linkIntegrity: boolean;
    imageFormatting: boolean;
  };
}