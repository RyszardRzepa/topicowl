import { pgTable, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const articleStatus = pgEnum("article_status", ['idea', 'scheduled', 'queued', 'to_generate', 'generating', 'wait_for_publish', 'published', 'deleted'])



