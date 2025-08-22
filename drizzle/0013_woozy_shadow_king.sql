ALTER TABLE "content-machine"."article_generation" ALTER COLUMN "validation_report" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "content-machine"."article_generation" ALTER COLUMN "validation_report" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "content-machine"."article_generation" ALTER COLUMN "validation_report" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "content-machine"."users" ALTER COLUMN "id" SET DEFAULT 'UCU7VTPZ';