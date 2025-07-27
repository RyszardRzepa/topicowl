ALTER TABLE "content-machine"."articles" DROP CONSTRAINT "articles_parent_article_id_articles_id_fk";
--> statement-breakpoint
ALTER TABLE "content-machine"."users" ALTER COLUMN "id" SET DEFAULT 'F379RYJE';--> statement-breakpoint
ALTER TABLE "content-machine"."articles" DROP COLUMN "parent_article_id";