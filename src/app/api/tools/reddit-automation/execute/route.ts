import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import {
  redditAutomations,
  redditAutomationRuns,
  projects,
} from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { env } from "@/env";
import type { ClerkPrivateMetadata } from "@/types";

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

const ExecuteWorkflowSchema = z.object({
  automationId: z.number().optional(),
  workflow: z.array(z.object({
    id: z.string(),
    type: z.enum(["trigger", "search", "evaluate", "reply", "action"]),
    config: z.record(z.unknown()),
    position: z.object({
      x: z.number(),
      y: z.number(),
    }),
  })).optional(),
  dryRun: z.boolean().optional().default(false),
  projectId: z.number().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { automationId, workflow, dryRun, projectId } = ExecuteWorkflowSchema.parse(body);

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
          and(eq(redditAutomations.id, automationId), eq(projects.userId, userId)),
        );

      if (!automationResult) {
        return NextResponse.json(
          { error: "Automation not found or access denied" },
          { status: 404 },
        );
      }

      workflowToExecute = automationResult.automation.workflow as WorkflowNode[];
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
          executionId: executionRun.id,
          results: result,
        });
      } catch (executionError) {
        // Update execution run as failed
        await db
          .update(redditAutomationRuns)
          .set({
            status: "failed",
            errorMessage: executionError instanceof Error ? executionError.message : "Unknown error",
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
  },
): Promise<ExecutionContext> {
  const executionContext: ExecutionContext = {};
  
  // Sort nodes by execution order (basic implementation - in real app would need proper topological sort)
  const sortedNodes = [...workflow].sort((a, b) => {
    const typeOrder = { trigger: 0, search: 1, evaluate: 2, reply: 3, action: 4 };
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

  return executionContext;
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
  const projectConnection = metadata.redditTokens?.[context.projectId.toString()];

  if (!projectConnection) {
    throw new Error("Reddit account not connected for this project");
  }

  // Exchange refresh token for access token
  const tokenResponse = await fetch("https://www.reddit.com/api/v1/access_token", {
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
  });

  if (!tokenResponse.ok) {
    throw new Error(`Reddit token refresh failed: ${tokenResponse.status}`);
  }

  const tokenData = await tokenResponse.json();
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

  const data = await response.json();
  const posts: RedditPost[] = data.data.children
    .map((child: any) => child.data)
    .filter((post: any) => {
      // Filter by keywords if specified
      if (config.keywords.length > 0) {
        const content = `${post.title} ${post.selftext}`.toLowerCase();
        return config.keywords.some((keyword) =>
          content.includes(keyword.toLowerCase()),
        );
      }
      return true;
    });

  return posts;
}

async function executeEvaluationNode(
  node: WorkflowNode,
  posts: RedditPost[],
  context: { userId: string; projectId: number },
): Promise<EvaluationResult[]> {
  const config = node.config as {
    prompt: string;
    variables: Record<string, string>;
    passThreshold: number;
  };

  // This would use AI API to evaluate posts
  // For now, return mock results
  const results: EvaluationResult[] = posts.map((post) => ({
    postId: post.id,
    score: Math.random() * 10,
    reasoning: "Mock evaluation result",
    shouldReply: Math.random() > 0.5,
  }));

  return results;
}

async function executeReplyNode(
  node: WorkflowNode,
  posts: RedditPost[],
  evaluationResults: EvaluationResult[],
  context: { userId: string; projectId: number; dryRun: boolean },
): Promise<ReplyResult[]> {
  const config = node.config as {
    prompt: string;
    variables: Record<string, string>;
    toneOfVoice: string;
    maxLength: number;
  };

  const results: ReplyResult[] = [];

  for (const evaluation of evaluationResults) {
    if (evaluation.shouldReply) {
      const post = posts.find((p) => p.id === evaluation.postId);
      if (post) {
        // This would use AI API to generate reply
        const replyContent = `Mock reply for post: ${post.title}`;

        if (context.dryRun) {
          results.push({
            postId: post.id,
            replyContent,
            success: true,
          });
        } else {
          // Would actually post the reply to Reddit
          results.push({
            postId: post.id,
            replyContent,
            success: true,
          });
        }
      }
    }
  }

  return results;
}