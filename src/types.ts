// Domain types for shared business entities
// API-specific request/response types are colocated with their routes

import { z } from 'zod';

// Blog Post Schema - shared domain entity for article generation
export const blogPostSchema = z.object({
  id: z.string().describe("A unique ID for the blog post. A random number as a string is fine."),
  title: z.string().describe("The title of the blog post."),
  slug: z.string().describe("A URL-friendly version of the title."),
  excerpt: z.string().describe("A short, compelling summary (1-2 sentences)."),
  metaDescription: z.string().describe("An SEO-friendly description for the blog post. Max 160 char."),
  readingTime: z.string().describe("An estimated reading time, e.g., '5 min read'."),
  content: z.string().describe("The full article content in Markdown format."),
  author: z.string().default('by Oslo Explore staff').describe("The author of the blog post."),
  date: z.string().describe("The publication date."),
  coverImage: z.string().optional().describe("A placeholder URL for the cover image."),
  imageCaption: z.string().optional().describe("A placeholder caption for the cover image."),
  tags: z.array(z.string()).optional().describe("An array of relevant keywords."),
  relatedPosts: z.array(z.string()).optional().describe("An array of related post slugs."),
});

export type BlogPost = z.infer<typeof blogPostSchema>;

// Article status type - shared domain type
export type ArticleStatus = 'idea' | 'to_generate' | 'generating' | 'wait_for_publish' | 'published';

// Workflow phases for new UI
export type WorkflowPhase = 'planning' | 'publishing';

// Enhanced article status for workflow organization
export interface ArticleWorkflowStatus {
  status: ArticleStatus;
  phase: WorkflowPhase;
  isScheduled: boolean;
  isActive: boolean; // currently being processed
}

// Article types - core domain entity
export interface Article {
  id: string;
  title: string;
  content?: string;
  status: ArticleStatus;
  keywords?: string[];
  targetWordCount?: number;
  publishDate?: string;
  createdAt: string;
  updatedAt: string;
  
  // Enhanced fields for new workflow
  generationProgress?: number; // 0-100 percentage
  estimatedReadTime?: number; // in minutes
  views?: number;
  clicks?: number;
  
  // Generation scheduling
  generationScheduledAt?: string;
  generationStartedAt?: string;
  generationCompletedAt?: string;
  
  // Publishing scheduling
  publishScheduledAt?: string;
  publishedAt?: string;
}

// Settings types - domain entity for application configuration
export interface ArticleSettings {
  id: string;
  name: string;
  defaultWordCount: number;
  tone: 'professional' | 'casual' | 'authoritative' | 'friendly';
  keywords: string[];
  competitorUrls: string[];
  publishingSchedule?: {
    frequency: 'daily' | 'weekly' | 'monthly';
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

// Shared API response wrapper - used across all API routes
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
