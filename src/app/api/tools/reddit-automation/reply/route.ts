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

interface ReplyResult {
  postId: string;
  replyContent: string;
  success: boolean;
  error?: string;
}

const ReplyRequestSchema = z.object({
  projectId: z.number(),
  post: z.object({
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
  replyPrompt: z.string().optional(),
  variables: z.record(z.string()).optional().default({}),
  toneOfVoice: z.string().optional().default("helpful"),
});

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { projectId, post, replyPrompt, variables, toneOfVoice } =
      ReplyRequestSchema.parse(body);

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

    // Default reply generation prompt
    const defaultPrompt = `
You are a helpful community member representing ${projectRecord.companyName ?? "our company"}.

Company: ${projectRecord.companyName ?? ""}
Product/Service: ${projectRecord.productDescription ?? ""}
Tone: {{toneOfVoice}}

Generate a helpful, authentic reply to this Reddit post. Your reply should:
1. Be genuinely helpful and add value to the conversation
2. NOT be overly promotional or spammy
3. Follow Reddit's community guidelines and etiquette
4. Feel natural and conversational
5. Only mention your product/service if it's genuinely relevant and helpful

Guidelines:
- Keep replies concise but informative
- Show genuine interest in helping the user
- Avoid sales-y language
- Be respectful of the community
- If your product isn't relevant, provide general helpful advice instead

POST CONTEXT:
Title: {{postTitle}}
Content: {{postContent}}
Subreddit: r/{{subreddit}}
Author: {{author}}

Generate a helpful reply that adds value to this conversation.
    `.trim();

    const prompt = replyPrompt ?? defaultPrompt;

    try {
      // Replace variables in prompt
      let processedPrompt = prompt;
      
      // Default variables
      const defaultVariables = {
        postTitle: post.title,
        postContent: post.selftext,
        subreddit: post.subreddit,
        author: post.author,
        toneOfVoice: toneOfVoice,
      };

      // Merge with custom variables
      const allVariables = { ...defaultVariables, ...variables };
      
      Object.entries(allVariables).forEach(([key, value]) => {
        processedPrompt = processedPrompt.replace(
          new RegExp(`\\{\\{${key}\\}\\}`, 'g'),
          value,
        );
      });

      // Here you would call your AI service (Gemini, Claude, etc.)
      // For now, providing a mock implementation
      const mockReply = `Thanks for sharing this! I've had experience with similar situations. Here are a few suggestions that might help:

1. Consider trying [specific helpful suggestion based on the post]
2. You might also want to look into [another relevant suggestion]
3. If you run into any issues, feel free to ask - happy to help!

Hope this helps! 😊`;

      const result: ReplyResult = {
        postId: post.id,
        replyContent: mockReply,
        success: true,
      };

      return NextResponse.json({
        success: true,
        result,
      });
    } catch (error) {
      console.error(`Error generating reply for post ${post.id}:`, error);
      
      const result: ReplyResult = {
        postId: post.id,
        replyContent: "",
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };

      return NextResponse.json({
        success: false,
        result,
      });
    }
  } catch (error) {
    console.error("Generate reply error:", error);
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