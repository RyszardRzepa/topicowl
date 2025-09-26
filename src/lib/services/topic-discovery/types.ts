
export type GenerationTaskStatus = "running" | "completed" | "failed";

// Topic Discovery API Types
export interface TopicIdea {
  topic_title: string;
  primary_keyword: string;
  core_user_question: string;
  target_audience: string;
  serp_difficulty_analysis: string;
  content_angle: string;
}

export interface TopicDiscoveryResponse {
  topics: TopicIdea[];
}

export interface ParallelTopicTaskResponse {
  run_id: string;
  status: "queued" | "running" | "completed" | "failed";
  is_active: boolean;
  created_at: string;
  modified_at: string;
}

export interface ParallelTopicWebhookPayload {
  run_id: string;
  status: "completed" | "failed";
  output?: {
    type: string;
    content: {
      article_topics: unknown[];
    };
  };
  error?: string;
  metadata?: {
    project_id: string;
    user_id: string;
  };
}
