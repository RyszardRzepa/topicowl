// Domain types for shared business entities
// API-specific request/response types are colocated with their routes

// Article types - core domain entity
export interface Article {
  id: string;
  title: string;
  content?: string;
  status: 'idea' | 'to_generate' | 'generating' | 'wait_for_publish' | 'published';
  keywords?: string[];
  targetWordCount?: number;
  publishDate?: string;
  createdAt: string;
  updatedAt: string;
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
