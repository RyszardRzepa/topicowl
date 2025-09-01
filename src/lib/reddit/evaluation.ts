import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";
import { MODELS } from "@/constants";
import type { RedditPost } from "./api";

// Evaluation result schema
export const EvaluationResultSchema = z.object({
  relevanceScore: z.number().min(0).max(10),
  engagementPotential: z.number().min(0).max(10),
  brandAlignment: z.number().min(0).max(10),
  overallScore: z.number().min(0).max(10),
  shouldReply: z.boolean(),
  reasoning: z.string(),
  suggestedApproach: z.string().optional(),
});

export type EvaluationResult = z.infer<typeof EvaluationResultSchema>;

// Project context interface for evaluation
export interface ProjectContext {
  companyName: string;
  domain: string;
  productDescription: string;
  toneOfVoice: string;
  keywords: string[];
}

// Evaluation configuration interface
export interface EvaluationConfig {
  minScore?: number;
  batchSize?: number;
  temperature?: number;
  model?: string;
}

// Individual post evaluation result
export interface PostEvaluationResult {
  post: RedditPost;
  evaluation: EvaluationResult;
  score: number;
  shouldReply: boolean;
  reasoning: string;
}

// Batch evaluation result
export interface BatchEvaluationResult {
  results: PostEvaluationResult[];
  totalEvaluated: number;
  errors: Array<{
    postId: string;
    error: string;
  }>;
  statistics: {
    averageScore: number;
    recommendedCount: number;
    highScoreCount: number; // score >= 8
    mediumScoreCount: number; // score 5-7
    lowScoreCount: number; // score < 5
  };
}

/**
 * Generates a consistent evaluation prompt for Reddit posts
 */
export function generateEvaluationPrompt(projectContext: ProjectContext): string {
  return `You are an expert Reddit engagement specialist evaluating posts for business relevance and content safety.

CONTEXT:
Company: ${projectContext.companyName}
Website: ${projectContext.domain}
Product/Service: ${projectContext.productDescription}
Brand Voice: ${projectContext.toneOfVoice}
Target Keywords: ${projectContext.keywords.join(", ")}

EVALUATION CRITERIA:
1. Relevance Score (0-10): How closely does the post relate to our business domain?
2. Engagement Potential (0-10): How likely is meaningful discussion?
3. Brand Alignment (0-10): Does engaging fit our brand values and voice?
4. Overall Score (0-10): Weighted recommendation score

CONTENT SAFETY RULES:
- AUTOMATICALLY score 0 and set shouldReply=false for posts containing:
  * NSFW, adult, or explicit content
  * Hate speech, discrimination, or offensive language
  * Political controversies or divisive topics
  * Spam, self-promotion, or low-quality content
  * Personal attacks, harassment, or toxic behavior
  * Illegal activities or harmful advice
- Avoid posts that could lead to content policy violations

GUIDELINES:
- Score 8-10: Highly relevant, safe, clear opportunity to add value
- Score 5-7: Moderately relevant, proceed with caution
- Score 0-4: Low relevance, unsafe content, or high risk - avoid engagement
- Consider subreddit rules and community culture
- Only engage with constructive, professional discussions
- Focus on being helpful and adding genuine value without controversy`;
}

/**
 * Evaluates multiple Reddit posts for relevance and engagement potential
 */
export async function evaluatePostsForRelevance(
  posts: RedditPost[],
  projectContext: ProjectContext,
  config: EvaluationConfig = {}
): Promise<BatchEvaluationResult> {
  const {
    batchSize = 50,
    temperature = 0.3,
    model = MODELS.GEMINI_2_5_FLASH,
  } = config;

  const results: PostEvaluationResult[] = [];
  const errors: Array<{ postId: string; error: string }> = [];

  // Process posts in batches to avoid overwhelming the API
  const batches = [];
  for (let i = 0; i < posts.length; i += batchSize) {
    batches.push(posts.slice(i, i + batchSize));
  }

  const systemPrompt = generateEvaluationPrompt(projectContext);

  for (const batch of batches) {
    // Process each post in the batch individually for better error handling
    const batchPromises = batch.map(async (post) => {
      try {
        const userPrompt = `Evaluate this Reddit post for engagement opportunity:

SUBREDDIT: r/${post.subreddit}
POST TITLE: ${post.title}
POST CONTENT: ${post.selftext ?? "[No text content]"}
METRICS: ${post.score} upvotes, ${post.num_comments} comments
AUTHOR: u/${post.author}
AGE: ${Math.floor((Date.now() - post.created_utc * 1000) / (1000 * 60 * 60))} hours old

Provide detailed evaluation with specific reasoning for your scores.`;

        const { object } = await generateObject({
          model: google(model),
          schema: EvaluationResultSchema,
          system: systemPrompt,
          prompt: userPrompt,
          temperature,
        });

        const result: PostEvaluationResult = {
          post,
          evaluation: object,
          score: object.overallScore,
          shouldReply: object.shouldReply,
          reasoning: object.reasoning,
        };

        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        errors.push({
          postId: post.id,
          error: errorMessage,
        });
        console.warn(`Evaluation failed for post ${post.id}:`, error);
        return null;
      }
    });

    // Wait for all posts in the batch to complete
    const batchResults = await Promise.all(batchPromises);
    
    // Add successful results to the main results array
    for (const result of batchResults) {
      if (result !== null) {
        results.push(result);
      }
    }

    // Add small delay between batches to be respectful to the API
    if (batches.indexOf(batch) < batches.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  // Calculate statistics
  const scores = results.map(r => r.score);
  const averageScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  const recommendedCount = results.filter(r => r.shouldReply).length;
  const highScoreCount = results.filter(r => r.score >= 8).length;
  const mediumScoreCount = results.filter(r => r.score >= 5 && r.score < 8).length;
  const lowScoreCount = results.filter(r => r.score < 5).length;

  return {
    results,
    totalEvaluated: results.length,
    errors,
    statistics: {
      averageScore: Math.round(averageScore * 100) / 100,
      recommendedCount,
      highScoreCount,
      mediumScoreCount,
      lowScoreCount,
    },
  };
}