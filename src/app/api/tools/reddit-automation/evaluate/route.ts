import { auth } from "@clerk/nextjs/server";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { projects } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { google } from "@ai-sdk/google";
import { generateObject } from "ai";

interface EvaluationResult {
  postId: string;
  score: number;
  reasoning: string;
  shouldReply: boolean;
}

// Add evaluation result schema for structured output
const EvaluationResultSchema = z.object({
  relevanceScore: z.number().min(0).max(10),
  engagementPotential: z.number().min(0).max(10),
  brandAlignment: z.number().min(0).max(10),
  overallScore: z.number().min(0).max(10),
  shouldReply: z.boolean(),
  reasoning: z.string(),
  suggestedApproach: z.string().optional(),
});

const EvaluateRequestSchema = z.object({
  projectId: z.number(),
  posts: z.array(
    z.object({
      id: z.string(),
      subreddit: z.string(),
      title: z.string(),
      selftext: z.string(),
      author: z.string(),
      score: z.number(),
      created_utc: z.number(),
      num_comments: z.number(),
      url: z.string(),
      permalink: z.string(),
    }),
  ),
});

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { projectId, posts } = EvaluateRequestSchema.parse(
      await request.json(),
    );

    // Verify user exists in database
    const [userRecord] = await db
      .select({ id: projects.userId })
      .from(projects)
      .where(eq(projects.userId, userId))
      .limit(1);

    if (!userRecord) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Verify project ownership
    const [projectRecord] = await db
      .select({
        id: projects.id,
        companyName: projects.companyName,
        productDescription: projects.productDescription,
        keywords: projects.keywords,
        toneOfVoice: projects.toneOfVoice,
        domain: projects.domain,
      })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, userId)));

    if (!projectRecord) {
      return NextResponse.json(
        { error: "Project not found or access denied" },
        { status: 404 },
      );
    }

    // Optimized Gemini prompt following best practices
    const systemPrompt = `You are an expert Reddit engagement specialist evaluating posts for business relevance.

CONTEXT:
Company: ${projectRecord.companyName ?? "Unknown"}
Website: ${projectRecord.domain ?? ""}
Product/Service: ${projectRecord.productDescription ?? ""}
Brand Voice: ${projectRecord.toneOfVoice ?? "professional and helpful"}
Target Keywords: ${((projectRecord.keywords as string[]) ?? []).join(", ")}

EVALUATION CRITERIA:
1. Relevance Score (0-10): How closely does the post relate to our business domain?
2. Engagement Potential (0-10): How likely is meaningful discussion?
3. Brand Alignment (0-10): Does engaging fit our brand values and voice?
4. Overall Score (0-10): Weighted recommendation score

GUIDELINES:
- Score 8-10: Highly relevant, clear opportunity to add value
- Score 5-7: Moderately relevant, proceed with caution
- Score 0-4: Low relevance or high risk, avoid engagement
- Consider subreddit rules and community culture
- Avoid promotional language or spam patterns
- Focus on being helpful and adding genuine value`;

    // Process each post for evaluation
    const results: EvaluationResult[] = [];

    for (const post of posts) {
      try {
        const userPrompt = `Evaluate this Reddit post for engagement opportunity:

SUBREDDIT: r/${post.subreddit}
POST TITLE: ${post.title}
POST CONTENT: ${post.selftext || "[No text content]"}
METRICS: ${post.score} upvotes, ${post.num_comments} comments
AUTHOR: u/${post.author}
AGE: ${Math.floor((Date.now() - post.created_utc * 1000) / (1000 * 60 * 60))} hours old

Provide detailed evaluation with specific reasoning for your scores.`;

        const { object } = await generateObject({
          model: google("gemini-1.5-flash"),
          schema: EvaluationResultSchema,
          system: systemPrompt,
          prompt: userPrompt,
          temperature: 0.3, // Lower temperature for consistent evaluation
        });

        results.push({
          postId: post.id,
          score: object.overallScore,
          reasoning: object.reasoning,
          shouldReply: object.shouldReply,
        });
      } catch (error) {
        console.error(`Error evaluating post ${post.id}:`, error);
        results.push({
          postId: post.id,
          score: 0,
          reasoning: "Error during AI evaluation",
          shouldReply: false,
        });
      }
    }

    return NextResponse.json({
      success: true,
      results,
    });
  } catch (error) {
    console.error("Evaluate posts error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input data", details: error.errors },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
