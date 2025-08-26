import { auth, clerkClient } from "@clerk/nextjs/server";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import {
  redditAutomations,
  redditAutomationRuns,
  projects,
  redditProcessedPosts,
} from "@/server/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { z } from "zod";
import { env } from "@/env";
import type { ClerkPrivateMetadata } from "@/types";
import { google } from "@ai-sdk/google";
import { generateObject, generateText } from "ai";

// Types for workflow execution
interface WorkflowNode {
  id: string;
  type: "trigger" | "search" | "evaluate" | "reply" | "action";
  config: Record<string, unknown>;
  position: { x: number; y: number };
}

interface ExecutionContext {
  posts?: RedditPost[];
  evaluationResults?: EvaluationResult[];
  replies?: ReplyResult[];
  [key: string]: unknown;
}

interface ExecutionResults {
  postsFound: number;
  postsEvaluated: number;
  postsApproved: number;
  repliesGenerated: number;
  duplicatesSkipped: number;
  posts: {
    id: string;
    title: string;
    subreddit: string;
    author: string;
    url: string;
    permalink: string;
    score: number;
    num_comments: number;
    selftext: string;
    evaluation: {
      score: number;
      shouldReply: boolean;
      reasoning: string;
    };
    reply?: {
      content: string;
      generated: boolean;
      error?: string;
    };
  }[];
}

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

interface ReplyResult {
  postId: string;
  replyContent: string;
  success: boolean;
  error?: string;
}

const EvaluationResultSchema = z.object({
  relevanceScore: z.number().min(0).max(10),
  engagementPotential: z.number().min(0).max(10),
  brandAlignment: z.number().min(0).max(10),
  overallScore: z.number().min(0).max(10),
  shouldReply: z.boolean(),
  reasoning: z.string(),
  suggestedApproach: z.string().optional(),
});

interface RedditTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

interface RedditListing {
  data: {
    children: {
      data: RedditPost;
    }[];
  };
}

const ExecuteWorkflowSchema = z.object({
  automationId: z.number().optional(),
  workflow: z
    .array(
      z.object({
        id: z.string(),
        type: z.enum(["trigger", "search", "evaluate", "reply", "action"]),
        config: z.record(z.unknown()),
        position: z.object({
          x: z.number(),
          y: z.number(),
        }),
      }),
    )
    .optional(),
  dryRun: z.boolean().optional().default(false),
  projectId: z.number().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: unknown = await request.json();
    const { automationId, workflow, dryRun, projectId } =
      ExecuteWorkflowSchema.parse(body);

    let workflowToExecute: WorkflowNode[];
    let targetProjectId: number;

    if (automationId) {
      // Execute existing automation
      const [automationResult] = await db
        .select({
          automation: redditAutomations,
          projectId: projects.id,
        })
        .from(redditAutomations)
        .innerJoin(projects, eq(redditAutomations.projectId, projects.id))
        .where(
          and(
            eq(redditAutomations.id, automationId),
            eq(projects.userId, userId),
          ),
        );

      if (!automationResult) {
        return NextResponse.json(
          { error: "Automation not found or access denied" },
          { status: 404 },
        );
      }

      workflowToExecute =
        automationResult.automation.workflow as WorkflowNode[];
      targetProjectId = automationResult.projectId;

      // Create execution run record
      const [executionRun] = await db
        .insert(redditAutomationRuns)
        .values({
          automationId: automationId,
          status: "running",
        })
        .returning();

      if (!executionRun) {
        return NextResponse.json(
          { error: "Failed to create execution run" },
          { status: 500 },
        );
      }

      try {
        // Execute workflow
        const result = await executeWorkflow(workflowToExecute, {
          userId,
          projectId: targetProjectId,
          dryRun,
          runId: executionRun.id,
          automationId: automationId,
        });

        // Update execution run as completed
        await db
          .update(redditAutomationRuns)
          .set({
            status: "completed",
            results: result,
            completedAt: new Date(),
          })
          .where(eq(redditAutomationRuns.id, executionRun.id));

        // Update automation last run timestamp
        await db
          .update(redditAutomations)
          .set({
            lastRunAt: new Date(),
          })
          .where(eq(redditAutomations.id, automationId));

        return NextResponse.json({
          success: true,
          runId: executionRun.id,
          results: result,
        });
      } catch (executionError) {
        // Update execution run as failed
        await db
          .update(redditAutomationRuns)
          .set({
            status: "failed",
            errorMessage:
              executionError instanceof Error
                ? executionError.message
                : "Unknown error",
            completedAt: new Date(),
          })
          .where(eq(redditAutomationRuns.id, executionRun.id));

        throw executionError;
      }
    } else if (workflow && projectId) {
      // Execute workflow directly (test mode)

      // Verify project ownership
      const [projectRecord] = await db
        .select({ id: projects.id })
        .from(projects)
        .where(and(eq(projects.id, projectId), eq(projects.userId, userId)));

      if (!projectRecord) {
        return NextResponse.json(
          { error: "Project not found or access denied" },
          { status: 404 },
        );
      }

      workflowToExecute = workflow;
      targetProjectId = projectId;

      // Execute workflow directly
      const result = await executeWorkflow(workflowToExecute, {
        userId,
        projectId: targetProjectId,
        dryRun,
      });

      return NextResponse.json({
        success: true,
        results: result,
      });
    } else {
      return NextResponse.json(
        { error: "Either automationId or workflow + projectId is required" },
        { status: 400 },
      );
    }
  } catch (error) {
    console.error("Execute workflow error:", error);
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

async function executeWorkflow(
  workflow: WorkflowNode[],
  context: {
    userId: string;
    projectId: number;
    dryRun: boolean;
    runId?: number;
    automationId?: number;
  },
): Promise<ExecutionResults> {
  const executionContext: ExecutionContext = {};

  // Sort nodes by execution order (basic implementation - in real app would need proper topological sort)
  const sortedNodes = [...workflow].sort((a, b) => {
    const typeOrder = {
      trigger: 0,
      search: 1,
      evaluate: 2,
      reply: 3,
      action: 4,
    };
    return typeOrder[a.type] - typeOrder[b.type];
  });

  for (const node of sortedNodes) {
    switch (node.type) {
      case "search":
        executionContext.posts = await executeSearchNode(node, context);
        break;
      case "evaluate":
        if (executionContext.posts) {
          executionContext.evaluationResults = await executeEvaluationNode(
            node,
            executionContext.posts,
            context,
          );
        }
        break;
      case "reply":
        if (executionContext.posts && executionContext.evaluationResults) {
          executionContext.replies = await executeReplyNode(
            node,
            executionContext.posts,
            executionContext.evaluationResults,
            context,
          );
        }
        break;
      case "action":
        // Handle action nodes (save results, webhook, etc.)
        break;
    }
  }

  if (
    !context.dryRun &&
    executionContext.posts &&
    executionContext.evaluationResults
  ) {
    const posts = executionContext.posts;
    const evaluationResults = executionContext.evaluationResults;
    const replies = executionContext.replies ?? [];

    const processedPostsData = posts.map((post) => {
      const evaluation = evaluationResults.find((e) => e.postId === post.id);
      const reply = replies.find((r) => r.postId === post.id);

      return {
        projectId: context.projectId,
        postId: post.id,
        subreddit: post.subreddit,
        postTitle: post.title,
        postUrl: `https://reddit.com${post.permalink}`,
        evaluationScore: evaluation ? Math.round(evaluation.score * 10) : null,
        wasApproved: evaluation?.shouldReply ?? false,
        evaluationReasoning: evaluation?.reasoning,
        replyContent: reply?.replyContent,
        replyPosted: false, // This will be updated when actually posted
        automationId: context.automationId,
        runId: context.runId,
      };
    });
    if (processedPostsData.length > 0) {
      await db
        .insert(redditProcessedPosts)
        .values(processedPostsData)
        .onConflictDoNothing({
          target: [redditProcessedPosts.projectId, redditProcessedPosts.postId],
        });
    }
  }

  const posts = executionContext.posts ?? [];
  const evaluationResults = executionContext.evaluationResults ?? [];
  const replies = executionContext.replies ?? [];

  const structuredResults: ExecutionResults = {
    postsFound: posts.length,
    postsEvaluated: evaluationResults.length,
    postsApproved: evaluationResults.filter((e) => e.shouldReply).length,
    repliesGenerated: replies.filter((r) => r.success).length,
    duplicatesSkipped: 0,
    posts: posts.map((post) => {
      const evaluation = evaluationResults.find((e) => e.postId === post.id);
      const reply = replies.find((r) => r.postId === post.id);

      return {
        id: post.id,
        title: post.title,
        subreddit: post.subreddit,
        author: post.author,
        url: post.url,
        permalink: `https://reddit.com${post.permalink}`,
        score: post.score,
        num_comments: post.num_comments,
        selftext: post.selftext,
        evaluation: evaluation
          ? {
              score: evaluation.score,
              shouldReply: evaluation.shouldReply,
              reasoning: evaluation.reasoning,
            }
          : {
              score: 0,
              shouldReply: false,
              reasoning: "Not evaluated",
            },
        reply: reply
          ? {
              content: reply.replyContent,
              generated: reply.success,
              error: reply.error,
            }
          : undefined,
      };
    }),
  };

  return structuredResults;
}

async function executeSearchNode(
  node: WorkflowNode,
  context: { userId: string; projectId: number },
): Promise<RedditPost[]> {
  const config = node.config as {
    subreddit: string;
    keywords: string[];
    timeRange: "24h" | "7d" | "30d";
    maxResults: number;
  };

  // Get Reddit access token for the project
  const clerk = await clerkClient();
  const user = await clerk.users.getUser(context.userId);
  const metadata = (user.privateMetadata ?? {}) as ClerkPrivateMetadata;
  const projectConnection =
    metadata.redditTokens?.[context.projectId.toString()];

  if (!projectConnection) {
    throw new Error("Reddit account not connected for this project");
  }

  // Exchange refresh token for access token
  const tokenResponse = await fetch(
    "https://www.reddit.com/api/v1/access_token",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "Contentbot/1.0",
        Authorization: `Basic ${Buffer.from(
          `${env.REDDIT_CLIENT_ID}:${env.REDDIT_CLIENT_SECRET}`,
        ).toString("base64")}`,
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: projectConnection.refreshToken,
      }),
    },
  );

  if (!tokenResponse.ok) {
    throw new Error(`Reddit token refresh failed: ${tokenResponse.status}`);
  }

  const tokenData = (await tokenResponse.json()) as RedditTokenResponse;
  const accessToken = tokenData.access_token;

  // Fetch posts from Reddit API (simplified implementation)
  const response = await fetch(
    `https://oauth.reddit.com/r/${config.subreddit}/hot.json?limit=${config.maxResults}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "User-Agent": "Contentbot/1.0",
      },
    },
  );

  if (!response.ok) {
    throw new Error(`Reddit API error: ${response.status}`);
  }

  const data = (await response.json()) as RedditListing;
  const posts: RedditPost[] = data.data.children
    .map((child) => child.data)
    .filter((post) => {
      // Filter by keywords if specified
      if (config.keywords.length > 0) {
        const content = `${post.title} ${post.selftext}`.toLowerCase();
        return config.keywords.some((keyword: string) =>
          content.includes(keyword.toLowerCase()),
        );
      }
      return true;
    });

  if (posts.length > 0) {
    const postIds = posts.map((p) => p.id);
    const processedPosts = await db
      .select({ postId: redditProcessedPosts.postId })
      .from(redditProcessedPosts)
      .where(
        and(
          eq(redditProcessedPosts.projectId, context.projectId),
          inArray(redditProcessedPosts.postId, postIds),
        ),
      );
    const processedPostIds = new Set(processedPosts.map((p) => p.postId));
    const newPosts = posts.filter((post) => !processedPostIds.has(post.id));
    console.log(
      `Found ${posts.length} posts, ${processedPostIds.size} already processed, ${newPosts.length} new posts to evaluate`,
    );
    return newPosts;
  }

  return posts;
}

async function executeEvaluationNode(
  _node: WorkflowNode,
  posts: RedditPost[],
  context: { userId: string; projectId: number },
): Promise<EvaluationResult[]> {
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
    .where(eq(projects.id, context.projectId));

  if (!projectRecord) {
    throw new Error("Project not found for evaluation");
  }

  // Optimized Gemini prompt following best practices
  const systemPrompt = `You are an expert Reddit engagement specialist evaluating posts for business relevance.

CONTEXT:
Company: ${projectRecord.companyName ?? "Unknown"}
Website: ${projectRecord.domain ?? ""}
Product/Service: ${projectRecord.productDescription ?? ""}
Brand Voice: ${projectRecord.toneOfVoice ?? "professional and helpful"}
Target Keywords: ${(projectRecord.keywords as string[] ?? []).join(", ")}

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

  return results;
}

async function executeReplyNode(
  node: WorkflowNode,
  posts: RedditPost[],
  evaluationResults: EvaluationResult[],
  context: { userId: string; projectId: number; dryRun: boolean },
): Promise<ReplyResult[]> {
  // Fetch project context for reply generation
  const [projectRecord] = await db
    .select({
      companyName: projects.companyName,
      productDescription: projects.productDescription,
      toneOfVoice: projects.toneOfVoice,
      domain: projects.domain,
      keywords: projects.keywords,
    })
    .from(projects)
    .where(eq(projects.id, context.projectId));

  if (!projectRecord) {
    throw new Error("Project not found");
  }

  const results: ReplyResult[] = [];

  // Extract reply configuration from node
  const replyConfig = node.config as {
    replyPrompt?: string;
    maxLength?: number;
    includeLinks?: boolean;
  };

  for (const evaluation of evaluationResults) {
    if (evaluation.shouldReply) {
      const post = posts.find((p) => p.id === evaluation.postId);
      if (!post) continue;

      try {
        // Optimized reply generation prompt
        const systemPrompt = `You are a helpful Reddit community member representing ${projectRecord.companyName ?? "our company"}.

IDENTITY:
- Company: ${projectRecord.companyName ?? ""}
- Expertise: ${projectRecord.productDescription ?? ""}
- Tone: ${projectRecord.toneOfVoice ?? "helpful, authentic, and conversational"}
- Website: ${projectRecord.domain ?? ""}

STRICT RULES:
1. NEVER use promotional language or sales pitches
2. NEVER start with "As someone from [company]" or similar
3. Focus on being genuinely helpful first
4. Only mention your product if directly relevant and asked
5. Use natural Reddit language and formatting
6. Keep replies concise (under ${replyConfig.maxLength ?? 300} words)
7. Match the subreddit's tone and culture
8. Add value through expertise, not promotion

REDDIT FORMATTING:
- Use **bold** for emphasis sparingly
- Use > for quotes when referencing OP
- Break up text into short paragraphs
- End with a question or helpful tip when appropriate`;

        const userPrompt = `Generate a helpful reply to this Reddit post:

ORIGINAL POST:
Title: ${post.title}
Content: ${post.selftext || "[No text content]"}
Subreddit: r/${post.subreddit}

EVALUATION CONTEXT:
${evaluation.reasoning}

${replyConfig.replyPrompt ? `ADDITIONAL GUIDANCE: ${replyConfig.replyPrompt}` : ""}

Write a natural, helpful reply that adds value to the discussion.`;

        const { text } = await generateText({
          model: google("gemini-1.5-flash"),
          system: systemPrompt,
          prompt: userPrompt,
          temperature: 0.7, // Balanced creativity
        });

        if (context.dryRun) {
          results.push({
            postId: post.id,
            replyContent: text,
            success: true,
          });
        } else {
          // Would actually post the reply to Reddit
          results.push({
            postId: post.id,
            replyContent: text,
            success: true,
          });
        }
      } catch (error) {
        console.error(`Error generating reply for post ${post.id}:`, error);
        results.push({
          postId: post.id,
          replyContent: "",
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  }

  return results;
}