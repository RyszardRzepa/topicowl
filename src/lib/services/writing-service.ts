import { anthropic } from '@ai-sdk/anthropic';
import { generateObject } from 'ai';
import { prompts } from '@/lib/prompts';
import { MODELS } from '@/constants';
import { db } from '@/server/db';
import { articleSettings } from '@/server/db/schema';
import { getBlogSlugs, getRelatedPosts } from '@/lib/sitemap';
import { z } from 'zod';

export interface WriteRequest {
  researchData: string;
  title: string;
  keywords: string[];
  author?: string;
  publicationName?: string;
}

export const blogPostSchema = z.object({
  id: z.string().describe("A unique ID for the blog post"),
  title: z.string().describe("The title of the blog post"),
  slug: z.string().describe("A URL-friendly version of the title"),
  excerpt: z.string().describe("A short, compelling summary (1-2 sentences)"),
  metaDescription: z.string().describe("An SEO-friendly description. Max 160 char"),
  readingTime: z.string().describe("Estimated reading time, e.g., '5 min read'"),
  content: z.string().describe("The full article content in Markdown format"),
  author: z.string().default('by Oslo Explore staff').describe("The author"),
  date: z.string().describe("The publication date"),
  coverImage: z.string().optional().describe("Placeholder URL for cover image"),
  imageCaption: z.string().optional().describe("Placeholder caption"),
  tags: z.array(z.string()).optional().describe("Array of relevant keywords"),
  relatedPosts: z.array(z.string()).optional().describe("Array of related post slugs"),
});

export type BlogPost = z.infer<typeof blogPostSchema>;

interface CachedSettings {
  toneOfVoice: string;
  articleStructure: string;
  maxWords: number;
  timestamp: number;
}

export class WritingService {
  private settingsCache: CachedSettings | null = null;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  private async getArticleSettings(): Promise<CachedSettings> {
    // Check if we have valid cached settings
    if (this.settingsCache && 
        Date.now() - this.settingsCache.timestamp < this.CACHE_DURATION) {
      return this.settingsCache;
    }

    try {
      const settings = await db.select().from(articleSettings).limit(1);
      const settingsData = settings.length > 0 ? {
        toneOfVoice: settings[0]!.toneOfVoice ?? 'professional',
        articleStructure: settings[0]!.articleStructure ?? 'introduction-body-conclusion',
        maxWords: settings[0]!.maxWords ?? 800,
        timestamp: Date.now(),
      } : {
        toneOfVoice: 'professional',
        articleStructure: 'introduction-body-conclusion',
        maxWords: 800,
        timestamp: Date.now(),
      };

      // Cache the settings
      this.settingsCache = settingsData;
      return settingsData;
    } catch (error) {
      console.warn('Failed to fetch article settings, using defaults:', error);
      const defaultSettings = {
        toneOfVoice: 'professional',
        articleStructure: 'introduction-body-conclusion',
        maxWords: 800,
        timestamp: Date.now(),
      };
      
      this.settingsCache = defaultSettings;
      return defaultSettings;
    }
  }

  clearSettingsCache(): void {
    this.settingsCache = null;
  }
  async writeArticle(request: WriteRequest): Promise<BlogPost> {
    if (!request.researchData || !request.title || !request.keywords || request.keywords.length === 0) {
      throw new Error('Research data, title, and keywords are required');
    }

    // Fetch article settings with caching
    const settingsData = await this.getArticleSettings();

    // Fetch available blog slugs for related posts
    const availableBlogSlugs = await getBlogSlugs();
    const suggestedRelatedPosts = getRelatedPosts(
      availableBlogSlugs, 
      request.keywords,
      undefined,
      3
    );

    const { object: articleObject } = await generateObject({
      model: anthropic(MODELS.CLAUDE_SONET_4),
      schema: blogPostSchema,
      prompt: prompts.writing(request, settingsData, suggestedRelatedPosts),
    });

    return articleObject;
  }
}

export const writingService = new WritingService();