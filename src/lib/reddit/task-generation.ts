import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";
import { MODELS } from "@/constants";

// Schema for reply draft generation
const ReplyDraftSchema = z.object({ 
  draft: z.string() 
});

// Types for task generation
export interface RedditPost {
  id: string;
  subreddit: string;
  title: string;
  selftext?: string;
  author: string;
  score: number;
  created_utc: number;
  num_comments: number;
  url: string;
  redditUrl: string;
}

export interface EvaluatedPost {
  post: RedditPost;
  score: number;
  shouldReply: boolean;
  reasoning: string;
}

export interface TaskGenerationConfig {
  projectId: number;
  userId: string;
  weekStartDate: Date;
  maxTasks?: number;
  defaultTaskTime?: { hours: number; minutes: number };
  commentRatio?: number; // Percentage of tasks that should be comments (0-100)
}

export interface TaskGenerationResult {
  tasks: Array<{
    projectId: number;
    userId: string;
    scheduledDate: Date;
    taskOrder: number;
    taskType: "comment" | "post";
    subreddit: string;
    searchKeywords: string | null;
    prompt: string;
    aiDraft: string | null;
    redditUrl: string | null;
    status: "pending";
  }>;
  statistics: {
    totalPostsEvaluated: number;
    relevantPostsFound: number;
    tasksGenerated: number;
    draftsGenerated: number;
  };
}

export interface SchedulingOptions {
  weekStartDate: Date;
  maxTasksPerWeek?: number;
  defaultTaskTime?: { hours: number; minutes: number };
}

/**
 * Generates tasks from evaluated Reddit posts
 */
export async function generateTasksFromPosts(
  evaluatedPosts: EvaluatedPost[],
  config: TaskGenerationConfig
): Promise<TaskGenerationResult> {
  const { 
    projectId, 
    userId, 
    weekStartDate, 
    maxTasks = 7, 
    defaultTaskTime = { hours: 9, minutes: 0 },
    commentRatio = 80 
  } = config;

  // Filter relevant posts (score >= 6 or shouldReply = true)
  const relevantPosts = evaluatedPosts.filter(
    (post) => post.shouldReply || post.score >= 6
  );

  if (relevantPosts.length === 0) {
    return {
      tasks: [],
      statistics: {
        totalPostsEvaluated: evaluatedPosts.length,
        relevantPostsFound: 0,
        tasksGenerated: 0,
        draftsGenerated: 0,
      },
    };
  }

  // Limit to maximum tasks
  const tasksToCreate = Math.min(relevantPosts.length, maxTasks);
  const selectedPosts = relevantPosts.slice(0, tasksToCreate);

  // Calculate task type distribution based on commentRatio
  const commentCount = Math.round((tasksToCreate * commentRatio) / 100);
  const postCount = tasksToCreate - commentCount;

  console.log(`Task distribution: ${commentCount} comments, ${postCount} posts (${commentRatio}% comment ratio)`);

  // Generate AI drafts for high-scoring posts
  const tasksWithDrafts: Array<{
    post: RedditPost;
    aiDraft?: string;
    taskType: "comment" | "post";
  }> = [];

  let draftsGenerated = 0;

  for (let i = 0; i < selectedPosts.length; i++) {
    const evaluatedPost = selectedPosts[i]!;
    let aiDraft: string | undefined;

    // Determine task type based on index and ratio
    const taskType: "comment" | "post" = i < commentCount ? "comment" : "post";

    // Only generate AI draft for posts with score >= 6 to save API calls
    if (evaluatedPost.score >= 6) {
      try {
        aiDraft = await generateAiDraft(evaluatedPost.post, taskType);
        if (aiDraft) {
          draftsGenerated++;
        }
      } catch (error) {
        console.warn(`Failed to generate draft for post ${evaluatedPost.post.id}:`, error);
      }
    }

    tasksWithDrafts.push({
      post: evaluatedPost.post,
      aiDraft,
      taskType,
    });
  }

  // Distribute tasks across the week
  const taskRecords = distributeTasksAcrossWeek(tasksWithDrafts, {
    weekStartDate,
    maxTasksPerWeek: maxTasks,
    defaultTaskTime,
  }).map((task, index) => ({
    projectId,
    userId,
    scheduledDate: task.scheduledDate,
    taskOrder: index + 1,
    taskType: task.taskType,
    subreddit: task.subreddit,
    searchKeywords: task.searchKeywords,
    prompt: task.prompt,
    aiDraft: task.aiDraft,
    redditUrl: task.redditUrl,
    status: "pending" as const,
  }));

  return {
    tasks: taskRecords,
    statistics: {
      totalPostsEvaluated: evaluatedPosts.length,
      relevantPostsFound: relevantPosts.length,
      tasksGenerated: taskRecords.length,
      draftsGenerated,
    },
  };
}

/**
 * Generates an AI draft reply for a Reddit post or a new post
 */
export async function generateAiDraft(post: RedditPost, taskType: "comment" | "post" = "comment"): Promise<string | undefined> {
  try {
    const isComment = taskType === "comment";
    const actionType = isComment ? "reply" : "post";
    
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
Post Title: ${post.title}
Post Content: ${post.selftext?.slice(0, 800) ?? "[No text content]"}
Subreddit: r/${post.subreddit}
</text_to_reply>

Write a helpful ${actionType} ${isComment ? "for the post above" : "inspired by the topic above"}.
Return only the ${actionType} text, nothing else. Try to make the ${actionType} ${isComment ? "short, max 5 sentences. If the question is simple, max 2 sentences" : "engaging and informative, max 3-4 sentences with a clear value proposition"}.`;

    const systemPrompt = isComment 
      ? "You write natural, helpful Reddit replies that provide genuine value without being promotional."
      : "You write engaging Reddit posts that start valuable discussions and provide genuine insights without being promotional.";

    const { object: replyObj } = await generateObject({
      model: google(MODELS.GEMINI_2_5_PRO),
      schema: ReplyDraftSchema,
      system: systemPrompt,
      prompt: replyPrompt,
      temperature: 0.5,
    });

    return replyObj.draft;
  } catch (error) {
    console.warn("Failed to generate AI draft:", error);
    return undefined;
  }
}

/**
 * Distributes tasks across the week with proper scheduling
 */
export function distributeTasksAcrossWeek(
  tasksWithDrafts: Array<{
    post: RedditPost;
    aiDraft?: string;
    taskType: "comment" | "post";
  }>,
  options: SchedulingOptions
): Array<{
  scheduledDate: Date;
  taskType: "comment" | "post";
  subreddit: string;
  searchKeywords: string;
  prompt: string;
  aiDraft: string | null;
  redditUrl: string;
}> {
  const { weekStartDate, maxTasksPerWeek = 7, defaultTaskTime = { hours: 9, minutes: 0 } } = options;

  const days = [
    "Monday",
    "Tuesday", 
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ] as const;

  const tasksToCreate = Math.min(tasksWithDrafts.length, maxTasksPerWeek);
  const distributedTasks: Array<{
    scheduledDate: Date;
    taskType: "comment" | "post";
    subreddit: string;
    searchKeywords: string;
    prompt: string;
    aiDraft: string | null;
    redditUrl: string;
  }> = [];

  for (let i = 0; i < tasksToCreate; i++) {
    const taskData = tasksWithDrafts[i]!;
    const dayIndex = i % 7;
    
    // Calculate the scheduled date
    const taskDate = new Date(weekStartDate);
    taskDate.setDate(weekStartDate.getDate() + dayIndex);
    taskDate.setHours(defaultTaskTime.hours, defaultTaskTime.minutes, 0, 0);

    // Format subreddit name
    const subreddit = taskData.post.subreddit.startsWith("r/")
      ? taskData.post.subreddit
      : `r/${taskData.post.subreddit}`;

    distributedTasks.push({
      scheduledDate: taskDate,
      taskType: taskData.taskType,
      subreddit,
      searchKeywords: taskData.post.title.slice(0, 50),
      prompt: taskData.post.title,
      aiDraft: taskData.aiDraft ?? null,
      redditUrl: taskData.taskType === "comment" ? taskData.post.redditUrl : null, // Only comments have specific URLs
    });
  }

  return distributedTasks;
}