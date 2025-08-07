import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/server/db";
import { users, articles } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { google } from "@ai-sdk/google";
import { generateText, generateObject } from "ai";
import { z } from "zod";
import { MODELS } from "@/constants";
import { prompts } from "@/prompts";

// Set maximum duration for AI operations to prevent timeouts
export const maxDuration = 800;

// Types colocated with this API route
export interface ArticleIdea {
  title: string;
  description: string;
  keywords: string[];
  targetAudience?: string;
  contentAngle: string; // e.g., "how-to", "listicle", "case-study"
  estimatedDifficulty: "beginner" | "intermediate" | "advanced";
}

export interface GenerateIdeasResponse {
  success: boolean;
  ideas: ArticleIdea[];
  error?: string;
}

// Zod schema for structured parsing
const articleIdeaSchema = z.object({
  title: z.string(),
  description: z.string(),
  keywords: z.array(z.string()),
  targetAudience: z.string().optional(),
  contentAngle: z.string(),
  estimatedDifficulty: z.enum(["beginner", "intermediate", "advanced"]),
});

const aiResponseSchema = z.object({
  ideas: z.array(articleIdeaSchema),
  analysisContext: z
    .object({
      domainInsights: z.string(),
      trendAnalysis: z.string(),
      competitorGaps: z.string(),
    })
    .optional(),
});

export async function POST() {
  try {
    console.log("[GENERATE_IDEAS_API] POST request received");

    // Get current user from Clerk
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user record from database
    const [userRecord] = await db
      .select({
        id: users.id,
        domain: users.domain,
        product_description: users.product_description,
        keywords: users.keywords,
        company_name: users.company_name,
      })
      .from(users)
      .where(eq(users.clerk_user_id, userId))
      .limit(1);

    if (!userRecord) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get existing article titles to avoid duplicates
    const existingArticles = await db
      .select({ title: articles.title })
      .from(articles)
      .where(eq(articles.user_id, userRecord.id));

    // Build user context for AI prompt
    const userContext = {
      domain: userRecord.domain ?? "",
      productDescription: userRecord.product_description ?? "",
      keywords: Array.isArray(userRecord.keywords)
        ? userRecord.keywords.filter((k): k is string => typeof k === "string")
        : typeof userRecord.keywords === "string"
          ? userRecord.keywords
              .split(",")
              .map((k) => k.trim())
              .filter((k) => k.length > 0)
          : ["business", "guide"],
      companyName: userRecord.company_name ?? "",
      existingArticleTitles: existingArticles.map((article) => article.title),
    };

    console.log(
      "[GENERATE_IDEAS_API] Generating ideas for:",
      userContext.domain,
    );

    // Generate ideas using Gemini AI - first get text, then structure it
    const { text } = await generateText({
      model: google(MODELS.GEMINI_2_5_FLASH),
      prompt: prompts.generateIdeas(userContext),
      temperature: 0.7,
    });

    console.log("[GENERATE_IDEAS_API] Generated text, now structuring...");

    // Now use generateObject to structure the text response
    const { object } = await generateObject({
      model: google(MODELS.GEMINI_2_5_FLASH),
      prompt: `Parse and structure the following article ideas response into the required JSON format:

${text}

Return a JSON object with an "ideas" array containing the article ideas.`,
      schema: aiResponseSchema,
      temperature: 0.1, // Lower temperature for more consistent parsing
    });

    const ideas = object.ideas;

    console.log(
      "[GENERATE_IDEAS_API] Successfully generated:",
      ideas.length,
      "ideas",
    );

    return NextResponse.json({
      success: true,
      ideas,
    });
  } catch (error) {
    console.error("[GENERATE_IDEAS_API] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate article ideas",
        ideas: [],
      },
      { status: 500 },
    );
  }
}
