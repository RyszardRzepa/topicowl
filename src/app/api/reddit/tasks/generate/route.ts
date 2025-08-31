import { auth, clerkClient } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "@/server/db";
import {
  redditSettings,
  redditTasks,
  projects,
  users,
} from "@/server/db/schema";
import { eq, and, gte, lt } from "drizzle-orm";
import { z } from "zod";
import { env } from "@/env";
import type { ClerkPrivateMetadata } from "@/types";
import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { MODELS } from "@/constants";

export const maxDuration = 800;

const GenerateTasksSchema = z.object({
  projectId: z.number(),
  weekStartDate: z.string().optional(), // ISO date string, defaults to current Monday
});

// (weekly schemas removed; tasks are built deterministically in this route)

// Evaluation schema reused from evaluate route
const EvaluationResultSchema = z.object({
  relevanceScore: z.number().min(0).max(10),
  engagementPotential: z.number().min(0).max(10),
  brandAlignment: z.number().min(0).max(10),
  overallScore: z.number().min(0).max(10),
  shouldReply: z.boolean(),
  reasoning: z.string(),
  suggestedApproach: z.string().optional(),
});

// Schema for reply draft generation
const ReplyDraftSchema = z.object({ draft: z.string() });

interface RedditTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface RedditListing {
  data: {
    children: Array<{
      data: {
        display_name_prefixed: string;
        title: string;
        subscribers: number;
        public_description: string;
      };
    }>;
  };
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify user exists in database
    const [userRecord] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, userId));
    if (!userRecord) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = (await request.json()) as unknown;
    const validatedData = GenerateTasksSchema.parse(body);

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
      .where(
        and(
          eq(projects.id, validatedData.projectId),
          eq(projects.userId, userRecord.id),
        ),
      );

    if (!projectRecord) {
      return NextResponse.json(
        { error: "Project not found or access denied" },
        { status: 404 },
      );
    }

    // Get Reddit settings for the project
    const [settings] = await db
      .select()
      .from(redditSettings)
      .where(eq(redditSettings.projectId, validatedData.projectId))
      .limit(1);

    if (!settings) {
      return NextResponse.json(
        {
          error: "Reddit settings not found. Please configure settings first.",
        },
        { status: 404 },
      );
    }

    // Calculate week start date (current Monday if not provided)
    const weekStartDate = validatedData.weekStartDate
      ? new Date(validatedData.weekStartDate)
      : getCurrentWeekStart();

    // Check if tasks already exist for this week (inclusive start, exclusive end)
    const existingTasks = await db
      .select({ id: redditTasks.id })
      .from(redditTasks)
      .where(
        and(
          eq(redditTasks.projectId, validatedData.projectId),
          gte(redditTasks.scheduledDate, weekStartDate),
          lt(
            redditTasks.scheduledDate,
            new Date(weekStartDate.getTime() + 7 * 24 * 60 * 60 * 1000),
          ),
        ),
      )
      .limit(1);

    if (existingTasks.length > 0) {
      return NextResponse.json(
        {
          error:
            "Tasks already exist for this week. Delete existing tasks first if you want to regenerate.",
        },
        { status: 400 },
      );
    }

    // Determine target subreddits: prefer settings.targetSubreddits, otherwise discover
    const targetSubreddits: string[] = Array.isArray(settings.targetSubreddits)
      ? (settings.targetSubreddits as string[])
      : [];

    const subredditsToUse =
      targetSubreddits.length > 0
        ? targetSubreddits
        : await discoverUserSubreddits(
            userRecord.id,
            validatedData.projectId,
            projectRecord,
          );

    // Skip keyword generation - we'll fetch the last 30 posts from each subreddit directly
    console.log("=== FETCHING LATEST POSTS ===");

    // Fetch latest 30 posts from each subreddit from public Reddit API
    type RawRedditPost = {
      id: string;
      subreddit: string;
      title: string;
      selftext?: string;
      author: string;
      score: number;
      created_utc: number;
      num_comments: number;
      url: string;
      redditUrl: string; // Full Reddit URL for the post
    };

    const latestPosts: RawRedditPost[] = [];
    for (const sub of subredditsToUse) {
      const subPath = sub.startsWith("r/") ? sub : `r/${sub}`;
      const subredditName = sub.replace("r/", "");

      console.log(`Fetching last 30 posts from r/${subredditName}`);
      try {
        // Try to get Reddit access token if available
        const clerk = await clerkClient();
        const user = await clerk.users.getUser(userRecord.id);
        const metadata = (user.privateMetadata ?? {}) as ClerkPrivateMetadata;
        const projectConnection = metadata.redditTokens?.[validatedData.projectId.toString()];
        
        let resp;
        if (projectConnection) {
          // Use authenticated Reddit API (more reliable in production)
          try {
            const accessToken = await refreshRedditToken(projectConnection.refreshToken);
            resp = await fetch(
              `https://oauth.reddit.com/${subPath}/new?limit=30`,
              {
                headers: { 
                  "Authorization": `Bearer ${accessToken}`,
                  "User-Agent": "web:contentbot:v1.0.0 (by /u/contentbot-dev)" 
                },
                cache: "no-store",
              },
            );
          } catch (authError) {
            console.warn(`Failed to use authenticated API for r/${subredditName}, falling back to public API:`, authError);
            // Fall back to public API
            resp = await fetch(
              `https://www.reddit.com/${subPath}/new.json?limit=30`,
              {
                headers: { 
                  "User-Agent": "web:contentbot:v1.0.0 (by /u/contentbot-dev)",
                  "Accept": "application/json"
                },
                cache: "no-store",
              },
            );
          }
        } else {
          // Use public API with better headers
          resp = await fetch(
            `https://www.reddit.com/${subPath}/new.json?limit=30`,
            {
              headers: { 
                "User-Agent": "web:contentbot:v1.0.0 (by /u/contentbot-dev)",
                "Accept": "application/json"
              },
              cache: "no-store",
            },
          );
        }
        
        if (!resp.ok) {
          console.warn(`Failed to fetch posts from r/${subredditName}: ${resp.status} ${resp.statusText}`);
          
          if (resp.status === 403) {
            console.warn(`403 Forbidden for r/${subredditName} - This typically happens in production due to:`);
            console.warn(`- Server IP being flagged by Reddit as data center/hosting provider`);
            console.warn(`- Consider using Reddit's OAuth API with proper authentication`);
            console.warn(`- Or implement a proxy/rotation strategy`);
          } else if (resp.status === 429) {
            console.warn(`429 Rate Limited for r/${subredditName} - Adding delay before next request`);
          }
          
          continue;
        }
        
        const json = (await resp.json()) as {
          data: {
            children: Array<{
              data: {
                id: string;
                subreddit: string;
                title: string;
                selftext?: string;
                author: string;
                score: number;
                created_utc: number;
                num_comments: number;
                url: string;
                permalink: string;
              };
            }>;
          };
        };
        
        for (const child of json.data.children) {
          const d = child.data;
          latestPosts.push({
            id: d.id,
            subreddit: d.subreddit,
            title: d.title,
            selftext: d.selftext ?? "",
            author: d.author,
            score: d.score ?? 0,
            created_utc: d.created_utc ?? Math.floor(Date.now() / 1000),
            num_comments: d.num_comments ?? 0,
            url: d.url,
            redditUrl: `https://reddit.com${d.permalink}`,
          });
        }
        
        console.log(
          `Fetched ${json.data.children.length} posts from r/${subredditName}`,
        );
      } catch (e) {
        console.warn(`Failed to fetch posts from r/${subredditName}:`, e);
      }
    }

    console.log(`=== REDDIT POSTS FETCHING ===`);
    console.log(`Target subreddits: ${subredditsToUse.join(", ")}`);
    console.log(
      `Fetched a total of ${latestPosts.length} posts (last 30 from each subreddit) for evaluation.`,
    );

    if (latestPosts.length === 0) {
      return NextResponse.json(
        {
          error: `No posts found in target subreddits: ${subredditsToUse.join(", ")}. Check if subreddits are active or exist.`,
        },
        { status: 400 },
      );
    }

    // Evaluate posts for relevance using the same approach as /evaluate
    const evaluated: Array<{
      post: RawRedditPost;
      score: number;
      shouldReply: boolean;
      reasoning: string;
    }> = [];

    // Extend projectRecord with domain for evaluation context
    const projectDomain = projectRecord.domain ?? "";

    const evalSystemPrompt = `You are an expert Reddit engagement specialist evaluating posts for business relevance and content safety.

CONTEXT:
Company: ${projectRecord.companyName ?? "Unknown"}
Website: ${projectDomain}
Product/Service: ${projectRecord.productDescription ?? ""}
Brand Voice: ${projectRecord.toneOfVoice ?? "professional and helpful"}
Target Keywords: ${((projectRecord.keywords as string[]) ?? []).join(", ")}

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

    for (const post of latestPosts) {
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
          model: google(MODELS.GEMINI_2_5_FLASH),
          schema: EvaluationResultSchema,
          system: evalSystemPrompt,
          prompt: userPrompt,
          temperature: 0.3,
        });

        evaluated.push({
          post,
          score: object.overallScore,
          shouldReply: object.shouldReply,
          reasoning: object.reasoning,
        });
      } catch (e) {
        console.warn(`Evaluation failed for post ${post.id}:`, e);
      }
    }

    // Add detailed logging before filtering
    console.log("=== EVALUATION RESULTS ===");
    console.log(`Total posts evaluated: ${evaluated.length}`);

    // Log top 10 results for debugging
    const sortedByScore = evaluated.sort((a, b) => b.score - a.score);
    sortedByScore.slice(0, 10).forEach((result, index) => {
      console.log(
        `${index + 1}. r/${result.post.subreddit}: "${result.post.title.slice(0, 60)}..."`,
      );
      console.log(
        `   Score: ${result.score}/10, ShouldReply: ${result.shouldReply}`,
      );
      console.log(`   Reasoning: ${result.reasoning.slice(0, 100)}...`);
      console.log("---");
    });

    // Sort by score desc and pick those recommended to reply first
    // Lower threshold from 8 to 6 to be less strict
    const relevantPosts = sortedByScore.filter(
      (r) => r.shouldReply || r.score >= 6,
    );

    console.log(
      `Posts passing filter (score >= 6 OR shouldReply=true): ${relevantPosts.length}`,
    );

    if (relevantPosts.length === 0) {
      // Provide more detailed error message with the actual scores
      const topScores = sortedByScore
        .slice(0, 5)
        .map(
          (r) =>
            `r/${r.post.subreddit}: ${r.score}/10 (${r.shouldReply ? "recommended" : "not recommended"})`,
        )
        .join(", ");

      return NextResponse.json(
        {
          error: `No relevant posts found for comment generation. Highest scores: ${topScores}. Try adjusting your target subreddits or project keywords.`,
        },
        { status: 400 },
      );
    }

    // Generate comment tasks from relevant posts (limit to available posts)
    const commentTasks: Array<{
      subreddit: string;
      searchKeywords: string;
      prompt: string;
      aiDraft?: string;
      redditUrl: string;
    }> = [];

    // Generate comment tasks with drafts for relevant posts
    for (const src of relevantPosts) {
      const sub = src.post.subreddit.startsWith("r/")
        ? `r/${src.post.subreddit}`
        : `r/${src.post.subreddit}`;

      // Only generate AI draft for posts with score >= 6 to save API calls
      let aiDraft: string | undefined;
      if (src.score >= 6) {
        try {
          const replyPrompt = `<instructions>
You are an expert "voice-cloner" running on advanced language models.

When writing in my voice, follow these precise style guidelines:

TONE DNA:
- Matter-of-fact, straightforward delivery without flowery language
- Conversational, like sharing local knowledge with a visitor
- Slightly abrupt transitions between ideas (often starting new sentences rather than using connectors)
- Casual but informative, as if speaking to a curious friend
- Sparse punctuation - minimal exclamation points, rarely uses semicolons
- Tends to mention if something is "popular" or "unusual" explicitly
- Often includes parenthetical clarifications
- Sometimes uses incomplete sentences when providing lists
- Practical rather than poetic descriptions

SENTENCE STRUCTURE:
- Medium-short sentences (10-15 words on average)
- Often starts sentences with "You can" or direct statements
- Frequently mentions location names without elaborate descriptions
- Lists items with minimal transition words
- Uses dashes occasionally for asides
- Sometimes includes mild personal opinions ("but it's Chinese though")
- Often ends paragraphs with a concise observation

VOCABULARY:
- Straightforward, accessible language
- Uses "fairly" and "quite" as modifiers
- Occasional local terms without lengthy explanations
- Functional rather than flowery descriptions
- Uses phrases like "AFAIK" occasionally

EXAMPLES OF MY TONE:

INSTEAD OF WRITING THIS:
"I would highly recommend visiting the breathtaking Emanuel Vigeland Mausoleum, which is considered one of Oslo's most spectacular hidden treasures that tourists often overlook! You'll be absolutely amazed by the incredible atmosphere inside."

WRITE THIS:
"There are some well known "hidden" gems that you can explore. One that is quite popular is the Emanuel Vigeland Mausoleum."

INSTEAD OF WRITING THIS:
"If you're interested in uniquely Norwegian culinary experiences, you simply must try the traditional delicacy known as rakfisk, which consists of fermented fish that has been salt-cured for several months. It's an absolutely fascinating cultural staple that represents centuries of Norwegian food preservation techniques!"

WRITE THIS:
"You can try the traditional dish rakfisk at Fiskeriet, which is located at Youngstorget. Reindeer meat is also unusual AFAIK."

INSTEAD OF WRITING THIS:
"For an exceptionally memorable experience that blends the traditional Nordic love of saunas with Oslo's stunning fjord views, I cannot recommend the floating saunas enough! These innovative wellness experiences allow you to immerse yourself in authentic Norwegian culture while enjoying breathtaking natural scenery."

WRITE THIS:
"The sauna boats are not quite unique anymore, but hey - it's an experience!"

When responding:
1. Focus on content and information first
2. Keep tone casual but clear
3. Don't over-explain or use excessive descriptors
4. Include specific place names and concrete details
5. Mention if something is unusual, popular, or traditional when relevant
6. Use paragraph breaks frequently
7. Keep responses concise and to the point

Write as if you're a helpful local sharing straightforward information, not as a tour guide or marketing professional.
</instructions>

<text_to_reply>
Post Title: ${src.post.title}
Post Content: ${src.post.selftext?.slice(0, 800) ?? "[No text content]"}
Subreddit: r/${src.post.subreddit}
</text_to_reply>

Write a helpful reply for the post above.
Return only the reply text, nothing else. Try to make the reply short, max 5 sentences. If the question is simple, max 2 sentences.`;

          const { object: replyObj } = await generateObject({
            model: google(MODELS.GEMINI_2_5_PRO),
            schema: ReplyDraftSchema,
            system:
              "You write natural, helpful Reddit replies that provide genuine value without being promotional.",
            prompt: replyPrompt,
            temperature: 0.5,
          });
          aiDraft = replyObj.draft;
        } catch (error) {
          console.warn("Failed to generate reply draft:", error);
          aiDraft = undefined;
        }
      } else {
        console.log(
          `Skipping draft generation for post with score ${src.score} (< 6)`,
        );
      }

      commentTasks.push({
        subreddit: sub,
        searchKeywords: src.post.title.slice(0, 50),
        prompt: `Reply to this post: "${src.post.title}"`,
        aiDraft,
        redditUrl: src.post.redditUrl,
      });
    }

    // Only generate tasks for the posts we found - no artificial padding
    // Limit to maximum 7 tasks for the week
    const finalTasks: Array<{
      dayOfWeek:
        | "Monday"
        | "Tuesday"
        | "Wednesday"
        | "Thursday"
        | "Friday"
        | "Saturday"
        | "Sunday";
      taskType: "comment";
      subreddit: string;
      searchKeywords: string;
      prompt: string;
      aiDraft?: string;
      redditUrl: string;
    }> = [];

    // Distribute comment tasks across the week
    const days = [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ] as const;

    // Limit to maximum 7 tasks
    const tasksToCreate = Math.min(commentTasks.length, 7);
    console.log(`Creating ${tasksToCreate} tasks from ${commentTasks.length} available relevant posts`);

    for (let i = 0; i < tasksToCreate; i++) {
      const task = commentTasks[i]!;
      const dayIndex = i % 7;
      finalTasks.push({
        dayOfWeek: days[dayIndex]!,
        taskType: "comment",
        subreddit: task.subreddit,
        searchKeywords: task.searchKeywords,
        prompt: task.prompt,
        aiDraft: task.aiDraft,
        redditUrl: task.redditUrl,
      });
    }

    // Convert to DB records
    const taskRecords = finalTasks.map((task, index) => {
      const dayIndex = days.indexOf(task.dayOfWeek);
      const taskDate = new Date(weekStartDate);
      taskDate.setDate(weekStartDate.getDate() + dayIndex);
      // Set default time to 9:00 AM for all generated tasks
      taskDate.setHours(9, 0, 0, 0);

      return {
        projectId: validatedData.projectId,
        userId: userRecord.id,
        scheduledDate: taskDate,
        taskOrder: index + 1,
        taskType: task.taskType,
        subreddit: task.subreddit,
        searchKeywords: task.searchKeywords,
        prompt: task.prompt,
        aiDraft: task.aiDraft ?? null,
        redditUrl: task.redditUrl ?? null, // Store the direct post URL for comment tasks
        status: "pending" as const,
      };
    });

    console.log(
      `Generated ${taskRecords.length} comment tasks from relevant posts`,
    );

    // Save tasks to database
    const savedTasks = await db
      .insert(redditTasks)
      .values(taskRecords)
      .returning();

    // Calculate actual task distribution for response
    const actualCommentTasks = savedTasks.length; // All tasks are comments now
    const actualPostTasks = 0;

    // Update last generated date (optional; guard in case column doesn't exist)
    try {
      await db
        .update(redditSettings)
        .set({ lastGeneratedDate: new Date() })
        .where(eq(redditSettings.projectId, validatedData.projectId));
    } catch (e) {
      console.warn(
        "Optional update: failed to set redditSettings.lastGeneratedDate",
        e,
      );
    }

    return NextResponse.json({
      success: true,
      tasksGenerated: savedTasks.length,
      weekStartDate: weekStartDate.toISOString(),
      taskDistribution: {
        comments: actualCommentTasks,
        posts: actualPostTasks,
        commentRatio: 100, // All tasks are comments
        expectedRatio: settings.commentRatio ?? 80,
      },
      tasks: savedTasks,
    });
  } catch (error) {
    console.error("Generate Reddit tasks error:", error);
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

function getCurrentWeekStart(): Date {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Convert to days from Monday
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - daysFromMonday);
  weekStart.setHours(0, 0, 0, 0);
  return weekStart;
}

async function discoverUserSubreddits(
  userId: string,
  projectId: number,
  projectRecord: {
    companyName: string | null;
    productDescription: string | null;
    keywords: unknown;
  },
): Promise<string[]> {
  try {
    // Get Reddit access token from Clerk metadata
    const clerk = await clerkClient();
    const user = await clerk.users.getUser(userId);
    const metadata = (user.privateMetadata ?? {}) as ClerkPrivateMetadata;
    const projectConnection = metadata.redditTokens?.[projectId.toString()];

    if (projectConnection) {
      // User has Reddit connected - fetch their subscribed subreddits
      const accessToken = await refreshRedditToken(
        projectConnection.refreshToken,
      );
      const userSubreddits = await fetchUserSubreddits(accessToken);

      // Get settings for target subreddits
      const [settings] = await db
        .select({ targetSubreddits: redditSettings.targetSubreddits })
        .from(redditSettings)
        .where(eq(redditSettings.projectId, projectId));

      const targetSubs = (settings?.targetSubreddits as string[]) ?? [];

      // If user has explicitly selected target subreddits, use ONLY those
      if (targetSubs.length > 0) {
        console.log(
          `Using user-selected target subreddits: ${targetSubs.join(", ")}`,
        );
        return targetSubs;
      }

      // Fallback: if no target subreddits specified, use user's subscribed subreddits
      console.log(
        `No target subreddits specified, using user's subscriptions: ${userSubreddits.slice(0, 10).join(", ")}`,
      );
      return userSubreddits.slice(0, 10);
    }
  } catch (error) {
    console.warn("Failed to fetch user subreddits, using defaults:", error);
  }

  // Even without Reddit connection, check if user has specified target subreddits
  try {
    const [settings] = await db
      .select({ targetSubreddits: redditSettings.targetSubreddits })
      .from(redditSettings)
      .where(eq(redditSettings.projectId, projectId));

    const targetSubs = (settings?.targetSubreddits as string[]) ?? [];

    if (targetSubs.length > 0) {
      console.log(
        `Using user-specified target subreddits (no Reddit connection): ${targetSubs.join(", ")}`,
      );
      return targetSubs;
    }
  } catch (error) {
    console.warn("Failed to fetch target subreddits from settings:", error);
  }

  // Final fallback to default subreddits based on project
  console.log("Using default subreddits based on project");
  return getDefaultSubreddits(projectRecord);
}

async function refreshRedditToken(refreshToken: string): Promise<string> {
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
        refresh_token: refreshToken,
      }),
    },
  );

  if (!tokenResponse.ok) {
    throw new Error("Failed to refresh Reddit token");
  }

  const tokenData = (await tokenResponse.json()) as RedditTokenResponse;
  return tokenData.access_token;
}

async function fetchUserSubreddits(accessToken: string): Promise<string[]> {
  const response = await fetch(
    "https://oauth.reddit.com/subreddits/mine/subscriber?limit=50",
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "User-Agent": "Contentbot/1.0",
      },
    },
  );

  if (!response.ok) {
    throw new Error("Failed to fetch user subreddits");
  }

  const data = (await response.json()) as RedditListing;
  return data.data.children.map((child) => child.data.display_name_prefixed);
}

function getDefaultSubreddits(projectRecord: {
  companyName: string | null;
  productDescription: string | null;
  keywords: unknown;
}): string[] {
  const keywords = (projectRecord.keywords as string[]) ?? [];

  const relevantSubs = new Set<string>();

  // Technology and startup focused defaults
  relevantSubs.add("r/Entrepreneur");
  relevantSubs.add("r/startups");

  // Add based on keywords or description
  keywords.forEach((keyword) => {
    const lower = keyword.toLowerCase();
    if (lower.includes("saas") || lower.includes("software")) {
      relevantSubs.add("r/SaaS");
      relevantSubs.add("r/webdev");
    }
    if (lower.includes("ai") || lower.includes("machine learning")) {
      relevantSubs.add("r/MachineLearning");
      relevantSubs.add("r/artificial");
    }
    if (lower.includes("business") || lower.includes("marketing")) {
      relevantSubs.add("r/smallbusiness");
      relevantSubs.add("r/marketing");
    }
  });

  // Default fallback if no matches
  if (relevantSubs.size === 0) {
    return ["r/Entrepreneur", "r/startups", "r/smallbusiness"];
  }

  return Array.from(relevantSubs).slice(0, 7);
}