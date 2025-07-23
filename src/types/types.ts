// Shared types for API requests and responses
// Import these types in both API routes and client-side code for full type safety

// Article types
export interface Article {
  id: string;
  title: string;
  content?: string;
  status: 'idea' | 'to-generate' | 'generating' | 'wait-for-publish' | 'published';
  keywords?: string[];
  targetWordCount?: number;
  publishDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateArticleRequest {
  title: string;
  keywords?: string[];
  targetWordCount?: number;
  publishDate?: string;
}

export interface UpdateArticleRequest {
  title?: string;
  content?: string;
  status?: Article['status'];
  keywords?: string[];
  targetWordCount?: number;
  publishDate?: string;
}

export interface ArticleGenerationRequest {
  articleId: string;
  forceRegenerate?: boolean;
}

// Kanban board types
export interface KanbanColumn {
  id: string;
  title: string;
  articles: Article[];
}

export interface KanbanBoard {
  columns: KanbanColumn[];
}

export interface MoveArticleRequest {
  articleId: string;
  fromStatus: Article['status'];
  toStatus: Article['status'];
  position?: number;
}

// AI SEO Writer types
export interface ResearchRequest {
  topic: string;
  keywords?: string[];
  competitors?: string[];
}

export interface ResearchResponse {
  keywordData: {
    keyword: string;
    searchVolume: number;
    difficulty: number;
    relatedKeywords: string[];
  }[];
  competitorAnalysis: {
    url: string;
    title: string;
    wordCount: number;
    keyTopics: string[];
  }[];
  contentGaps: string[];
  recommendedTopics: string[];
}

export interface WriteRequest {
  topic: string;
  keywords: string[];
  targetWordCount: number;
  researchData?: ResearchResponse;
  tone?: 'professional' | 'casual' | 'authoritative' | 'friendly';
}

export interface WriteResponse {
  title: string;
  content: string;
  metaDescription: string;
  wordCount: number;
  keywordsUsed: string[];
}

export interface ValidateRequest {
  content: string;
  title: string;
  keywords: string[];
}

export interface ValidateResponse {
  isValid: boolean;
  issues: {
    type: 'factual' | 'seo' | 'readability' | 'grammar';
    severity: 'low' | 'medium' | 'high';
    message: string;
    suggestion?: string;
  }[];
  seoScore: number;
  readabilityScore: number;
}

export interface UpdateRequest {
  content: string;
  issues: ValidateResponse['issues'];
}

export interface UpdateResponse {
  updatedContent: string;
  fixedIssues: string[];
  remainingIssues: ValidateResponse['issues'];
}

export interface ScheduleRequest {
  articleId: string;
  publishDate: string;
  timezone?: string;
}

// Generation status types
export interface GenerationStatus {
  articleId: string;
  status: 'pending' | 'researching' | 'writing' | 'validating' | 'updating' | 'completed' | 'failed';
  progress: number; // 0-100
  currentStep?: string;
  error?: string;
  startedAt?: string;
  completedAt?: string;
}

// Settings types
export interface ArticleSettings {
  id: string;
  name: string;
  defaultWordCount: number;
  tone: WriteRequest['tone'];
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

export interface CreateSettingsRequest {
  name: string;
  defaultWordCount?: number;
  tone?: WriteRequest['tone'];
  keywords?: string[];
  competitorUrls?: string[];
  publishingSchedule?: ArticleSettings['publishingSchedule'];
  seoSettings?: Partial<ArticleSettings['seoSettings']>;
}

export interface UpdateSettingsRequest {
  name?: string;
  defaultWordCount?: number;
  tone?: WriteRequest['tone'];
  keywords?: string[];
  competitorUrls?: string[];
  publishingSchedule?: ArticleSettings['publishingSchedule'];
  seoSettings?: Partial<ArticleSettings['seoSettings']>;
}

// API Response wrappers
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface ApiError {
  success: false;
  error: string;
  message: string;
  code?: string;
}

// Utility types
export type ApiHandler<TRequest = unknown, TResponse = unknown> = (
  request: TRequest
) => Promise<ApiResponse<TResponse>>;

export type Status = Article['status'];
export type Tone = WriteRequest['tone'];
export type Frequency = 'daily' | 'weekly' | 'monthly';
