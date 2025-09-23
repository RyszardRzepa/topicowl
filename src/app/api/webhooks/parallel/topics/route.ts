import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { projects, articles, topicGenerationTasks } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { validateTopicIdeas } from "@/lib/services/topic-discovery";
import type { TopicIdea } from "@/lib/services/topic-discovery/types";
import { env } from "@/env";

// Parallel webhook payload schema matching the research webhook pattern
const parallelWebhookSchema = z.object({
  timestamp: z.string(),
  type: z.enum(["task_run.status"]),
  data: z.object({
    run_id: z.string(),
    status: z.enum(["completed", "failed", "queued", "running"]),
    is_active: z.boolean(),
    warnings: z.string().nullable().optional(),
    error: z.object({
      message: z.string(),
      details: z.string().optional(),
    }).nullable().optional(),
    processor: z.string(),
    metadata: z.object({
      project_id: z.string(),
      user_id: z.string(),
      project_name: z.string().optional(),
      timestamp: z.string().optional(),
    }).optional(),
    created_at: z.string(),
    modified_at: z.string(),
  }),
});

// Schema for Parallel API task result response
const parallelTopicResultSchema = z.object({
  run: z.object({
    run_id: z.string(),
    status: z.enum(["completed", "failed"]),
    is_active: z.boolean(),
    processor: z.string(),
    metadata: z.record(z.unknown()).optional(),
    taskgroup_id: z.string().optional(),
    created_at: z.string(),
    modified_at: z.string(),
  }),
  output: z.object({
    basis: z.array(z.unknown()).optional(),
    type: z.string(),
    content: z.object({
      article_topics: z.array(z.unknown())
    })
  }),
});

/**
 * Generate array of dates for next 10 days starting tomorrow
 */
function generateScheduleDates(startDate: Date = new Date()): Date[] {
  const dates: Date[] = [];
  const tomorrow = new Date(startDate);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0); // Schedule for 9 AM

  for (let i = 0; i < 10; i++) {
    const scheduleDate = new Date(tomorrow);
    scheduleDate.setDate(tomorrow.getDate() + i);
    dates.push(scheduleDate);
  }

  return dates;
}

/**
 * Create articles from topic ideas with scheduled dates
 */
async function createScheduledArticles(
  topics: TopicIdea[], 
  projectId: number, 
  userId: string
): Promise<void> {
  const scheduleDates = generateScheduleDates();
  const articlesToCreate = topics.map((topic, index) => {
    const scheduleDate = scheduleDates[index];
    
    // Use primary keyword as the main keyword - no regex extraction needed
    const keywords = [topic.primary_keyword];

    // Create comprehensive notes for article generation context
    const notesContent = `Article context:

Content Angle: ${topic.content_angle}

Core User Question: ${topic.core_user_question}

Target Audience: ${topic.target_audience}`;

    return {
      projectId,
      userId,
      title: topic.topic_title,
      description: topic.content_angle,
      keywords,
      targetAudience: topic.target_audience,
      status: "idea" as const,
      publishScheduledAt: scheduleDate,
      notes: notesContent,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  });

  // Insert articles in batch
  if (articlesToCreate.length > 0) {
    await db.insert(articles).values(articlesToCreate);
    console.log(`[TOPIC_WEBHOOK] Created ${articlesToCreate.length} scheduled articles for project ${projectId}`);
  }
}

/**
 * Fetch completed task result from Parallel API
 */
async function fetchTopicTaskResult(runId: string): Promise<TopicIdea[]> {
  const response = await fetch(
    `https://api.parallel.ai/v1/tasks/runs/${runId}/result`,
    {
      method: "GET",
      headers: {
        "x-api-key": env.PARALLEL_API_KEY,
      },
    },
  );

  if (!response.ok) {
    throw new Error(
      `Failed to fetch task result: ${response.status} ${response.statusText}`,
    );
  }

  const parsedResult = parallelTopicResultSchema.parse(await response.json());
  
  // Validate and return topic ideas from the nested structure
  return validateTopicIdeas(parsedResult.output.content.article_topics);
}

export async function POST(req: Request) {
  try {
    // Parse webhook payload
    const body = await req.json() as unknown;
    const parseResult = parallelWebhookSchema.safeParse(body);
    
    if (!parseResult.success) {
      console.error('[TOPIC_WEBHOOK] Invalid webhook payload:', parseResult.error.errors);
      return NextResponse.json({ 
        error: 'Invalid webhook payload',
        details: parseResult.error.errors
      }, { status: 400 });
    }

    const payload = parseResult.data;
    const { run_id, status, error } = payload.data;
    
    console.log(`[TOPIC_WEBHOOK] Received webhook for run_id: ${run_id}, status: ${status}`);

    // Only handle task_run.status events
    if (payload.type !== "task_run.status") {
      console.log("[TOPIC_WEBHOOK] Ignoring non-status webhook event");
      return NextResponse.json({ received: true });
    }

    // Handle failed tasks
    if (status === "failed") {
      // Update task status in database
      await db
        .update(topicGenerationTasks)
        .set({ 
          status: "failed",
          error: error?.message,
          completedAt: new Date()
        })
        .where(eq(topicGenerationTasks.taskId, run_id));
      
      console.error(`[TOPIC_WEBHOOK] Task failed: ${run_id}`, {
        error: error?.message,
        details: error?.details,
        metadata: payload.data.metadata
      });
      
      return NextResponse.json({ 
        success: true,
        message: 'Failed task logged'
      }, { status: 200 });
    }

    // Handle running/queued tasks - just acknowledge
    if (status === "running" || status === "queued") {
      console.log(`[TOPIC_WEBHOOK] Task ${status}: ${run_id}`);
      return NextResponse.json({ received: true });
    }

    // Handle completed tasks
    if (status === "completed") {
      try {
        // Get project information from metadata
        const projectIdStr = payload.data.metadata?.project_id;
        const userId = payload.data.metadata?.user_id;

        if (!projectIdStr || !userId) {
          console.error(`[TOPIC_WEBHOOK] Missing project metadata: ${run_id}`, {
            projectId: projectIdStr,
            userId
          });
          return NextResponse.json({
            error: 'Missing project metadata in webhook'
          }, { status: 400 });
        }

        const projectId = parseInt(projectIdStr, 10);
        if (isNaN(projectId)) {
          console.error(`[TOPIC_WEBHOOK] Invalid project ID: ${projectIdStr}`);
          return NextResponse.json({
            error: 'Invalid project ID in metadata'
          }, { status: 400 });
        }

        // Verify project exists and belongs to user
        const [project] = await db
          .select({ id: projects.id, userId: projects.userId })
          .from(projects)
          .where(eq(projects.id, projectId));

        if (!project || project.userId !== userId) {
          console.error(`[TOPIC_WEBHOOK] Project validation failed: ${projectId}`, {
            exists: !!project,
            userMatch: project?.userId === userId
          });
          return NextResponse.json({
            error: 'Project not found or user mismatch'
          }, { status: 404 });
        }

        // Fetch the completed task result from Parallel API
        const topicIdeas = await fetchTopicTaskResult(run_id);
        
        if (topicIdeas.length === 0) {
          console.error(`[TOPIC_WEBHOOK] No valid topics found: ${run_id}`);
          
          // Update task status as failed
          await db
            .update(topicGenerationTasks)
            .set({ 
              status: "failed",
              error: "No valid topics found",
              completedAt: new Date()
            })
            .where(eq(topicGenerationTasks.taskId, run_id));
          
          return NextResponse.json({
            error: 'No valid topics found in response'
          }, { status: 400 });
        }

        // Create scheduled articles
        await createScheduledArticles(topicIdeas, projectId, userId);

        // Update task status as completed
        await db
          .update(topicGenerationTasks)
          .set({ 
            status: "completed",
            topicsGenerated: topicIdeas.length,
            completedAt: new Date()
          })
          .where(eq(topicGenerationTasks.taskId, run_id));

        console.log(`[TOPIC_WEBHOOK] Successfully processed ${topicIdeas.length} topics for project ${projectId}`);
        
        return NextResponse.json({
          success: true,
          data: {
            topicsProcessed: topicIdeas.length,
            articlesCreated: topicIdeas.length,
            projectId,
            message: `Successfully created ${topicIdeas.length} scheduled articles`
          }
        }, { status: 200 });

      } catch (fetchError) {
        // Update task status as failed
        await db
          .update(topicGenerationTasks)
          .set({ 
            status: "failed",
            error: fetchError instanceof Error ? fetchError.message : "Failed to process task",
            completedAt: new Date()
          })
          .where(eq(topicGenerationTasks.taskId, run_id));
        
        console.error(`[TOPIC_WEBHOOK] Failed to fetch or process task result: ${run_id}`, fetchError);
        
        return NextResponse.json({
          error: 'Failed to process completed task',
          details: fetchError instanceof Error ? fetchError.message : 'Unknown error'
        }, { status: 500 });
      }
    }

    // This should not happen with our current enum, but handle gracefully
    console.warn(`[TOPIC_WEBHOOK] Unhandled status received: ${status as string} for run_id: ${run_id}`);
    return NextResponse.json({
      success: true,
      message: 'Webhook received but status not handled'
    }, { status: 200 });

  } catch (error) {
    console.error('[TOPIC_WEBHOOK] Error processing webhook:', error);
    
    return NextResponse.json({
      error: 'Internal server error',
      details: 'Failed to process topic discovery webhook'
    }, { status: 500 });
  }
}