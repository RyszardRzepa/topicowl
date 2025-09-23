/**
 * Topic Discovery Service using Parallel AI
 */

import { env } from "@/env";
import { logger } from "@/lib/utils/logger";
import { API_BASE_URL } from "@/constants";
import { z } from "zod";
import type { 
  TopicIdea, 
  ParallelTopicTaskResponse,
} from "./types";
import type { Project } from "@/types";


/**
 * Parallel API JSON Schema for Topic Discovery
 * Structured to return exactly 10 topic ideas matching the API specification
 */
const PARALLEL_TOPIC_DISCOVERY_INPUT_SCHEMA = {
  type: "object",
  properties: {
    product_description: {
      description: "A detailed description of the product or service being marketed.",
      type: "string"
    },
    website_url: {
      description: "The official website URL of the product or company.",
      type: "string"
    }
  },
  required: [
    "product_description",
    "website_url"
  ],
  additionalProperties: false
} as const;

const PARALLEL_TOPIC_DISCOVERY_OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    article_topics: {
      description: "A list of 10 article topics providing detailed information for SEO-optimized content creation.",
      type: "array",
      items: {
        type: "object",
        properties: {
          topic_title: {
            type: "string",
            description: "A compelling, SEO-optimized article title that addresses user intent and incorporates primary keywords."
          },
          primary_keyword: {
            type: "string", 
            description: "A specific long-tail, question-based keyword with low to medium competition, targeting the intended audience's search intent."
          },
          core_user_question: {
            type: "string",
            description: "A real question sourced from platforms like Reddit, Quora, or forums, reflecting a recurring pain point that the article will directly address."
          },
          target_audience: {
            type: "string",
            description: "The specific segment of the audience the article is aimed at, ensuring content is tailored to their needs."
          },
          serp_difficulty_analysis: {
            type: "string",
            description: "A 2-3 sentence analysis explaining the feasibility of ranking for the topic, considering factors like low competition and content gaps."
          },
          content_angle: {
            type: "string",
            description: "A short paragraph detailing the unique perspective and structure of the article, highlighting how it will be the most helpful resource on the topic."
          }
        },
        required: [
          "topic_title", 
          "primary_keyword", 
          "core_user_question", 
          "target_audience", 
          "serp_difficulty_analysis", 
          "content_angle"
        ],
        additionalProperties: false
      }
    }
  },
  required: ["article_topics"],
  additionalProperties: false
} as const;

// Configuration for Parallel API
const PARALLEL_TOPIC_CONFIG = {
  baseUrl: "https://api.parallel.ai/v1",
  processor: "pro",
} as const;

const parallelTopicTaskResponseSchema = z
  .object({
    run_id: z.string(),
    status: z.enum(["queued", "running", "completed", "failed"]),
    is_active: z.boolean(),
    created_at: z.string(),
    modified_at: z.string(),
  })
  .passthrough();

/**
 * Calls Parallel API to create a topic discovery task with webhook notification
 */
export async function createTopicDiscoveryTask(
  project: Project
): Promise<ParallelTopicTaskResponse> {
  if (!env.PARALLEL_API_KEY) {
    throw new Error("Parallel API key is required for topic discovery");
  }

  const productDescription = project.productDescription ?? "AI-powered content creation tool";
  const domain = project.domain ?? project.websiteUrl ?? "";
  const webhookUrl = `${API_BASE_URL}/api/webhooks/parallel/topics`;
  
  const requestBody = {
    task_spec: {
      input_schema: {
        type: "json",
        json_schema: PARALLEL_TOPIC_DISCOVERY_INPUT_SCHEMA
      },
      output_schema: {
        type: "json",
        json_schema: PARALLEL_TOPIC_DISCOVERY_OUTPUT_SCHEMA
      }
    },
    input: {
      product_description: productDescription,
      website_url: domain
    },
    processor: PARALLEL_TOPIC_CONFIG.processor,
    metadata: {
      project_id: project.id.toString(),
      user_id: project.userId,
      project_name: project.name,
      timestamp: new Date().toISOString()
    },
    webhook: {
      url: webhookUrl,
      event_types: ["task_run.status"]
    }
  };

  logger.debug("[TOPIC_DISCOVERY] Creating topic discovery task", {
    projectId: project.id,
    projectName: project.name,
    webhookUrl
  });

  try {
    const response = await fetch(`${PARALLEL_TOPIC_CONFIG.baseUrl}/tasks/runs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": env.PARALLEL_API_KEY,
        "parallel-beta": "webhook-2025-08-12"
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Parallel API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const parsedResult = parallelTopicTaskResponseSchema.parse(
      await response.json(),
    );
    const result: ParallelTopicTaskResponse = parsedResult;

    logger.info("[TOPIC_DISCOVERY] Task created successfully", {
      run_id: result.run_id,
      status: result.status,
      projectId: project.id
    });

    return result;
  } catch (error) {
    logger.error("[TOPIC_DISCOVERY] Failed to create task", error);
    throw new Error(
      `Failed to create topic discovery task: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Validates topic ideas from Parallel AI response
 */
export function validateTopicIdeas(topics: unknown): TopicIdea[] {
  if (!Array.isArray(topics)) {
    throw new Error("Topics must be an array");
  }

  if (topics.length !== 10) {
    logger.warn("[TOPIC_DISCOVERY] Received unexpected number of topics", {
      received: topics.length,
      expected: 10
    });
  }

  const validatedTopics: TopicIdea[] = [];
  
  for (const topic of topics) {
    if (!topic || typeof topic !== "object") {
      logger.warn("[TOPIC_DISCOVERY] Skipping invalid topic", { 
        topicType: typeof topic,
        isNull: topic === null
      });
      continue;
    }

    const topicObj = topic as Record<string, unknown>;

    // Validate required fields
    const requiredFields = [
      "topic_title",
      "primary_keyword", 
      "core_user_question",
      "target_audience",
      "serp_difficulty_analysis",
      "content_angle"
    ];

    const missingFields = requiredFields.filter(field => {
      const value = topicObj[field];
      return !value || typeof value !== "string" || value.trim().length === 0;
    });

    if (missingFields.length > 0) {
      logger.warn("[TOPIC_DISCOVERY] Skipping topic with missing fields", {
        missingFields,
        topic: topicObj
      });
      continue;
    }

    validatedTopics.push({
      topic_title: (topicObj.topic_title as string).trim(),
      primary_keyword: (topicObj.primary_keyword as string).trim(),
      core_user_question: (topicObj.core_user_question as string).trim(),
      target_audience: (topicObj.target_audience as string).trim(),
      serp_difficulty_analysis: (topicObj.serp_difficulty_analysis as string).trim(),
      content_angle: (topicObj.content_angle as string).trim(),
    });
  }

  if (validatedTopics.length === 0) {
    throw new Error("No valid topics found in response");
  }

  logger.info("[TOPIC_DISCOVERY] Validated topics", {
    validCount: validatedTopics.length,
    totalReceived: topics.length
  });

  return validatedTopics;
}