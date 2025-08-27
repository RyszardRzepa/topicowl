ALTER TABLE "topicowl"."projects" ADD COLUMN "include_citations" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "topicowl"."projects" ADD COLUMN "citation_region" text DEFAULT 'worldwide';--> statement-breakpoint
ALTER TABLE "topicowl"."projects" ADD COLUMN "brand_color" text;--> statement-breakpoint
ALTER TABLE "topicowl"."projects" ADD COLUMN "example_article_url" text;--> statement-breakpoint
ALTER TABLE "topicowl"."projects" ADD COLUMN "target_audience" text;