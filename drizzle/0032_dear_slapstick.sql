CREATE TABLE "contentbot"."user_credits" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"amount" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "user_credits_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "contentbot"."users" ALTER COLUMN "id" SET DEFAULT 'C35PKHTQ';--> statement-breakpoint
ALTER TABLE "contentbot"."user_credits" ADD CONSTRAINT "user_credits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "contentbot"."users"("id") ON DELETE no action ON UPDATE no action;