import { anthropic } from '@ai-sdk/anthropic';
import { generateObject } from 'ai';
import { NextResponse } from 'next/server';
import { prompts } from '@/lib/prompts';
import { MODELS } from '@/constants';
import { db } from '@/server/db';
import { articleSettings } from '@/server/db/schema';
import { getBlogSlugs, getRelatedPosts } from '@/lib/sitemap';
import z from 'zod';

interface WriteRequest {
  researchData: string;
  title: string;
  keywords: string[];
  author?: string;
  publicationName?: string;
}

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


export async function POST(request: Request) {
  try {
    const body = await request.json() as WriteRequest;
    
    if (!body.researchData || !body.title || !body.keywords || body.keywords.length === 0) {
      return NextResponse.json(
        { error: 'Research data, title, and keywords are required' },
        { status: 400 }
      );
    }

    // Fetch article settings
    let settingsData;
    try {
      const settings = await db.select().from(articleSettings).limit(1);
      settingsData = settings.length > 0 ? {
        toneOfVoice: settings[0]!.toneOfVoice ?? '',
        articleStructure: settings[0]!.articleStructure ?? '',
        maxWords: settings[0]!.maxWords ?? 800, // Provide default if column doesn't exist
      } : {
        toneOfVoice: '',
        articleStructure: '',
        maxWords: 800,
      };
    } catch (error) {
      // If there's an error (like missing column), use defaults
      console.warn('Using default article settings due to database error:', error);
      settingsData = {
        toneOfVoice: '',
        articleStructure: '',
        maxWords: 800,
      };
    }

    // Fetch available blog slugs for related posts
    const availableBlogSlugs = await getBlogSlugs();
    
    // Get suggested related posts based on keywords
    const suggestedRelatedPosts = getRelatedPosts(
      availableBlogSlugs, 
      body.keywords,
      undefined, // No current slug to exclude
      3 // Max 3 related posts
    );

    const { object: articleObject } = await generateObject({
      model: anthropic(MODELS.CLAUDE_SONET_4),
      schema: blogPostSchema,
      prompt: prompts.writing(body, settingsData, suggestedRelatedPosts),
    });

    return NextResponse.json(articleObject);
  } catch (error) {
    console.error('Write endpoint error:', error);
    return NextResponse.json(
      { error: 'Failed to write article' },
      { status: 500 }
    );
  }
}
