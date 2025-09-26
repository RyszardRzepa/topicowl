import { z } from "zod";

export interface ResearchRequest {
  title: string;
  keywords: string[];
  notes?: string;
  excludedDomains?: string[];
}

export interface ResearchResponse {
  researchData: string;
  sources: Array<{
    url: string;
    title?: string;
  }>;
}

export interface ResearchVideo {
  title: string;
  url: string;
  excerpt?: string;
}

// Parallel API types
export interface ParallelResearchTaskResponse {
  run_id: string;
  status: "queued" | "running" | "completed" | "failed";
  is_active: boolean;
  created_at: string;
  modified_at: string;
}

export interface ParallelResearchResponse {
  executive_summary: string;
  primary_intent: string;
  secondary_intents?: string;
  key_insights: string;
  statistics_data: string;
  content_gaps: string;
  frequently_asked_questions: string;
  internal_linking_suggestions?: string;
  risk_assessment?: string;
  source_urls: string;
  research_timestamp?: string;
}

export type ParallelResearchOutputContent = ParallelResearchResponse;

export const parallelResearchContentSchema = z.object({
  executive_summary: z.string(),
  primary_intent: z.string(),
  secondary_intents: z.string().optional().default(""),
  key_insights: z.string(),
  statistics_data: z.string(),
  content_gaps: z.string(),
  frequently_asked_questions: z.string(),
  internal_linking_suggestions: z.string().optional().default(""),
  risk_assessment: z.string().optional().default(""),
  source_urls: z.string(),
  research_timestamp: z.string().optional(),
});

export const parallelRunResultSchema = z.object({
  output: z.object({
    type: z.string(),
    basis: z
      .array(
        z.object({
          field: z.string(),
          citations: z
            .array(
              z.object({
                title: z.string().optional(),
                url: z.string(),
                excerpts: z.array(z.string()).optional(),
              }),
            )
            .optional(),
          reasoning: z.string().optional(),
          confidence: z.string().optional(),
        }),
      )
      .optional(),
    content: parallelResearchContentSchema,
  }),
});

export const parallelResearchTaskResponseSchema = z
  .object({
    run_id: z.string(),
    status: z.enum(["queued", "running", "completed", "failed"]),
    is_active: z.boolean(),
    created_at: z.string(),
    modified_at: z.string(),
  })
  .passthrough();