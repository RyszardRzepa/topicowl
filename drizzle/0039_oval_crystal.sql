CREATE TABLE "contentbot"."projects" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"website_url" text NOT NULL,
	"domain" text,
	"company_name" text,
	"product_description" text,
	"keywords" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"tone_of_voice" text,
	"article_structure" text,
	"max_words" integer DEFAULT 800,
	"excluded_domains" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sitemap_url" text,
	"webhook_url" text,
	"webhook_secret" text,
	"webhook_enabled" boolean DEFAULT false NOT NULL,
	"webhook_events" jsonb DEFAULT '["article.published"]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "projects_website_url_unique" UNIQUE("website_url")
);
--> statement-breakpoint
ALTER TABLE "contentbot"."projects" ADD CONSTRAINT "projects_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "contentbot"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "projects_user_id_idx" ON "contentbot"."projects" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "projects_domain_idx" ON "contentbot"."projects" USING btree ("domain");--> statement-breakpoint
CREATE INDEX "projects_user_domain_idx" ON "contentbot"."projects" USING btree ("user_id","domain");