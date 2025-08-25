import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { projects } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

// Types
interface RedditPost {
  id: string;
  subreddit: string;
  title: string;
  selftext: string;
  author: string;
  score: number;
  created_utc: number;
  num_comments: number;
  url: string;
  permalink: string;
}

interface EvaluationResult {
  postId: string;
  score: number;
  reasoning: string;
  shouldReply: boolean;
}

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
  evaluationPrompt: z.string().optional(),
  variables: z.record(z.string()).optional().default({}),
});

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { projectId, posts, evaluationPrompt, variables } =
      EvaluateRequestSchema.parse(body);

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
      })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, userId)));

    if (!projectRecord) {
      return NextResponse.json(
        { error: "Project not found or access denied" },
        { status: 404 },
      );
    }

    // Default evaluation prompt
    const defaultPrompt = `
You are an expert at evaluating Reddit posts for business relevance and engagement potential.

Company: ${projectRecord.companyName ?? ""}
Product/Service: ${projectRecord.productDescription ?? ""}

For each Reddit post, evaluate:
1. Relevance to our business (0-10)
2. Engagement potential (0-10) 
3. Appropriateness for our brand to reply (0-10)
4. Overall recommendation to reply (true/false)

Consider factors like:
- Post topic alignment with our business
- Community size and engagement
- Post tone and quality
- Opportunity for helpful, non-spammy contribution
- Subreddit rules and culture

Return JSON format:
{
  "score": number (0-10 overall score),
  "reasoning": "detailed explanation",
  "shouldReply": boolean
}
    `.trim();

    const prompt = evaluationPrompt ?? defaultPrompt;

    // Process each post for evaluation
    const results: EvaluationResult[] = [];

    for (const post of posts) {
      try {
        // Replace variables in prompt
        let processedPrompt = prompt;
        Object.entries(variables).forEach(([key, value]) => {
          processedPrompt = processedPrompt.replace(
            new RegExp(`\\{\\{${key}\\}\\}`, 'g'),
            value,
          );
        });

        // Add post context to prompt
        const fullPrompt = `${processedPrompt}

POST TO EVALUATE:
Title: ${post.title}
Content: ${post.selftext}
Subreddit: r/${post.subreddit}
Score: ${post.score}
Comments: ${post.num_comments}
Author: ${post.author}

Provide your evaluation in JSON format.`;

        // Here you would call your AI service (Gemini, Claude, etc.)
        // For now, providing a mock implementation
        const mockEvaluation = {
          score: Math.random() * 10,
          reasoning: `Evaluated post "${post.title}" in r/${post.subreddit}. Mock evaluation result.`,
          shouldReply: Math.random() > 0.5,
        };

        results.push({
          postId: post.id,
          ...mockEvaluation,
        });
      } catch (error) {
        console.error(`Error evaluating post ${post.id}:`, error);
        results.push({
          postId: post.id,
          score: 0,
          reasoning: "Error during evaluation",
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