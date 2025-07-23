# Implementation Plan

- [ ] 1. Create reusable services from existing API routes

  - [ ] 1.1 Extract and create ResearchService from existing research route

    - Create `src/lib/services/research-service.ts` that encapsulates the research logic
    - Extract the Google Gemini with grounding logic from the existing `/research` route
    - Create reusable interface for research functionality
    - _Requirements: 3.1, 3.2, 3.3, 9.3_

    ```typescript
    // src/lib/services/research-service.ts
    import { google } from '@ai-sdk/google';
    import { generateText } from 'ai';
    import { prompts } from '@/lib/prompts';
    import { MODELS } from '@/constants';

    export interface ResearchRequest {
      title: string;
      keywords: string[];
    }

    export interface ResearchResult {
      researchData: string;
      sources: any[];
    }

    export class ResearchService {
      async conductResearch(request: ResearchRequest): Promise<ResearchResult> {
        if (!request.title || !request.keywords || request.keywords.length === 0) {
          throw new Error('Title and keywords are required');
        }

        const model = google(MODELS.GEMINI_2_5_FLASH, {
          useSearchGrounding: true,
          dynamicRetrievalConfig: {
            mode: 'MODE_UNSPECIFIED',
          },
        });

        const { text, sources } = await generateText({
          model,
          prompt: prompts.research(request.title, request.keywords),
        });

        return {
          researchData: text,
          sources: sources ?? []
        };
      }
    }

    export const researchService = new ResearchService();
    ```

  - [ ] 1.2 Extract and create WritingService from existing write route

    - Create `src/lib/services/writing-service.ts` that encapsulates the writing logic
    - Extract the Claude Sonnet logic and blog post schema from the existing `/write` route
    - Create reusable interface for content writing functionality
    - _Requirements: 4.1, 4.2, 9.3_

    ```typescript
    // src/lib/services/writing-service.ts
    import { anthropic } from '@ai-sdk/anthropic';
    import { generateObject } from 'ai';
    import { prompts } from '@/lib/prompts';
    import { MODELS } from '@/constants';
    import { db } from '@/server/db';
    import { articleSettings } from '@/server/db/schema';
    import { getBlogSlugs, getRelatedPosts } from '@/lib/sitemap';
    import { z } from 'zod';

    export interface WriteRequest {
      researchData: string;
      title: string;
      keywords: string[];
      author?: string;
      publicationName?: string;
    }

    export const blogPostSchema = z.object({
      id: z.string().describe("A unique ID for the blog post"),
      title: z.string().describe("The title of the blog post"),
      slug: z.string().describe("A URL-friendly version of the title"),
      excerpt: z.string().describe("A short, compelling summary (1-2 sentences)"),
      metaDescription: z.string().describe("An SEO-friendly description. Max 160 char"),
      readingTime: z.string().describe("Estimated reading time, e.g., '5 min read'"),
      content: z.string().describe("The full article content in Markdown format"),
      author: z.string().default('by Oslo Explore staff').describe("The author"),
      date: z.string().describe("The publication date"),
      coverImage: z.string().optional().describe("Placeholder URL for cover image"),
      imageCaption: z.string().optional().describe("Placeholder caption"),
      tags: z.array(z.string()).optional().describe("Array of relevant keywords"),
      relatedPosts: z.array(z.string()).optional().describe("Array of related post slugs"),
    });

    export type BlogPost = z.infer<typeof blogPostSchema>;

    export class WritingService {
      async writeArticle(request: WriteRequest): Promise<BlogPost> {
        if (!request.researchData || !request.title || !request.keywords || request.keywords.length === 0) {
          throw new Error('Research data, title, and keywords are required');
        }

        // Fetch article settings
        let settingsData;
        try {
          const settings = await db.select().from(articleSettings).limit(1);
          settingsData = settings.length > 0 ? {
            toneOfVoice: settings[0]!.toneOfVoice ?? '',
            articleStructure: settings[0]!.articleStructure ?? '',
            maxWords: settings[0]!.maxWords ?? 800,
          } : {
            toneOfVoice: '',
            articleStructure: '',
            maxWords: 800,
          };
        } catch (error) {
          console.warn('Using default article settings:', error);
          settingsData = {
            toneOfVoice: '',
            articleStructure: '',
            maxWords: 800,
          };
        }

        // Fetch available blog slugs for related posts
        const availableBlogSlugs = await getBlogSlugs();
        const suggestedRelatedPosts = getRelatedPosts(
          availableBlogSlugs, 
          request.keywords,
          undefined,
          3
        );

        const { object: articleObject } = await generateObject({
          model: anthropic(MODELS.CLAUDE_SONET_4),
          schema: blogPostSchema,
          prompt: prompts.writing(request, settingsData, suggestedRelatedPosts),
        });

        return articleObject;
      }
    }

    export const writingService = new WritingService();
    ```

  - [ ] 1.3 Extract and create ValidationService from existing validate route

    - Create `src/lib/services/validation-service.ts` that encapsulates the validation logic
    - Extract the Google Gemini grounding logic from the existing `/validate` route
    - Create reusable interface for fact-checking functionality
    - _Requirements: 3.3, 3.4, 9.3_

    ```typescript
    // src/lib/services/validation-service.ts
    import { google } from '@ai-sdk/google';
    import { generateText, generateObject } from 'ai';
    import { z } from 'zod';
    import { prompts } from '@/lib/prompts';
    import { MODELS } from '@/constants';

    export interface ValidationRequest {
      article: string;
    }

    export interface ValidationIssue {
      fact: string;
      issue: string;
      correction: string;
      confidence: number;
    }

    export interface ValidationResult {
      isValid: boolean;
      issues: ValidationIssue[];
    }

    const validationResponseSchema = z.object({
      isValid: z.boolean(),
      issues: z.array(z.object({
        fact: z.string(),
        issue: z.string(),
        correction: z.string(),
        confidence: z.number()
      }))
    });

    export class ValidationService {
      async validateArticle(request: ValidationRequest): Promise<ValidationResult> {
        if (!request.article) {
          throw new Error('Article content is required');
        }

        const { text: validationAnalysis } = await generateText({
          model: google(MODELS.GEMINI_2_5_FLASH, {
            useSearchGrounding: true,
            dynamicRetrievalConfig: {
              mode: 'MODE_UNSPECIFIED',
            },
          }),
          prompt: prompts.validation(request.article),
        });

        const structurePrompt = `
          Based on this validation analysis, create a structured validation response:
          
          ${validationAnalysis}
          
          Return a JSON object with isValid boolean and any issues found.
          Only include issues with confidence > 0.7.
        `;

        const { object } = await generateObject({
          model: google(MODELS.GEMINI_2_5_FLASH),
          schema: validationResponseSchema,
          prompt: structurePrompt,
        });

        return object;
      }
    }

    export const validationService = new ValidationService();
    ```

  - [ ] 1.4 Extract and create UpdateService from existing update route

    - Create `src/lib/services/update-service.ts` that encapsulates the update logic
    - Extract the Claude Sonnet correction logic from the existing `/update` route
    - Create reusable interface for content correction functionality
    - _Requirements: 4.6, 9.3_

    ```typescript
    // src/lib/services/update-service.ts
    import { anthropic } from '@ai-sdk/anthropic';
    import { generateObject } from 'ai';
    import { prompts } from '@/lib/prompts';
    import { MODELS } from '@/constants';
    import { blogPostSchema, type BlogPost } from './writing-service';

    export interface Correction {
      fact: string;
      issue: string;
      correction: string;
      confidence: number;
    }

    export interface UpdateRequest {
      article: string;
      corrections: Correction[];
    }

    export class UpdateService {
      async updateArticle(request: UpdateRequest): Promise<BlogPost> {
        if (!request.article || !request.corrections) {
          throw new Error('Article and corrections are required');
        }

        const model = anthropic(MODELS.CLAUDE_SONET_4);

        const { object: articleObject } = await generateObject({
          model,
          schema: blogPostSchema,
          prompt: prompts.update(request.article, request.corrections),
        });

        return articleObject;
      }
    }

    export const updateService = new UpdateService();
    ```

  - [ ] 1.5 Extract and create SchedulingService from existing schedule route

    - Create `src/lib/services/scheduling-service.ts` that encapsulates the scheduling logic
    - Extract the database operations from the existing `/schedule` route
    - Create reusable interface for article scheduling functionality
    - _Requirements: 10.1, 10.2, 10.3, 12.1, 12.2_

    ```typescript
    // src/lib/services/scheduling-service.ts
    import { db } from "@/server/db";
    import { articles } from "@/server/db/schema";
    import { eq, lte, and } from "drizzle-orm";

    export interface ScheduleRequest {
      id: number;
      scheduledAt: string | null;
      status: 'draft' | 'scheduled' | 'published' | 'archived';
    }

    export interface ScheduledArticle {
      id: number;
      title: string;
      scheduledAt: Date;
      status: string;
    }

    export class SchedulingService {
      async scheduleArticle(request: ScheduleRequest) {
        if (!request.id) {
          throw new Error("Article ID is required");
        }

        const updateData: {
          status: 'draft' | 'scheduled' | 'published' | 'archived';
          scheduledAt?: Date | null;
          publishedAt?: Date | null;
        } = {
          status: request.status,
        };

        if (request.status === 'scheduled' && request.scheduledAt) {
          const scheduledDate = new Date(request.scheduledAt);
          if (scheduledDate <= new Date()) {
            throw new Error("Scheduled time must be in the future");
          }
          updateData.scheduledAt = scheduledDate;
        } else if (request.status === 'published') {
          updateData.publishedAt = new Date();
          updateData.scheduledAt = null;
        } else {
          updateData.scheduledAt = null;
        }

        const [updatedArticle] = await db
          .update(articles)
          .set(updateData)
          .where(eq(articles.id, request.id))
          .returning();

        if (!updatedArticle) {
          throw new Error("Article not found");
        }

        return updatedArticle;
      }

      async getScheduledArticles(): Promise<ScheduledArticle[]> {
        const now = new Date();
        return await db
          .select({
            id: articles.id,
            title: articles.title,
            scheduledAt: articles.scheduledAt,
            status: articles.status,
          })
          .from(articles)
          .where(
            and(
              eq(articles.status, 'scheduled'),
              lte(articles.scheduledAt, now)
            )
          );
      }

      async publishScheduledArticles(): Promise<any[]> {
        const scheduledArticles = await this.getScheduledArticles();
        const publishedArticles = [];

        for (const article of scheduledArticles) {
          try {
            const published = await this.scheduleArticle({
              id: article.id,
              scheduledAt: null,
              status: 'published'
            });
            publishedArticles.push(published);
          } catch (error) {
            console.error(`Failed to publish article ${article.id}:`, error);
          }
        }

        return publishedArticles;
      }
    }

    export const schedulingService = new SchedulingService();
    ```

    - Create database schema for projects, tasks, and content:

      ```typescript
      // src/server/db/schema.ts
      import {
        pgTable,
        serial,
        text,
        timestamp,
        integer,
        jsonb,
        boolean,
        varchar,
        uuid,
        pgEnum,
      } from "drizzle-orm/pg-core";
      import { relations } from "drizzle-orm";

      // Enums
      export const projectStatusEnum = pgEnum("project_status", [
        "planning",
        "in_progress",
        "review",
        "completed",
      ]);
      export const taskStatusEnum = pgEnum("task_status", [
        "pending",
        "in_progress",
        "completed",
        "failed",
      ]);
      export const taskPriorityEnum = pgEnum("task_priority", [
        "low",
        "medium",
        "high",
        "critical",
      ]);
      export const contentStatusEnum = pgEnum("content_status", [
        "draft",
        "review",
        "approved",
        "published",
      ]);
      export const sourceReliabilityEnum = pgEnum("source_reliability", [
        "high",
        "medium",
        "low",
      ]);
      export const claimStatusEnum = pgEnum("claim_status", [
        "verified",
        "questionable",
        "false",
      ]);

      // Users table (linked to Clerk)
      export const users = pgTable("users", {
        id: varchar("id").primaryKey(),
        email: varchar("email").notNull().unique(),
        name: varchar("name"),
        createdAt: timestamp("created_at").defaultNow().notNull(),
        updatedAt: timestamp("updated_at").defaultNow().notNull(),
      });

      // Projects table
      export const projects = pgTable("projects", {
        id: serial("id").primaryKey(),
        name: varchar("name", { length: 255 }).notNull(),
        description: text("description"),
        status: projectStatusEnum("status").default("planning").notNull(),
        createdAt: timestamp("created_at").defaultNow().notNull(),
        updatedAt: timestamp("updated_at").defaultNow().notNull(),
        userId: varchar("user_id")
          .notNull()
          .references(() => users.id, { onDelete: "cascade" }),
        websiteUrl: varchar("website_url", { length: 255 }),
        settings: jsonb("settings").default({}).notNull(),
        articleSettings: jsonb("article_settings").default({}).notNull(),
      });

      // Project relations
      export const projectsRelations = relations(projects, ({ one, many }) => ({
        user: one(users, {
          fields: [projects.userId],
          references: [users.id],
        }),
        tasks: many(tasks),
        strategies: many(seoStrategies),
        contents: many(contents),
      }));

      // Tasks table
      export const tasks = pgTable("tasks", {
        id: serial("id").primaryKey(),
        projectId: integer("project_id")
          .notNull()
          .references(() => projects.id, { onDelete: "cascade" }),
        parentTaskId: integer("parent_task_id").references(() => tasks.id),
        type: varchar("type", { length: 50 }).notNull(),
        status: taskStatusEnum("status").default("pending").notNull(),
        priority: taskPriorityEnum("priority").default("medium").notNull(),
        assignedAgent: varchar("assigned_agent", { length: 50 }).notNull(),
        input: jsonb("input"),
        output: jsonb("output"),
        error: text("error"),
        retryCount: integer("retry_count").default(0).notNull(),
        createdAt: timestamp("created_at").defaultNow().notNull(),
        updatedAt: timestamp("updated_at").defaultNow().notNull(),
        completedAt: timestamp("completed_at"),
      });

      // Task relations
      export const tasksRelations = relations(tasks, ({ one, many }) => ({
        project: one(projects, {
          fields: [tasks.projectId],
          references: [projects.id],
        }),
        parentTask: one(tasks, {
          fields: [tasks.parentTaskId],
          references: [tasks.id],
        }),
        childTasks: many(tasks, { relationName: "childTasks" }),
      }));

      // SEO Strategies table
      export const seoStrategies = pgTable("seo_strategies", {
        id: serial("id").primaryKey(),
        projectId: integer("project_id")
          .notNull()
          .references(() => projects.id, { onDelete: "cascade" }),
        mainTopic: varchar("main_topic", { length: 255 }).notNull(),
        keywordAnalysis: jsonb("keyword_analysis").default({}).notNull(),
        competitorAnalysis: jsonb("competitor_analysis").default({}).notNull(),
        topicTree: jsonb("topic_tree").default({}).notNull(),
        demandAnalysis: jsonb("demand_analysis").default({}).notNull(),
        createdAt: timestamp("created_at").defaultNow().notNull(),
        updatedAt: timestamp("updated_at").defaultNow().notNull(),
        status: varchar("status", { length: 20 }).default("draft").notNull(),
        humanFeedback: text("human_feedback"),
      });

      // SEO Strategy relations
      export const seoStrategiesRelations = relations(
        seoStrategies,
        ({ one }) => ({
          project: one(projects, {
            fields: [seoStrategies.projectId],
            references: [projects.id],
          }),
        }),
      );

      // Contents table
      export const contents = pgTable("contents", {
        id: serial("id").primaryKey(),
        projectId: integer("project_id")
          .notNull()
          .references(() => projects.id, { onDelete: "cascade" }),
        title: varchar("title", { length: 255 }).notNull(),
        metaDescription: varchar("meta_description", { length: 255 }),
        outline: jsonb("outline").default({}).notNull(),
        draft: text("draft"),
        optimizedContent: text("optimized_content"),
        factCheckReport: jsonb("fact_check_report").default({}).notNull(),
        seoScore: integer("seo_score"),
        internalLinks: jsonb("internal_links").default([]).notNull(),
        sources: jsonb("sources").default([]).notNull(),
        status: contentStatusEnum("status").default("draft").notNull(),
        createdAt: timestamp("created_at").defaultNow().notNull(),
        updatedAt: timestamp("updated_at").defaultNow().notNull(),
      });

      // Content relations
      export const contentsRelations = relations(contents, ({ one }) => ({
        project: one(projects, {
          fields: [contents.projectId],
          references: [projects.id],
        }),
      }));
      ```

    - Configure Drizzle ORM and migrations:

      ```typescript
      // src/server/db/index.ts
      import { drizzle } from "drizzle-orm/postgres-js";
      import postgres from "postgres";
      import { env } from "@/env";
      import * as schema from "./schema";

      // Database connection string
      const connectionString = env.DATABASE_URL;

      // Create postgres connection
      const client = postgres(connectionString);

      // Create drizzle database instance
      export const db = drizzle(client, { schema });
      ```

      ```typescript
      // drizzle.config.ts
      import { defineConfig } from "drizzle-kit";
      import { env } from "./src/env";

      export default defineConfig({
        schema: "./src/server/db/schema.ts",
        out: "./drizzle",
        driver: "pg",
        dbCredentials: {
          connectionString: env.DATABASE_URL,
        },
        verbose: true,
        strict: true,
      });
      ```

      ```bash
      # Generate migrations
      npm run db:generate

      # Apply migrations
      npm run db:migrate
      ```

    - Implement basic CRUD operations for core entities:

      ```typescript
      // src/server/api/repositories/project-repository.ts
      import { db } from "@/server/db";
      import {
        projects,
        tasks,
        seoStrategies,
        contents,
      } from "@/server/db/schema";
      import { eq, and } from "drizzle-orm";
      import { type NewProject, type Project } from "@/types";

      export const projectRepository = {
        // Create a new project
        async create(data: NewProject): Promise<Project> {
          const [project] = await db.insert(projects).values(data).returning();
          return project;
        },

        // Get project by ID
        async getById(
          id: number,
          userId: string,
        ): Promise<Project | undefined> {
          const [project] = await db
            .select()
            .from(projects)
            .where(and(eq(projects.id, id), eq(projects.userId, userId)));
          return project;
        },

        // Get all projects for a user
        async getAllByUserId(userId: string): Promise<Project[]> {
          return db
            .select()
            .from(projects)
            .where(eq(projects.userId, userId))
            .orderBy(projects.createdAt);
        },

        // Update a project
        async update(
          id: number,
          userId: string,
          data: Partial<Project>,
        ): Promise<Project | undefined> {
          const [project] = await db
            .update(projects)
            .set({ ...data, updatedAt: new Date() })
            .where(and(eq(projects.id, id), eq(projects.userId, userId)))
            .returning();
          return project;
        },

        // Delete a project
        async delete(id: number, userId: string): Promise<boolean> {
          const result = await db
            .delete(projects)
            .where(and(eq(projects.id, id), eq(projects.userId, userId)));
          return result.rowCount > 0;
        },

        // Update article settings
        async updateArticleSettings(
          id: number,
          userId: string,
          articleSettings: any,
        ): Promise<Project | undefined> {
          const [project] = await db
            .update(projects)
            .set({
              articleSettings,
              updatedAt: new Date(),
            })
            .where(and(eq(projects.id, id), eq(projects.userId, userId)))
            .returning();
          return project;
        },
      };
      ```

      ```typescript
      // Similar repositories for tasks, seoStrategies, and contents
      // src/server/api/repositories/task-repository.ts
      // src/server/api/repositories/strategy-repository.ts
      // src/server/api/repositories/content-repository.ts
      ```

    - _Requirements: 2.3, 2.4, 7.1, 7.2_

  - [ ] 1.3 Configure authentication with Clerk

    - Set up Clerk authentication
    - Implement protected routes
    - Create user profile and settings pages
    - _Requirements: 6.1, 6.2, 6.3_

  - [ ] 1.4 Set up Next.js API routes architecture

    - Create authentication middleware for API routes:

      ```typescript
      // src/lib/auth.ts
      import { auth } from "@clerk/nextjs/server";
      import { NextRequest, NextResponse } from "next/server";

      export async function withAuth(
        handler: (req: NextRequest, userId: string) => Promise<NextResponse>
      ) {
        return async (req: NextRequest) => {
          const { userId } = await auth();
          
          if (!userId) {
            return NextResponse.json(
              { error: "Unauthorized" },
              { status: 401 }
            );
          }

          try {
            return await handler(req, userId);
          } catch (error) {
            console.error("API Error:", error);
            return NextResponse.json(
              { error: "Internal Server Error" },
              { status: 500 }
            );
          }
        };
      }

      export function validateRequest(schema: any) {
        return async (req: NextRequest) => {
          try {
            const body = await req.json();
            const validatedData = schema.parse(body);
            return validatedData;
          } catch (error) {
            throw new Error("Invalid request data");
          }
        };
      }
      ```

    - Create project API routes:

      ```typescript
      // src/app/api/projects/route.ts
      import { NextRequest, NextResponse } from "next/server";
      import { withAuth } from "@/lib/auth";
      import { projectRepository } from "@/server/api/repositories/project-repository";
      import { z } from "zod";

      const createProjectSchema = z.object({
        name: z.string().min(1).max(255),
        description: z.string().optional(),
        websiteUrl: z.string().url().optional(),
        settings: z.record(z.any()).optional(),
      });

      // GET /api/projects - Get all projects for user
      export const GET = withAuth(async (req: NextRequest, userId: string) => {
        const projects = await projectRepository.getAllByUserId(userId);
        return NextResponse.json(projects);
      });

      // POST /api/projects - Create new project
      export const POST = withAuth(async (req: NextRequest, userId: string) => {
        const body = await req.json();
        const validatedData = createProjectSchema.parse(body);
        
        const project = await projectRepository.create({
          ...validatedData,
          userId,
          status: "planning",
        });
        
        return NextResponse.json(project, { status: 201 });
      });
      ```

      ```typescript
      // src/app/api/projects/[id]/route.ts
      import { NextRequest, NextResponse } from "next/server";
      import { withAuth } from "@/lib/auth";
      import { projectRepository } from "@/server/api/repositories/project-repository";
      import { z } from "zod";

      const updateProjectSchema = z.object({
        name: z.string().min(1).max(255).optional(),
        description: z.string().optional(),
        status: z.enum(["planning", "in_progress", "review", "completed"]).optional(),
        websiteUrl: z.string().url().optional(),
        settings: z.record(z.any()).optional(),
      });

      // GET /api/projects/[id] - Get project by ID
      export const GET = withAuth(async (req: NextRequest, userId: string) => {
        const id = parseInt(req.url.split('/').pop() || '0');
        
        const project = await projectRepository.getById(id, userId);
        if (!project) {
          return NextResponse.json(
            { error: "Project not found" },
            { status: 404 }
          );
        }
        
        return NextResponse.json(project);
      });

      // PUT /api/projects/[id] - Update project
      export const PUT = withAuth(async (req: NextRequest, userId: string) => {
        const id = parseInt(req.url.split('/').pop() || '0');
        const body = await req.json();
        const validatedData = updateProjectSchema.parse(body);
        
        const project = await projectRepository.update(id, userId, validatedData);
        if (!project) {
          return NextResponse.json(
            { error: "Project not found" },
            { status: 404 }
          );
        }
        
        return NextResponse.json(project);
      });

      // DELETE /api/projects/[id] - Delete project
      export const DELETE = withAuth(async (req: NextRequest, userId: string) => {
        const id = parseInt(req.url.split('/').pop() || '0');
        
        const success = await projectRepository.delete(id, userId);
        if (!success) {
          return NextResponse.json(
            { error: "Project not found" },
            { status: 404 }
          );
        }
        
        return NextResponse.json({ success: true });
      });
      ```

    - Create website analysis API routes:

      ```typescript
      // src/app/api/website-analysis/route.ts
      import { NextRequest, NextResponse } from "next/server";
      import { withAuth } from "@/lib/auth";
      import { projectRepository } from "@/server/api/repositories/project-repository";
      import { taskRepository } from "@/server/api/repositories/task-repository";
      import { z } from "zod";

      const analyzeWebsiteSchema = z.object({
        projectId: z.number(),
        websiteUrl: z.string().url(),
      });

      // POST /api/website-analysis - Start website analysis
      export const POST = withAuth(async (req: NextRequest, userId: string) => {
        const body = await req.json();
        const { projectId, websiteUrl } = analyzeWebsiteSchema.parse(body);
        
        // Check if project exists and belongs to user
        const project = await projectRepository.getById(projectId, userId);
        if (!project) {
          return NextResponse.json(
            { error: "Project not found" },
            { status: 404 }
          );
        }

        // Update project with website URL
        await projectRepository.update(projectId, userId, { websiteUrl });

        // Create analysis task
        const task = await taskRepository.create({
          projectId,
          type: "website_analysis",
          assignedAgent: "website_analysis_agent",
          priority: "high",
          input: { websiteUrl },
        });

        return NextResponse.json({ taskId: task.id });
      });
      ```

      ```typescript
      // src/app/api/website-analysis/[taskId]/route.ts
      import { NextRequest, NextResponse } from "next/server";
      import { withAuth } from "@/lib/auth";
      import { taskRepository } from "@/server/api/repositories/task-repository";
      import { projectRepository } from "@/server/api/repositories/project-repository";

      // GET /api/website-analysis/[taskId] - Get analysis status
      export const GET = withAuth(async (req: NextRequest, userId: string) => {
        const taskId = parseInt(req.url.split('/').pop() || '0');
        
        const task = await taskRepository.getById(taskId);
        if (!task) {
          return NextResponse.json(
            { error: "Task not found" },
            { status: 404 }
          );
        }

        // Check if user has access to this task's project
        const project = await projectRepository.getById(task.projectId, userId);
        if (!project) {
          return NextResponse.json(
            { error: "Access denied" },
            { status: 403 }
          );
        }

        return NextResponse.json({
          status: task.status,
          progress: task.status === "completed" ? 100 
                  : task.status === "in_progress" ? 50 
                  : task.status === "failed" ? 0 : 25,
          result: task.output,
          error: task.error,
        });
      });
      ```

    - Create task management API routes:

      ```typescript
      // src/app/api/tasks/route.ts
      import { NextRequest, NextResponse } from "next/server";
      import { withAuth } from "@/lib/auth";
      import { taskRepository } from "@/server/api/repositories/task-repository";
      import { projectRepository } from "@/server/api/repositories/project-repository";

      // GET /api/tasks?projectId=123 - Get tasks for project
      export const GET = withAuth(async (req: NextRequest, userId: string) => {
        const { searchParams } = new URL(req.url);
        const projectId = parseInt(searchParams.get('projectId') || '0');
        
        if (!projectId) {
          return NextResponse.json(
            { error: "Project ID is required" },
            { status: 400 }
          );
        }

        // Check if project exists and belongs to user
        const project = await projectRepository.getById(projectId, userId);
        if (!project) {
          return NextResponse.json(
            { error: "Project not found" },
            { status: 404 }
          );
        }

        const tasks = await taskRepository.getByProjectId(projectId);
        return NextResponse.json(tasks);
      });
      ```

      ```typescript
      // src/app/api/tasks/[id]/route.ts
      import { NextRequest, NextResponse } from "next/server";
      import { withAuth } from "@/lib/auth";
      import { taskRepository } from "@/server/api/repositories/task-repository";
      import { projectRepository } from "@/server/api/repositories/project-repository";

      // GET /api/tasks/[id] - Get task by ID
      export const GET = withAuth(async (req: NextRequest, userId: string) => {
        const taskId = parseInt(req.url.split('/').pop() || '0');
        
        const task = await taskRepository.getById(taskId);
        if (!task) {
          return NextResponse.json(
            { error: "Task not found" },
            { status: 404 }
          );
        }

        // Check if user has access to this task's project
        const project = await projectRepository.getById(task.projectId, userId);
        if (!project) {
          return NextResponse.json(
            { error: "Access denied" },
            { status: 403 }
          );
        }

        return NextResponse.json(task);
      });
      ```

      ```typescript
      // src/app/api/tasks/[id]/retry/route.ts
      import { NextRequest, NextResponse } from "next/server";
      import { withAuth } from "@/lib/auth";
      import { taskRepository } from "@/server/api/repositories/task-repository";
      import { projectRepository } from "@/server/api/repositories/project-repository";

      // POST /api/tasks/[id]/retry - Retry failed task
      export const POST = withAuth(async (req: NextRequest, userId: string) => {
        const taskId = parseInt(req.url.split('/').slice(-2)[0] || '0');
        
        const task = await taskRepository.getById(taskId);
        if (!task) {
          return NextResponse.json(
            { error: "Task not found" },
            { status: 404 }
          );
        }

        // Check if user has access to this task's project
        const project = await projectRepository.getById(task.projectId, userId);
        if (!project) {
          return NextResponse.json(
            { error: "Access denied" },
            { status: 403 }
          );
        }

        if (task.status !== "failed") {
          return NextResponse.json(
            { error: "Only failed tasks can be retried" },
            { status: 400 }
          );
        }

        const updatedTask = await taskRepository.update(taskId, {
          status: "pending",
          error: null,
          retryCount: task.retryCount + 1,
        });

        return NextResponse.json(updatedTask);
      });
      ```

    - Create client-side API utilities:

      ```typescript
      // src/lib/api-client.ts
      export class ApiClient {
        private baseUrl = '/api';

        private async request<T>(
          endpoint: string,
          options: RequestInit = {}
        ): Promise<T> {
          const url = `${this.baseUrl}${endpoint}`;
          const response = await fetch(url, {
            headers: {
              'Content-Type': 'application/json',
              ...options.headers,
            },
            ...options,
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'API request failed');
          }

          return response.json();
        }

        // Project methods
        async getProjects() {
          return this.request('/projects');
        }

        async getProject(id: number) {
          return this.request(`/projects/${id}`);
        }

        async createProject(data: any) {
          return this.request('/projects', {
            method: 'POST',
            body: JSON.stringify(data),
          });
        }

        async updateProject(id: number, data: any) {
          return this.request(`/projects/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
          });
        }

        async deleteProject(id: number) {
          return this.request(`/projects/${id}`, {
            method: 'DELETE',
          });
        }

        // Website analysis methods
        async analyzeWebsite(projectId: number, websiteUrl: string) {
          return this.request('/website-analysis', {
            method: 'POST',
            body: JSON.stringify({ projectId, websiteUrl }),
          });
        }

        async getAnalysisStatus(taskId: number) {
          return this.request(`/website-analysis/${taskId}`);
        }

        // Task methods
        async getTasks(projectId: number) {
          return this.request(`/tasks?projectId=${projectId}`);
        }

        async getTask(taskId: number) {
          return this.request(`/tasks/${taskId}`);
        }

        async retryTask(taskId: number) {
          return this.request(`/tasks/${taskId}/retry`, {
            method: 'POST',
          });
        }
      }

      export const apiClient = new ApiClient();
      ```

    - _Requirements: 2.3, 2.4, 7.1_

- [ ] 2. Create unified article generation service using extracted services

  - [ ] 2.1 Create ArticleGenerationService that orchestrates all services

    - Create `src/lib/services/article-generation-service.ts` that coordinates the complete workflow
    - Use all the extracted services (ResearchService, WritingService, ValidationService, UpdateService)
    - Implement progress tracking and error handling for the complete generation process
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

    ```typescript
    // src/lib/services/article-generation-service.ts
    import { researchService } from './research-service';
    import { writingService } from './writing-service';
    import { validationService } from './validation-service';
    import { updateService } from './update-service';
    import { db } from '@/server/db';
    import { articles } from '@/server/db/schema';
    import { eq } from 'drizzle-orm';

    export interface GenerationProgress {
      articleId: number;
      status: 'pending' | 'researching' | 'writing' | 'validating' | 'updating' | 'completed' | 'failed';
      progress: number;
      currentStep: string;
      error?: string;
    }

    export interface GeneratedArticle {
      id: number;
      title: string;
      content: string;
      metaDescription: string;
      draft: string;
      sources: any[];
      validationReport: any;
    }

    export class ArticleGenerationService {
      private progressMap = new Map<number, GenerationProgress>();

      async generateArticle(articleId: number): Promise<GeneratedArticle> {
        try {
          // Get article from database
          const [article] = await db
            .select()
            .from(articles)
            .where(eq(articles.id, articleId));

          if (!article) {
            throw new Error('Article not found');
          }

          // Update status to generating
          await this.updateArticleStatus(articleId, 'generating');
          this.updateProgress(articleId, 'researching', 10, 'Starting research phase');

          // Step 1: Research
          const researchResult = await researchService.conductResearch({
            title: article.title,
            keywords: article.keywords as string[],
          });
          this.updateProgress(articleId, 'writing', 30, 'Research completed, starting writing');

          // Step 2: Write article
          const blogPost = await writingService.writeArticle({
            researchData: researchResult.researchData,
            title: article.title,
            keywords: article.keywords as string[],
          });
          this.updateProgress(articleId, 'validating', 60, 'Writing completed, validating content');

          // Step 3: Validate content
          const validationResult = await validationService.validateArticle({
            article: blogPost.content,
          });
          this.updateProgress(articleId, 'updating', 80, 'Validation completed');

          // Step 4: Update if needed
          let finalBlogPost = blogPost;
          if (!validationResult.isValid && validationResult.issues.length > 0) {
            const corrections = validationResult.issues.map(issue => ({
              fact: issue.fact,
              issue: issue.issue,
              correction: issue.correction,
              confidence: issue.confidence,
            }));

            finalBlogPost = await updateService.updateArticle({
              article: blogPost.content,
              corrections,
            });
          }

          // Step 5: Save to database
          const [updatedArticle] = await db
            .update(articles)
            .set({
              draft: finalBlogPost.content,
              metaDescription: finalBlogPost.metaDescription,
              optimizedContent: finalBlogPost.content,
              sources: researchResult.sources,
              factCheckReport: validationResult,
              status: 'wait_for_publish',
              generationCompletedAt: new Date(),
            })
            .where(eq(articles.id, articleId))
            .returning();

          this.updateProgress(articleId, 'completed', 100, 'Article generation completed');

          return {
            id: updatedArticle!.id,
            title: updatedArticle!.title,
            content: finalBlogPost.content,
            metaDescription: finalBlogPost.metaDescription,
            draft: finalBlogPost.content,
            sources: researchResult.sources,
            validationReport: validationResult,
          };

        } catch (error) {
          console.error('Article generation failed:', error);
          await this.updateArticleStatus(articleId, 'idea');
          await db
            .update(articles)
            .set({
              generationError: error instanceof Error ? error.message : 'Unknown error',
            })
            .where(eq(articles.id, articleId));

          this.updateProgress(articleId, 'failed', 0, error instanceof Error ? error.message : 'Unknown error');
          throw error;
        }
      }

      private async updateArticleStatus(articleId: number, status: string) {
        await db
          .update(articles)
          .set({ 
            status: status as any,
            generationStartedAt: status === 'generating' ? new Date() : undefined,
          })
          .where(eq(articles.id, articleId));
      }

      private updateProgress(articleId: number, status: GenerationProgress['status'], progress: number, currentStep: string, error?: string) {
        this.progressMap.set(articleId, {
          articleId,
          status,
          progress,
          currentStep,
          error,
        });
      }

      getGenerationProgress(articleId: number): GenerationProgress | null {
        return this.progressMap.get(articleId) || null;
      }

      async cancelGeneration(articleId: number): Promise<void> {
        this.progressMap.delete(articleId);
        await this.updateArticleStatus(articleId, 'idea');
      }
    }

    export const articleGenerationService = new ArticleGenerationService();
    ```

- [ ] 3. Update API routes to use the new services

  - [ ] 3.1 Create unified article generation API route

    - Create `src/app/api/articles/[id]/generate/route.ts` that uses ArticleGenerationService
    - Replace complex multi-agent logic with simple service calls
    - Implement progress tracking endpoint
    - _Requirements: 9.1, 9.2, 9.3_

    ```typescript
    // src/app/api/articles/[id]/generate/route.ts
    import { NextRequest, NextResponse } from "next/server";
    import { withAuth } from "@/lib/auth";
    import { articleGenerationService } from "@/lib/services/article-generation-service";

    export const POST = withAuth(async (req: NextRequest, userId: string) => {
      try {
        const articleId = parseInt(req.url.split('/').slice(-2)[0] || '0');
        
        if (!articleId) {
          return NextResponse.json(
            { error: "Invalid article ID" },
            { status: 400 }
          );
        }

        // Start generation process (runs in background)
        const generationPromise = articleGenerationService.generateArticle(articleId);
        
        // Don't await - let it run in background
        generationPromise.catch(error => {
          console.error('Background generation failed:', error);
        });

        return NextResponse.json({ 
          message: "Article generation started",
          articleId 
        });

      } catch (error) {
        console.error('Generate article error:', error);
        return NextResponse.json(
          { error: 'Failed to start article generation' },
          { status: 500 }
        );
      }
    });
    ```

  - [ ] 3.2 Create generation status API route

    - Create `src/app/api/articles/[id]/generation-status/route.ts` for progress tracking
    - Use ArticleGenerationService to get current progress
    - _Requirements: 9.8, 9.9_

    ```typescript
    // src/app/api/articles/[id]/generation-status/route.ts
    import { NextRequest, NextResponse } from "next/server";
    import { withAuth } from "@/lib/auth";
    import { articleGenerationService } from "@/lib/services/article-generation-service";

    export const GET = withAuth(async (req: NextRequest, userId: string) => {
      try {
        const articleId = parseInt(req.url.split('/').slice(-2)[0] || '0');
        
        if (!articleId) {
          return NextResponse.json(
            { error: "Invalid article ID" },
            { status: 400 }
          );
        }

        const progress = articleGenerationService.getGenerationProgress(articleId);
        
        if (!progress) {
          return NextResponse.json(
            { error: "No generation in progress for this article" },
            { status: 404 }
          );
        }

        return NextResponse.json(progress);

      } catch (error) {
        console.error('Get generation status error:', error);
        return NextResponse.json(
          { error: 'Failed to get generation status' },
          { status: 500 }
        );
      }
    });
    ```

  - [ ] 3.3 Update scheduling API route to use SchedulingService

    - Update `src/app/api/articles/[id]/schedule/route.ts` to use SchedulingService
    - Simplify the route by delegating to the service
    - _Requirements: 10.1, 10.2, 10.8_

    ```typescript
    // src/app/api/articles/[id]/schedule/route.ts
    import { NextRequest, NextResponse } from "next/server";
    import { withAuth } from "@/lib/auth";
    import { schedulingService } from "@/lib/services/scheduling-service";

    export const POST = withAuth(async (req: NextRequest, userId: string) => {
      try {
        const articleId = parseInt(req.url.split('/').slice(-2)[0] || '0');
        const body = await req.json();
        
        const updatedArticle = await schedulingService.scheduleArticle({
          id: articleId,
          scheduledAt: body.scheduledAt,
          status: body.status || 'scheduled',
        });

        return NextResponse.json(updatedArticle);

      } catch (error) {
        console.error('Schedule article error:', error);
        return NextResponse.json(
          { error: error instanceof Error ? error.message : 'Failed to schedule article' },
          { status: 500 }
        );
      }
    });
    ```

  - [ ] 3.4 Create cron job API route using SchedulingService

    - Create `src/app/api/cron/publish-articles/route.ts` that uses SchedulingService
    - Implement automated publishing logic
    - _Requirements: 12.1, 12.2, 12.3, 12.4_

    ```typescript
    // src/app/api/cron/publish-articles/route.ts
    import { NextRequest, NextResponse } from "next/server";
    import { schedulingService } from "@/lib/services/scheduling-service";

    export async function POST(req: NextRequest) {
      try {
        const publishedArticles = await schedulingService.publishScheduledArticles();
        
        console.log(`Published ${publishedArticles.length} articles`);
        
        return NextResponse.json({
          success: true,
          publishedCount: publishedArticles.length,
          publishedArticles: publishedArticles.map(a => ({ id: a.id, title: a.title })),
        });

      } catch (error) {
        console.error('Cron job error:', error);
        return NextResponse.json(
          { error: 'Failed to publish scheduled articles' },
          { status: 500 }
        );
      }
    }
    ```

- [ ] 4. Maintain backward compatibility with existing routes

  - [ ] 4.1 Update existing research route to use ResearchService

    - Modify existing `/research/route.ts` to use the new ResearchService
    - Maintain the same API interface for backward compatibility
    - _Requirements: 3.1, 3.2_

    ```typescript
    // Update existing research route to use service
    import { NextResponse } from 'next/server';
    import { researchService } from '@/lib/services/research-service';

    export async function POST(request: Request) {
      try {
        const body = await request.json();
        const result = await researchService.conductResearch(body);
        return NextResponse.json(result);
      } catch (error) {
        console.error('Research endpoint error:', error);
        return NextResponse.json(
          { error: error instanceof Error ? error.message : 'Failed to conduct research' },
          { status: 500 }
        );
      }
    }
    ```

  - [ ] 4.2 Update existing write route to use WritingService

    - Modify existing `/write/route.ts` to use the new WritingService
    - Maintain the same API interface for backward compatibility
    - _Requirements: 4.1, 4.2_

  - [ ] 4.3 Update existing validate route to use ValidationService

    - Modify existing `/validate/route.ts` to use the new ValidationService
    - Maintain the same API interface for backward compatibility
    - _Requirements: 3.3, 3.4_

  - [ ] 4.4 Update existing update route to use UpdateService

    - Modify existing `/update/route.ts` to use the new UpdateService
    - Maintain the same API interface for backward compatibility
    - _Requirements: 4.6_

  - [ ] 4.5 Update existing schedule route to use SchedulingService

    - Modify existing `/schedule/route.ts` to use the new SchedulingService
    - Maintain the same API interface for backward compatibility
    - _Requirements: 10.1, 10.2_

- [ ] 5. Implement kanban board system and article management

  - [ ] 2.1 Create article data models and database schema

    - Extend database schema to include articles table with kanban status tracking:

      ```typescript
      // Add to src/server/db/schema.ts
      export const articleStatusEnum = pgEnum("article_status", [
        "idea",
        "to_generate", 
        "generating",
        "wait_for_publish",
        "published",
      ]);

      export const articlePriorityEnum = pgEnum("article_priority", [
        "low",
        "medium", 
        "high",
      ]);

      export const articles = pgTable("articles", {
        id: serial("id").primaryKey(),
        projectId: integer("project_id")
          .notNull()
          .references(() => projects.id, { onDelete: "cascade" }),
        title: varchar("title", { length: 255 }).notNull(),
        description: text("description"),
        keywords: jsonb("keywords").default([]).notNull(),
        targetAudience: varchar("target_audience", { length: 255 }),
        status: articleStatusEnum("status").default("idea").notNull(),
        scheduledPublishAt: timestamp("scheduled_publish_at"),
        publishedAt: timestamp("published_at"),
        priority: articlePriorityEnum("priority").default("medium").notNull(),
        estimatedReadTime: integer("estimated_read_time"),
        kanbanPosition: integer("kanban_position").default(0).notNull(),
        
        // Content fields (populated after generation)
        metaDescription: varchar("meta_description", { length: 255 }),
        outline: jsonb("outline"),
        draft: text("draft"),
        optimizedContent: text("optimized_content"),
        factCheckReport: jsonb("fact_check_report").default({}).notNull(),
        seoScore: integer("seo_score"),
        internalLinks: jsonb("internal_links").default([]).notNull(),
        sources: jsonb("sources").default([]).notNull(),
        
        // Generation tracking
        generationTaskId: varchar("generation_task_id"),
        generationStartedAt: timestamp("generation_started_at"),
        generationCompletedAt: timestamp("generation_completed_at"),
        generationError: text("generation_error"),
        
        createdAt: timestamp("created_at").defaultNow().notNull(),
        updatedAt: timestamp("updated_at").defaultNow().notNull(),
      });

      export const articlesRelations = relations(articles, ({ one }) => ({
        project: one(projects, {
          fields: [articles.projectId],
          references: [projects.id],
        }),
      }));

      export const publishingSchedules = pgTable("publishing_schedules", {
        id: serial("id").primaryKey(),
        articleId: integer("article_id")
          .notNull()
          .references(() => articles.id, { onDelete: "cascade" }),
        scheduledAt: timestamp("scheduled_at").notNull(),
        status: varchar("status", { length: 20 }).default("scheduled").notNull(),
        publishedAt: timestamp("published_at"),
        error: text("error"),
        retryCount: integer("retry_count").default(0).notNull(),
        createdAt: timestamp("created_at").defaultNow().notNull(),
        updatedAt: timestamp("updated_at").defaultNow().notNull(),
      });

      export const publishingSchedulesRelations = relations(publishingSchedules, ({ one }) => ({
        article: one(articles, {
          fields: [publishingSchedules.articleId],
          references: [articles.id],
        }),
      }));
      ```

    - Create TypeScript types for articles and kanban:

      ```typescript
      // Add to src/types.ts
      export interface Article {
        id: number;
        projectId: number;
        title: string;
        description?: string;
        keywords: string[];
        targetAudience?: string;
        status: 'idea' | 'to_generate' | 'generating' | 'wait_for_publish' | 'published';
        scheduledPublishAt?: Date;
        publishedAt?: Date;
        priority: 'low' | 'medium' | 'high';
        estimatedReadTime?: number;
        kanbanPosition: number;
        
        // Content fields
        metaDescription?: string;
        outline?: any;
        draft?: string;
        optimizedContent?: string;
        factCheckReport?: any;
        seoScore?: number;
        internalLinks?: any[];
        sources?: any[];
        
        // Generation tracking
        generationTaskId?: string;
        generationStartedAt?: Date;
        generationCompletedAt?: Date;
        generationError?: string;
        
        createdAt: Date;
        updatedAt: Date;
      }

      export interface KanbanColumn {
        id: string;
        title: string;
        status: Article['status'];
        articles: Article[];
        color: string;
        maxArticles?: number;
      }

      export interface PublishingSchedule {
        id: number;
        articleId: number;
        scheduledAt: Date;
        status: 'scheduled' | 'published' | 'failed';
        publishedAt?: Date;
        error?: string;
        retryCount: number;
        createdAt: Date;
        updatedAt: Date;
      }
      ```

    - Generate and run database migrations
    - _Requirements: 8.1, 8.2, 9.1, 10.1, 11.1_

  - [ ] 2.2 Create article repository and basic CRUD operations

    - Implement article repository with kanban-specific methods:

      ```typescript
      // src/server/api/repositories/article-repository.ts
      import { db } from "@/server/db";
      import { articles, publishingSchedules } from "@/server/db/schema";
      import { eq, and, desc, asc, lte } from "drizzle-orm";
      import { type Article, type PublishingSchedule } from "@/types";

      export const articleRepository = {
        // Create a new article
        async create(data: Omit<Article, 'id' | 'createdAt' | 'updatedAt'>): Promise<Article> {
          const [article] = await db.insert(articles).values({
            ...data,
            createdAt: new Date(),
            updatedAt: new Date(),
          }).returning();
          return article;
        },

        // Get articles by project ID for kanban board
        async getByProjectId(projectId: number): Promise<Article[]> {
          return db
            .select()
            .from(articles)
            .where(eq(articles.projectId, projectId))
            .orderBy(asc(articles.kanbanPosition), desc(articles.createdAt));
        },

        // Get articles by status
        async getByStatus(projectId: number, status: Article['status']): Promise<Article[]> {
          return db
            .select()
            .from(articles)
            .where(and(eq(articles.projectId, projectId), eq(articles.status, status)))
            .orderBy(asc(articles.kanbanPosition));
        },

        // Update article status and position
        async updateStatus(
          id: number, 
          status: Article['status'], 
          position?: number
        ): Promise<Article | undefined> {
          const updateData: any = { 
            status, 
            updatedAt: new Date() 
          };
          
          if (position !== undefined) {
            updateData.kanbanPosition = position;
          }

          // Set generation timestamps based on status
          if (status === 'generating') {
            updateData.generationStartedAt = new Date();
            updateData.generationError = null;
          } else if (status === 'wait_for_publish') {
            updateData.generationCompletedAt = new Date();
          } else if (status === 'published') {
            updateData.publishedAt = new Date();
          }

          const [article] = await db
            .update(articles)
            .set(updateData)
            .where(eq(articles.id, id))
            .returning();
          return article;
        },

        // Update article content after generation
        async updateContent(id: number, contentData: {
          draft?: string;
          optimizedContent?: string;
          metaDescription?: string;
          outline?: any;
          factCheckReport?: any;
          seoScore?: number;
          internalLinks?: any[];
          sources?: any[];
        }): Promise<Article | undefined> {
          const [article] = await db
            .update(articles)
            .set({
              ...contentData,
              updatedAt: new Date(),
            })
            .where(eq(articles.id, id))
            .returning();
          return article;
        },

        // Get article by ID
        async getById(id: number): Promise<Article | undefined> {
          const [article] = await db
            .select()
            .from(articles)
            .where(eq(articles.id, id));
          return article;
        },

        // Update kanban positions for multiple articles
        async updatePositions(updates: { id: number; position: number }[]): Promise<void> {
          for (const update of updates) {
            await db
              .update(articles)
              .set({ 
                kanbanPosition: update.position,
                updatedAt: new Date()
              })
              .where(eq(articles.id, update.id));
          }
        },

        // Get articles scheduled for publishing (past due)
        async getScheduledForPublishing(): Promise<Article[]> {
          const now = new Date();
          return db
            .select()
            .from(articles)
            .where(
              and(
                eq(articles.status, 'wait_for_publish'),
                lte(articles.scheduledPublishAt, now)
              )
            );
        },

        // Schedule article for publishing
        async scheduleForPublishing(id: number, publishAt: Date): Promise<Article | undefined> {
          const [article] = await db
            .update(articles)
            .set({
              scheduledPublishAt: publishAt,
              updatedAt: new Date(),
            })
            .where(eq(articles.id, id))
            .returning();
          return article;
        },

        // Delete article
        async delete(id: number): Promise<boolean> {
          const result = await db
            .delete(articles)
            .where(eq(articles.id, id));
          return result.rowCount > 0;
        },

        // Update generation tracking
        async updateGenerationTracking(id: number, data: {
          generationTaskId?: string;
          generationError?: string;
        }): Promise<Article | undefined> {
          const [article] = await db
            .update(articles)
            .set({
              ...data,
              updatedAt: new Date(),
            })
            .where(eq(articles.id, id))
            .returning();
          return article;
        },
      };
      ```

    - _Requirements: 8.1, 8.2, 9.1, 11.1_

  - [ ] 2.3 Implement kanban board API routes

    - Create kanban board API endpoints:

      ```typescript
      // src/app/api/kanban/[projectId]/route.ts
      import { NextRequest, NextResponse } from "next/server";
      import { withAuth } from "@/lib/auth";
      import { articleRepository } from "@/server/api/repositories/article-repository";
      import { projectRepository } from "@/server/api/repositories/project-repository";
      import { z } from "zod";
      import { type KanbanColumn } from "@/types";

      // GET /api/kanban/[projectId] - Get kanban board for project
      export const GET = withAuth(async (req: NextRequest, userId: string) => {
        const projectId = parseInt(req.url.split('/').slice(-2)[0] || '0');
        
        // Verify project access
        const project = await projectRepository.getById(projectId, userId);
        if (!project) {
          return NextResponse.json(
            { error: "Project not found" },
            { status: 404 }
          );
        }

        // Get all articles for the project
        const articles = await articleRepository.getByProjectId(projectId);

        // Group articles by status into kanban columns
        const columns: KanbanColumn[] = [
          {
            id: 'idea',
            title: 'Ideas',
            status: 'idea',
            articles: articles.filter(a => a.status === 'idea'),
            color: '#e2e8f0',
          },
          {
            id: 'to_generate',
            title: 'To Generate',
            status: 'to_generate',
            articles: articles.filter(a => a.status === 'to_generate'),
            color: '#fef3c7',
          },
          {
            id: 'wait_for_publish',
            title: 'Wait for Publish',
            status: 'wait_for_publish',
            articles: articles.filter(a => a.status === 'wait_for_publish'),
            color: '#dbeafe',
          },
          {
            id: 'published',
            title: 'Published',
            status: 'published',
            articles: articles.filter(a => a.status === 'published'),
                color: '#dcfce7',
            color: '#dcfce7',
          },
        ];

        return NextResponse.json(columns);
      });
      ```

      ```typescript
      // src/app/api/articles/route.ts
      import { NextRequest, NextResponse } from "next/server";
      import { withAuth } from "@/lib/auth";
      import { articleRepository } from "@/server/api/repositories/article-repository";
      import { projectRepository } from "@/server/api/repositories/project-repository";
      import { z } from "zod";

      const createArticleSchema = z.object({
        projectId: z.number(),
        title: z.string().min(1).max(255),
        description: z.string().optional(),
        keywords: z.array(z.string()).default([]),
        targetAudience: z.string().optional(),
        priority: z.enum(['low', 'medium', 'high']).default('medium'),
      });

      // POST /api/articles - Create new article
      export const POST = withAuth(async (req: NextRequest, userId: string) => {
        const body = await req.json();
        const validatedData = createArticleSchema.parse(body);
        
        // Verify project access
        const project = await projectRepository.getById(validatedData.projectId, userId);
        if (!project) {
          return NextResponse.json(
            { error: "Project not found" },
            { status: 404 }
          );
        }

        // Get current max position for ideas
        const existingArticles = await articleRepository.getByStatus(validatedData.projectId, 'idea');
        const maxPosition = Math.max(...existingArticles.map(a => a.kanbanPosition), -1);

        const article = await articleRepository.create({
          ...validatedData,
          status: 'idea',
          kanbanPosition: maxPosition + 1,
        });

        return NextResponse.json(article, { status: 201 });
      });
      ```

      ```typescript
      // src/app/api/articles/[id]/move/route.ts
      import { NextRequest, NextResponse } from "next/server";
      import { withAuth } from "@/lib/auth";
      import { articleRepository } from "@/server/api/repositories/article-repository";
      import { projectRepository } from "@/server/api/repositories/project-repository";
      import { z } from "zod";

      const moveArticleSchema = z.object({
        newStatus: z.enum(['idea', 'to_generate', 'wait_for_publish', 'published']),
        newPosition: z.number(),
      });

      // PUT /api/articles/[id]/move - Move article between columns
      export const PUT = withAuth(async (req: NextRequest, userId: string) => {
        const articleId = parseInt(req.url.split('/').slice(-3)[0] || '0');
        const body = await req.json();
        const { newStatus, newPosition } = moveArticleSchema.parse(body);
        
        // Get article and verify access
        const article = await articleRepository.getById(articleId);
        if (!article) {
          return NextResponse.json(
            { error: "Article not found" },
            { status: 404 }
          );
        }

        const project = await projectRepository.getById(article.projectId, userId);

      // POST /api/kanban/move-article - Move article between columns
      export const POST = withAuth(async (req: NextRequest, userId: string) => {
        const moveArticleSchema = z.object({
          articleId: z.number(),
          newStatus: z.enum(['idea', 'to_generate', 'wait_for_publish', 'published']),
          newPosition: z.number(),
        });

        const body = await req.json();
        const { articleId, newStatus, newPosition } = moveArticleSchema.parse(body);

        // Get article and verify access
        const article = await articleRepository.getById(articleId);
        if (!article) {
          return NextResponse.json(
            { error: "Article not found" },
            { status: 404 }
          );
        }

        const project = await projectRepository.getById(article.projectId, userId);
        if (!project) {
          return NextResponse.json(
            { error: "Access denied" },
            { status: 403 }
          );
        }

        // Handle special logic for moving to "to_generate"
        if (newStatus === 'to_generate' && article.status !== 'to_generate') {
          // This will trigger article generation
          // For now, just update status - generation will be handled by a separate service
          const updatedArticle = await articleRepository.updateStatus(
            articleId,
            'generating', // Set to generating immediately
            newPosition
          );

          // TODO: Trigger article generation job here
          // await articleGenerationService.startGeneration(articleId);

          return NextResponse.json(updatedArticle);
        }

        // Regular status update
        const updatedArticle = await articleRepository.updateStatus(
          articleId,
          newStatus,
          newPosition
        );

        return NextResponse.json(updatedArticle);
      }),

      // PUT /api/articles/[id] - Update article details
      export const PUT = withAuth(async (req: NextRequest, userId: string) => {
        const updateArticleSchema = z.object({
          title: z.string().min(1).max(255).optional(),
          description: z.string().optional(),
          keywords: z.array(z.string()).optional(),
          targetAudience: z.string().optional(),
          priority: z.enum(['low', 'medium', 'high']).optional(),
        });

        const articleId = parseInt(req.url.split('/').pop() || '0');
        const body = await req.json();
        const updateData = updateArticleSchema.parse(body);
        
        // Get article and verify access
        const article = await articleRepository.getById(articleId);
        if (!article) {
          return NextResponse.json(
            { error: "Article not found" },
            { status: 404 }
          );
        }

        const project = await projectRepository.getById(article.projectId, userId);
        if (!project) {
          return NextResponse.json(
            { error: "Access denied" },
            { status: 403 }
          );
        }

        // Update article (this would need to be implemented in the repository)
        const updatedArticle = await articleRepository.update(articleId, updateData);
        return NextResponse.json(updatedArticle);
      }),

      // DELETE /api/articles/[id] - Delete article
      export const DELETE = withAuth(async (req: NextRequest, userId: string) => {
        const articleId = parseInt(req.url.split('/').pop() || '0');
        
        // Get article and verify access
        const article = await articleRepository.getById(articleId);
        if (!article) {
          return NextResponse.json(
            { error: "Article not found" },
            { status: 404 }
          );
        }

        const project = await projectRepository.getById(article.projectId, userId);
        if (!project) {
          return NextResponse.json(
            { error: "Access denied" },
            { status: 403 }
          );
        }

        const success = await articleRepository.delete(articleId);
        return NextResponse.json({ success });
      }),

      // POST /api/articles/[id]/schedule - Schedule article for publishing
      export const POST = withAuth(async (req: NextRequest, userId: string) => {
        const scheduleArticleSchema = z.object({
          publishAt: z.string().datetime(),
        });

        const articleId = parseInt(req.url.split('/').slice(-2)[0] || '0');
        const body = await req.json();
        const { publishAt } = scheduleArticleSchema.parse(body);
        
        // Get article and verify access
        const article = await articleRepository.getById(articleId);
        if (!article) {
          return NextResponse.json(
            { error: "Article not found" },
            { status: 404 }
          );
        }

        const project = await projectRepository.getById(article.projectId, userId);
        if (!project) {
          return NextResponse.json(
            { error: "Access denied" },
            { status: 403 }
          );
        }

        if (article.status !== 'wait_for_publish') {
          return NextResponse.json(
            { error: "Only articles in 'Wait for Publish' status can be scheduled" },
            { status: 400 }
          );
        }

        const updatedArticle = await articleRepository.scheduleForPublishing(
          articleId,
          new Date(publishAt)
        );

        return NextResponse.json(updatedArticle);
      }),
      });
      ```

    - Create API client utilities for kanban operations:

      ```typescript
      // Add to src/lib/api-client.ts
      export class ApiClient {
        // ... existing methods ...

        // Kanban methods
        async getKanbanBoard(projectId: number) {
          return this.request(`/kanban/board?projectId=${projectId}`);
        }

        async createArticle(projectId: number, articleData: any) {
          return this.request('/kanban/articles', {
            method: 'POST',
            body: JSON.stringify({ projectId, ...articleData }),
          });
        }

        async moveArticle(articleId: number, newStatus: string, newPosition: number) {
          return this.request('/kanban/move-article', {
            method: 'POST',
            body: JSON.stringify({ articleId, newStatus, newPosition }),
          });
        }

        async updateArticle(articleId: number, updateData: any) {
          return this.request(`/articles/${articleId}`, {
            method: 'PUT',
            body: JSON.stringify(updateData),
          });
        }

        async deleteArticle(articleId: number) {
          return this.request(`/articles/${articleId}`, {
            method: 'DELETE',
          });
        }

        async scheduleArticle(articleId: number, publishAt: string) {
          return this.request(`/articles/${articleId}/schedule`, {
            method: 'POST',
            body: JSON.stringify({ publishAt }),
          });
        }
      }
      ```

    - _Requirements: 8.1, 8.2, 8.7, 9.1, 10.1, 10.4_

  - [ ] 2.4 Create kanban board UI components

    - Implement kanban board React components:

      ```typescript
      // src/components/kanban-board.tsx
      'use client';

      import { useState } from 'react';
      import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
      import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
      import { Badge } from '@/components/ui/badge';
      import { Button } from '@/components/ui/button';
      import { Plus, Calendar, Clock, Target } from 'lucide-react';
      import { api } from '@/trpc/react';
      import { type KanbanColumn, type Article } from '@/types';
      import { ArticleCard } from './article-card';
      import { CreateArticleModal } from './create-article-modal';

      interface KanbanBoardProps {
        projectId: number;
      }

      export function KanbanBoard({ projectId }: KanbanBoardProps) {
        const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
        
        const [columns, setColumns] = useState<KanbanColumn[]>([]);
        const [isLoading, setIsLoading] = useState(true);

        const fetchKanbanBoard = async () => {
          try {
            const data = await apiClient.getKanbanBoard(projectId);
            setColumns(data);
          } catch (error) {
            toast.error('Failed to load kanban board');
          } finally {
            setIsLoading(false);
          }
        };

        useEffect(() => {
          fetchKanbanBoard();
        }, [projectId]);

        const moveArticle = async (articleId: number, newStatus: string, newPosition: number) => {
          try {
            await apiClient.moveArticle(articleId, newStatus, newPosition);
            await fetchKanbanBoard(); // Refresh the board
          } catch (error) {
            toast.error('Failed to move article');
          }
        };

        const handleDragEnd = (result: DropResult) => {
          if (!result.destination || !columns) return;

          const { source, destination, draggableId } = result;
          
          // If dropped in the same position, do nothing
          if (source.droppableId === destination.droppableId && source.index === destination.index) {
            return;
          }

          const articleId = parseInt(draggableId);
          const newStatus = destination.droppableId as Article['status'];
          
          moveArticle(articleId, newStatus, destination.index);
        };

        if (isLoading) {
          return <div>Loading...</div>;
        }

        return (
          <div className="h-full">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold">Article Pipeline</h2>
              <Button onClick={() => setIsCreateModalOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                New Article Idea
              </Button>
            </div>

            <DragDropContext onDragEnd={handleDragEnd}>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {columns.map((column) => (
                  <div key={column.id} className="flex flex-col">
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold text-lg">{column.title}</h3>
                        <Badge variant="secondary">{column.articles.length}</Badge>
                      </div>
                      <div 
                        className="h-1 rounded-full"
                        style={{ backgroundColor: column.color }}
                      />
                    </div>

                    <Droppable droppableId={column.status}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className={`flex-1 min-h-[200px] p-2 rounded-lg transition-colors ${
                            snapshot.isDraggingOver ? 'bg-gray-100' : 'bg-gray-50'
                          }`}
                        >
                          {column.articles.map((article, index) => (
                            <Draggable
                              key={article.id}
                              draggableId={article.id.toString()}
                              index={index}
                            >
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  className={`mb-3 ${
                                    snapshot.isDragging ? 'rotate-2' : ''
                                  }`}
                                >
                                  <ArticleCard article={article} />
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </div>
                ))}
              </div>
            </DragDropContext>

            <CreateArticleModal
              projectId={projectId}
              isOpen={isCreateModalOpen}
              onClose={() => setIsCreateModalOpen(false)}
              onSuccess={() => {
                setIsCreateModalOpen(false);
                refetch();
              }}
            />
          </div>
        );
      }
      ```

    - Create article card component:

      ```typescript
      // src/components/article-card.tsx
      import { Card, CardContent, CardHeader } from '@/components/ui/card';
      import { Badge } from '@/components/ui/badge';
      import { Button } from '@/components/ui/button';
      import { Calendar, Clock, Target, MoreHorizontal } from 'lucide-react';
      import { type Article } from '@/types';
      import { formatDistanceToNow } from 'date-fns';

      interface ArticleCardProps {
        article: Article;
      }

      export function ArticleCard({ article }: ArticleCardProps) {
        const getPriorityColor = (priority: Article['priority']) => {
          switch (priority) {
            case 'high': return 'bg-red-100 text-red-800';
            case 'medium': return 'bg-yellow-100 text-yellow-800';
            case 'low': return 'bg-green-100 text-green-800';
            default: return 'bg-gray-100 text-gray-800';
          }
        };

        const getStatusIcon = () => {
          switch (article.status) {
            case 'generating':
              return <Clock className="h-4 w-4 animate-spin" />;
            case 'wait_for_publish':
              return <Calendar className="h-4 w-4" />;
            case 'published':
              return <Target className="h-4 w-4" />;
            default:
              return null;
          }
        };

        return (
          <Card className="cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <h4 className="font-medium text-sm line-clamp-2">{article.title}</h4>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                  <MoreHorizontal className="h-3 w-3" />
                </Button>
              </div>
            </CardHeader>
            
            <CardContent className="pt-0">
              {article.description && (
                <p className="text-xs text-gray-600 mb-3 line-clamp-2">
                  {article.description}
                </p>
              )}

              <div className="flex flex-wrap gap-1 mb-3">
                {article.keywords.slice(0, 3).map((keyword) => (
                  <Badge key={keyword} variant="outline" className="text-xs">
                    {keyword}
                  </Badge>
                ))}
                {article.keywords.length > 3 && (
                  <Badge variant="outline" className="text-xs">
                    +{article.keywords.length - 3}
                  </Badge>
                )}
              </div>

              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  {getStatusIcon()}
                  <Badge className={getPriorityColor(article.priority)}>
                    {article.priority}
                  </Badge>
                </div>
                
                <span className="text-gray-500">
                  {formatDistanceToNow(article.createdAt, { addSuffix: true })}
                </span>
              </div>

              {article.scheduledPublishAt && (
                <div className="mt-2 text-xs text-blue-600 flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Scheduled: {new Date(article.scheduledPublishAt).toLocaleDateString()}
                </div>
              )}

              {article.status === 'generating' && (
                <div className="mt-2">
                  <div className="w-full bg-gray-200 rounded-full h-1">
                    <div className="bg-blue-600 h-1 rounded-full animate-pulse" style={{ width: '60%' }} />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Generating content...</p>
                </div>
              )}
            </CardContent>
          </Card>
        );
      }
      ```

    - Create article creation modal:

      ```typescript
      // src/components/create-article-modal.tsx
      import { useState } from 'react';
      import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
      import { Button } from '@/components/ui/button';
      import { Input } from '@/components/ui/input';
      import { Textarea } from '@/components/ui/textarea';
      import { Label } from '@/components/ui/label';
      import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
      import { Badge } from '@/components/ui/badge';
      import { X } from 'lucide-react';
      import { toast } from 'sonner';
      import { apiClient } from '@/lib/api-client';

      interface CreateArticleModalProps {
        projectId: number;
        isOpen: boolean;
        onClose: () => void;
        onSuccess: () => void;
      }

      export function CreateArticleModal({ projectId, isOpen, onClose, onSuccess }: CreateArticleModalProps) {
        const [title, setTitle] = useState('');
        const [description, setDescription] = useState('');
        const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
        const [targetAudience, setTargetAudience] = useState('');
        const [keywords, setKeywords] = useState<string[]>([]);
        const [keywordInput, setKeywordInput] = useState('');
        const [isSubmitting, setIsSubmitting] = useState(false);

        const createArticle = async (articleData: any) => {
          setIsSubmitting(true);
          try {
            await apiClient.createArticle(projectId, articleData);
            toast.success('Article idea created successfully!');
            resetForm();
            onSuccess();
          } catch (error) {
            toast.error('Failed to create article idea');
          } finally {
            setIsSubmitting(false);
          }
        };

        const resetForm = () => {
          setTitle('');
          setDescription('');
          setPriority('medium');
          setTargetAudience('');
          setKeywords([]);
          setKeywordInput('');
        };

        const handleAddKeyword = () => {
          if (keywordInput.trim() && !keywords.includes(keywordInput.trim())) {
            setKeywords([...keywords, keywordInput.trim()]);
            setKeywordInput('');
          }
        };

        const handleRemoveKeyword = (keyword: string) => {
          setKeywords(keywords.filter(k => k !== keyword));
        };

        const handleSubmit = (e: React.FormEvent) => {
          e.preventDefault();
          
          if (!title.trim()) {
            toast.error('Title is required');
            return;
          }

          createArticle({
            projectId,
            title: title.trim(),
            description: description.trim() || undefined,
            keywords,
            targetAudience: targetAudience.trim() || undefined,
            priority,
          });
        };

        const handleKeywordKeyPress = (e: React.KeyboardEvent) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            handleAddKeyword();
          }
        };

        return (
          <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Create New Article Idea</DialogTitle>
              </DialogHeader>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="title">Title *</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Enter article title..."
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Brief description of the article..."
                    rows={3}
                  />
                </div>

                <div>
                  <Label htmlFor="target-audience">Target Audience</Label>
                  <Input
                    id="target-audience"
                    value={targetAudience}
                    onChange={(e) => setTargetAudience(e.target.value)}
                    placeholder="e.g., Software developers, Marketing managers..."
                  />
                </div>

                <div>
                  <Label htmlFor="priority">Priority</Label>
                  <Select value={priority} onValueChange={(value: 'low' | 'medium' | 'high') => setPriority(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="keywords">Keywords</Label>
                  <div className="flex gap-2 mb-2">
                    <Input
                      id="keywords"
                      value={keywordInput}
                      onChange={(e) => setKeywordInput(e.target.value)}
                      onKeyPress={handleKeywordKeyPress}
                      placeholder="Add keyword and press Enter..."
                    />
                    <Button type="button" onClick={handleAddKeyword} variant="outline">
                      Add
                    </Button>
                  </div>
                  
                  {keywords.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {keywords.map((keyword) => (
                        <Badge key={keyword} variant="secondary" className="flex items-center gap-1">
                          {keyword}
                          <X 
                            className="h-3 w-3 cursor-pointer" 
                            onClick={() => handleRemoveKeyword(keyword)}
                          />
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={onClose}>
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createArticleMutation.isLoading}
                  >
                    {createArticleMutation.isLoading ? 'Creating...' : 'Create Article'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        );
      }
      ```

    - Install required dependencies:

      ```bash
      npm install @hello-pangea/dnd date-fns
      ```

    - _Requirements: 8.1, 8.2, 8.3, 8.7_

- [ ] 3. Implement task queue system

  - [ ] 3.1 Create job queue infrastructure

    - Implement queue data models
    - Create job processing service
    - Set up worker processes
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [ ] 3.2 Implement retry logic and error handling

    - Create exponential backoff mechanism
    - Implement circuit breaker pattern
    - Add error logging and monitoring
    - _Requirements: 7.3, 13.2, 8.4, 8.5_

  - [ ] 2.3 Build task prioritization system

    - Implement priority queue logic
    - Create resource allocation algorithms
    - Add load balancing capabilities
    - _Requirements: 7.4, 7.5, 7.6_

  - [ ] 2.4 Create task dependency management
    - Implement task dependency graph
    - Create task triggering mechanism
    - Add task completion tracking
    - _Requirements: 2.3, 2.4, 7.6_

- [ ] 3. Develop external API integration layer

  - [ ] 3.1 Implement Google Custom Search API connector

    - Create API client with authentication
    - Implement search query builder
    - Add response parsing and normalization
    - _Requirements: 3.1, 5.1, 5.5, 5.6_

  - [ ] 3.2 Build Google Search Console API integration

    - Set up OAuth authentication
    - Create keyword analysis functions
    - Implement demand testing capabilities
    - _Requirements: 1.1, 1.5, 5.1, 5.5, 5.6_

  - [ ] 3.3 Integrate with SEO tools APIs

    - Create modular API client architecture
    - Implement connectors for SEMrush/Ahrefs/Moz
    - Add data normalization layer
    - _Requirements: 1.2, 5.3, 5.4, 5.5, 5.6_

  - [ ] 3.4 Build web scraping service
    - Create headless browser scraping infrastructure
    - Implement content extraction algorithms
    - Add rate limiting and IP rotation
    - _Requirements: 3.1, 5.2, 8.1_

- [ ] 4. Implement AI agent framework

  - [ ] 4.1 Create base agent infrastructure

    - Design agent interface and abstract classes
    - Implement common agent functionality
    - Create agent registry and factory
    - _Requirements: 2.1, 2.2, 2.3_

  - [ ] 4.2 Integrate Google Gemini AI

    - Set up Gemini API client
    - Create prompt engineering utilities
    - Implement grounding capabilities
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 3.1, 3.3_

  - [ ] 4.3 Integrate Claude Sonnet

    - Set up Claude API client
    - Create content generation utilities
    - Implement content quality evaluation
    - _Requirements: 4.1, 4.5, 4.6_

  - [ ] 4.4 Build agent communication protocol
    - Design message format and schema
    - Implement pub/sub messaging system
    - Create agent coordination utilities
    - _Requirements: 2.3, 2.4, 2.7_

- [ ] 5. Develop specialized agents

  - [ ] 5.1 Implement Website Analysis Agent

    - Create website scraping and content extraction functionality:

      ```typescript
      // src/lib/agents/website-analysis-agent.ts
      import { BaseAgent } from "./base-agent";
      import { generateWithGemini } from "../gemini-client";
      import * as cheerio from "cheerio";
      import { z } from "zod";

      // Define the schema for website analysis results
      const WebsiteMetadataSchema = z.object({
        title: z.string(),
        description: z.string(),
        keywords: z.array(z.string()).optional(),
        language: z.string().optional(),
        author: z.string().optional(),
        ogTitle: z.string().optional(),
        ogDescription: z.string().optional(),
        ogImage: z.string().optional(),
        favicon: z.string().optional(),
      });

      const WebsiteContentSchema = z.object({
        mainHeadings: z.array(z.string()),
        subHeadings: z.array(z.string()),
        paragraphs: z.array(z.string()),
        links: z.array(
          z.object({
            text: z.string(),
            href: z.string(),
          }),
        ),
        images: z.array(
          z.object({
            alt: z.string().optional(),
            src: z.string(),
          }),
        ),
      });

      export class WebsiteAnalysisAgent extends BaseAgent {
        constructor() {
          super("WebsiteAnalysisAgent");
        }

        async processTask(task: any) {
          const { websiteUrl } = task.input;

          // Step 1: Scrape website content
          const scrapedContent = await this.scrapeWebsite(websiteUrl);

          // Step 2: Extract website metadata
          const metadata = await this.extractWebsiteMetadata(
            scrapedContent,
            websiteUrl,
          );

          // Step 3: Analyze website content
          const contentAnalysis =
            await this.analyzeWebsiteContent(scrapedContent);

          // Step 4: Identify target audience
          const audienceProfile = await this.identifyTargetAudience(
            metadata,
            contentAnalysis,
          );

          // Step 5: Generate article settings
          const articleSettings = await this.generateArticleSettings(
            metadata,
            contentAnalysis,
            audienceProfile,
          );

          // Step 6: Validate and refine settings
          const validatedSettings =
            await this.validateSettings(articleSettings);

          return {
            metadata,
            contentAnalysis,
            audienceProfile,
            articleSettings: validatedSettings,
          };
        }

        async scrapeWebsite(url: string) {
          try {
            // Fetch the website content
            const response = await fetch(url, {
              headers: {
                "User-Agent": "Mozilla/5.0 (compatible; AISEOWriter/1.0)",
              },
            });

            if (!response.ok) {
              throw new Error(`Failed to fetch ${url}: ${response.status}`);
            }

            const html = await response.text();
            const $ = cheerio.load(html);

            // Extract metadata
            const metadata = {
              title: $("title").text().trim(),
              description: $('meta[name="description"]').attr("content") || "",
              keywords:
                $('meta[name="keywords"]')
                  .attr("content")
                  ?.split(",")
                  .map((k) => k.trim()) || [],
              language: $("html").attr("lang") || "en",
              author: $('meta[name="author"]').attr("content") || "",
              ogTitle: $('meta[property="og:title"]').attr("content") || "",
              ogDescription:
                $('meta[property="og:description"]').attr("content") || "",
              ogImage: $('meta[property="og:image"]').attr("content") || "",
              favicon:
                $('link[rel="icon"]').attr("href") ||
                $('link[rel="shortcut icon"]').attr("href") ||
                "",
            };

            // Extract content
            const content = {
              mainHeadings: $("h1")
                .map((_, el) => $(el).text().trim())
                .get(),
              subHeadings: $("h2, h3")
                .map((_, el) => $(el).text().trim())
                .get(),
              paragraphs: $("p")
                .map((_, el) => $(el).text().trim())
                .get(),
              links: $("a")
                .map((_, el) => ({
                  text: $(el).text().trim(),
                  href: $(el).attr("href") || "",
                }))
                .get(),
              images: $("img")
                .map((_, el) => ({
                  alt: $(el).attr("alt") || "",
                  src: $(el).attr("src") || "",
                }))
                .get(),
            };

            // Extract blog posts or articles if available
            const blogPosts = [];
            $("article, .post, .blog-post, .entry").each((_, el) => {
              const postTitle = $(el)
                .find("h1, h2, h3, .title, .post-title")
                .first()
                .text()
                .trim();
              const postContent = $(el)
                .find("p")
                .map((_, p) => $(p).text().trim())
                .get()
                .join(" ");
              if (postTitle && postContent) {
                blogPosts.push({ title: postTitle, content: postContent });
              }
            });

            return {
              metadata,
              content,
              blogPosts,
              html,
            };
          } catch (error) {
            console.error(`Error scraping ${url}:`, error);
            throw error;
          }
        }

        async extractWebsiteMetadata(scrapedContent: any, websiteUrl: string) {
          // Use the scraped metadata or extract from content if missing
          const { metadata } = scrapedContent;

          // If metadata is incomplete, use Gemini to extract more information
          if (!metadata.description || metadata.description.length < 10) {
            const prompt = `
            Extract key metadata from this website content. The website URL is: ${websiteUrl}
            
            Website content:
            ${scrapedContent.content.mainHeadings.join("\n")}
            ${scrapedContent.content.subHeadings.join("\n")}
            ${scrapedContent.content.paragraphs.slice(0, 10).join("\n")}
            
            Please provide:
            1. A concise website description
            2. Main keywords for the website
            3. The primary language of the content
            4. The likely author or organization behind the website
            
            Format as JSON.
            `;

            const response = await generateWithGemini(prompt);
            const extractedMetadata = JSON.parse(response);

            // Merge with existing metadata
            return {
              ...metadata,
              description:
                metadata.description || extractedMetadata.description,
              keywords: metadata.keywords?.length
                ? metadata.keywords
                : extractedMetadata.keywords,
              language: metadata.language || extractedMetadata.language,
              author: metadata.author || extractedMetadata.author,
            };
          }

          return metadata;
        }

        async analyzeWebsiteContent(scrapedContent: any) {
          const { content, blogPosts } = scrapedContent;

          // Use Gemini to analyze the content
          const prompt = `
          Analyze this website content and extract key information:
          
          Main Headings:
          ${content.mainHeadings.join("\n")}
          
          Sub Headings:
          ${content.subHeadings.join("\n")}
          
          Sample Paragraphs:
          ${content.paragraphs.slice(0, 10).join("\n\n")}
          
          ${
            blogPosts.length > 0
              ? `
    Blog Posts:
    ${blogPosts
      .slice(0, 3)
      .map(
        (post) =>
          `Title: ${post.title}\nExcerpt: ${post.content.substring(0, 200)}...`,
      )
      .join("\n\n")}
    `
              : ""
          }
          
          Please provide:
          1. The main topic/purpose of the website
          2. The industry or niche
          3. The tone and style of writing (formal, casual, technical, etc.)
          4. Key products or services offered
          5. Content themes and categories
          
          Format as JSON.
          `;

          const response = await generateWithGemini(prompt);
          return JSON.parse(response);
        }

        async identifyTargetAudience(metadata: any, contentAnalysis: any) {
          // Use Gemini to identify the target audience
          const prompt = `
          Based on this website information, identify the target audience:
          
          Website Description: ${metadata.description}
          
          Website Keywords: ${metadata.keywords?.join(", ")}
          
          Website Topic: ${contentAnalysis.mainTopic}
          
          Industry: ${contentAnalysis.industry}
          
          Tone and Style: ${contentAnalysis.toneAndStyle}
          
          Products/Services: ${contentAnalysis.productsOrServices}
          
          Please provide:
          1. Primary target country/region
          2. Primary language of the audience
          3. Detailed target audience description (demographics, interests, needs)
          4. Pain points the audience likely faces
          5. How the audience uses the product/service
          
          Format as JSON.
          `;

          const response = await generateWithGemini(prompt);
          return JSON.parse(response);
        }

        async generateArticleSettings(
          metadata: any,
          contentAnalysis: any,
          audienceProfile: any,
        ) {
          // Use Gemini to generate article settings
          const prompt = `
          Generate comprehensive article settings for an AI SEO Writer based on this website analysis:
          
          Website Title: ${metadata.title}
          Website Description: ${metadata.description}
          Website Keywords: ${metadata.keywords?.join(", ")}
          
          Main Topic: ${contentAnalysis.mainTopic}
          Industry: ${contentAnalysis.industry}
          Tone and Style: ${contentAnalysis.toneAndStyle}
          Products/Services: ${contentAnalysis.productsOrServices}
          Content Themes: ${contentAnalysis.contentThemes}
          
          Target Audience:
          Primary Country: ${audienceProfile.primaryTargetCountry}
          Primary Language: ${audienceProfile.primaryLanguage}
          Audience Description: ${audienceProfile.targetAudienceDescription}
          Pain Points: ${audienceProfile.painPoints}
          Product Usage: ${audienceProfile.productUsage}
          
          Please generate complete article settings with these sections:
          
          1. Website Information:
             - productName (the name of the product/service/website)
             - websiteType (e.g., ecommerce, blog, SaaS, etc.)
             - websiteSummary (concise description)
             - blogTheme (main theme for blog content)
             - founders (if identifiable)
             - keyFeatures (list of key features/benefits)
             - pricingPlans (if applicable)
          
          2. Target Audience:
             - primaryTargetCountry
             - primaryLanguage
             - targetAudienceSummary
             - painPoints (list)
             - productUsage
          
          3. Competitors:
             - competitorsToExclude (list of competitors to avoid mentioning)
          
          4. Content Style:
             - brandingTheme
             - languageStyleExamples (2-3 examples of writing style)
          
          5. Content Structure:
             - outlineRequirements
             - introductionRequirements
             - articleSectionRequirements
             - metadataRequirements
          
          6. Call to Action:
             - ctaType
             - ctaTitle
             - ctaDescription
             - ctaButtonText
          
          Format as JSON matching the ArticleSettings interface.
          `;

          const response = await generateWithGemini(prompt);
          return JSON.parse(response);
        }

        async validateSettings(settings: any) {
          // Ensure all required fields are present
          const requiredFields = [
            "productName",
            "websiteType",
            "websiteSummary",
            "blogTheme",
            "primaryTargetCountry",
            "primaryLanguage",
            "targetAudienceSummary",
          ];

          const missingFields = requiredFields.filter(
            (field) => !settings[field],
          );

          if (missingFields.length > 0) {
            // Use Gemini to fill in missing fields
            const prompt = `
            Some required fields are missing from these article settings:
            
            ${JSON.stringify(settings, null, 2)}
            
            Please provide values for these missing fields:
            ${missingFields.join(", ")}
            
            Format as JSON with just the missing fields.
            `;

            const response = await generateWithGemini(prompt);
            const missingValues = JSON.parse(response);

            // Merge with existing settings
            return {
              ...settings,
              ...missingValues,
            };
          }

          return settings;
        }
      }
      ```

    - Build website metadata analysis capabilities:

      ```typescript
      // src/lib/website-analyzer.ts
      import { WebsiteAnalysisAgent } from "./agents/website-analysis-agent";
      import { taskRepository } from "@/server/api/repositories/task-repository";
      import { projectRepository } from "@/server/api/repositories/project-repository";

      export async function analyzeWebsite(
        projectId: number,
        websiteUrl: string,
      ) {
        try {
          // Create a task for website analysis
          const task = await taskRepository.create({
            projectId,
            type: "website_analysis",
            assignedAgent: "website_analysis_agent",
            priority: "high",
            input: {
              websiteUrl,
            },
          });

          // Process the task
          const agent = new WebsiteAnalysisAgent();
          const result = await agent.processTask(task);

          // Update the task with the result
          await taskRepository.update(task.id, {
            status: "completed",
            output: result,
            completedAt: new Date(),
          });

          // Update the project with the article settings
          await projectRepository.updateArticleSettings(
            projectId,
            null, // No userId check in this context
            result.articleSettings,
          );

          return result;
        } catch (error) {
          console.error("Website analysis failed:", error);
          throw error;
        }
      }
      ```

    - Implement target audience identification with advanced AI analysis:

      ```typescript
      // src/lib/audience-analyzer.ts
      import { generateWithGemini } from "./gemini-client";

      export async function analyzeAudience(
        websiteContent: string,
        industryInfo: any,
      ) {
        const prompt = `
        Analyze this website content to identify the target audience:
        
        ${websiteContent.substring(0, 5000)}
        
        Industry information:
        ${JSON.stringify(industryInfo, null, 2)}
        
        Provide a detailed analysis of:
        1. Demographics (age range, gender distribution, income level, education)
        2. Psychographics (interests, values, attitudes, lifestyle)
        3. Behavioral patterns (buying habits, content consumption, device usage)
        4. Pain points and challenges
        5. Goals and aspirations
        
        Format as JSON with these categories.
        `;

        const response = await generateWithGemini(prompt);
        return JSON.parse(response);
      }
      ```

    - Develop article settings generation with comprehensive options:

      ```typescript
      // src/lib/settings-generator.ts
      import { generateWithGemini } from "./gemini-client";
      import { z } from "zod";

      // Define schema for article settings validation
      const ArticleSettingsSchema = z.object({
        // Website Information
        productName: z.string(),
        websiteType: z.string(),
        websiteSummary: z.string(),
        blogTheme: z.string(),
        founders: z.string().optional(),
        keyFeatures: z.array(z.string()).optional(),
        pricingPlans: z.string().optional(),

        // Target Audience
        primaryTargetCountry: z.string(),
        primaryLanguage: z.string(),
        targetAudienceSummary: z.string(),
        painPoints: z.array(z.string()).optional(),
        productUsage: z.string().optional(),

        // Competitors
        competitorsToExclude: z.array(z.string()).optional(),
        competitorWebsitesToExclude: z.array(z.string()).optional(),
        competitorYouTubeChannelsToExclude: z.array(z.string()).optional(),

        // Content Style
        brandingTheme: z.string().optional(),
        languageStyleExamples: z.array(z.string()).optional(),

        // Content Structure
        outlineRequirements: z.string().optional(),
        introductionRequirements: z.string().optional(),
        articleSectionRequirements: z.string().optional(),
        metadataRequirements: z.string().optional(),
        imagePromptRequirements: z.string().optional(),

        // Call to Action
        ctaType: z.string().optional(),
        ctaTitle: z.string().optional(),
        ctaDescription: z.string().optional(),
        ctaButtonUrl: z.string().optional(),
        ctaButtonText: z.string().optional(),
        ctaNote: z.string().optional(),
      });

      export async function generateArticleSettings(
        websiteAnalysis: any,
        audienceProfile: any,
      ) {
        const prompt = `
        Generate comprehensive article settings for an AI SEO Writer based on this website analysis:
        
        Website Analysis:
        ${JSON.stringify(websiteAnalysis, null, 2)}
        
        Audience Profile:
        ${JSON.stringify(audienceProfile, null, 2)}
        
        Create a complete set of article settings with these sections:
        
        1. Website Information:
           - productName: The name of the product/service/website
           - websiteType: Type of website (e.g., ecommerce, blog, SaaS)
           - websiteSummary: Concise description (100-150 words)
           - blogTheme: Main theme for blog content
           - founders: Names of founders if identifiable
           - keyFeatures: List of 3-5 key features/benefits
           - pricingPlans: Brief description of pricing structure if applicable
        
        2. Target Audience:
           - primaryTargetCountry: Main geographic target
           - primaryLanguage: Primary language of the audience
           - targetAudienceSummary: Detailed description (100-150 words)
           - painPoints: List of 3-5 audience pain points
           - productUsage: How the audience uses the product/service
        
        3. Competitors:
           - competitorsToExclude: List of 3-5 competitors to avoid mentioning
           - competitorWebsitesToExclude: List of competitor website URLs
        
        4. Content Style:
           - brandingTheme: Brief description of brand voice and tone
           - languageStyleExamples: 2-3 examples of writing style (1-2 sentences each)
        
        5. Content Structure:
           - outlineRequirements: Guidelines for article outlines
           - introductionRequirements: Guidelines for article introductions
           - articleSectionRequirements: Guidelines for article sections
           - metadataRequirements: Guidelines for meta titles and descriptions
           - imagePromptRequirements: Guidelines for generating image prompts
        
        6. Call to Action:
           - ctaType: Type of CTA (e.g., signup, download, contact)
           - ctaTitle: Title for the CTA
           - ctaDescription: Brief description for the CTA
           - ctaButtonText: Text for the CTA button
        
        Format as JSON matching the ArticleSettings interface.
        `;

        const response = await generateWithGemini(prompt);
        const settings = JSON.parse(response);

        // Validate settings against schema
        return ArticleSettingsSchema.parse(settings);
      }
      ```

    - Add settings validation and refinement:

      ```typescript
      // src/lib/settings-validator.ts
      import { generateWithGemini } from "./gemini-client";

      export async function validateAndRefineSettings(settings: any) {
        // Check for missing required fields
        const requiredFields = [
          "productName",
          "websiteType",
          "websiteSummary",
          "blogTheme",
          "primaryTargetCountry",
          "primaryLanguage",
          "targetAudienceSummary",
        ];

        const missingFields = requiredFields.filter(
          (field) => !settings[field],
        );

        if (missingFields.length > 0) {
          // Generate missing fields
          const prompt = `
          These article settings are missing some required fields:
          
          ${JSON.stringify(settings, null, 2)}
          
          Please generate values for these missing fields:
          ${missingFields.join(", ")}
          
          Format as JSON with just the missing fields.
          `;

          const response = await generateWithGemini(prompt);
          const missingValues = JSON.parse(response);

          // Merge with existing settings
          settings = {
            ...settings,
            ...missingValues,
          };
        }

        // Improve quality of existing fields
        const fieldsToImprove = [
          "websiteSummary",
          "targetAudienceSummary",
          "brandingTheme",
          "outlineRequirements",
        ];

        for (const field of fieldsToImprove) {
          if (settings[field] && settings[field].length < 50) {
            // Field exists but is too short, improve it
            const prompt = `
            Improve this ${field} to be more detailed and useful:
            
            "${settings[field]}"
            
            Provide a more comprehensive and specific version (100-150 words).
            `;

            const response = await generateWithGemini(prompt);
            settings[field] = response.trim();
          }
        }

        // Ensure arrays have at least 3 items
        const arrayFields = [
          "keyFeatures",
          "painPoints",
          "competitorsToExclude",
          "languageStyleExamples",
        ];

        for (const field of arrayFields) {
          if (!settings[field] || settings[field].length < 3) {
            // Generate or expand array field
            const currentItems = settings[field] || [];
            const prompt = `
            Generate additional items for the "${field}" array:
            
            Current items:
            ${currentItems.join("\n")}
            
            Generate ${Math.max(3 - currentItems.length, 0)} more items that would be appropriate for this website:
            ${settings.productName} - ${settings.websiteSummary}
            
            Format as a JSON array of strings.
            `;

            const response = await generateWithGemini(prompt);
            const newItems = JSON.parse(response);

            settings[field] = [...currentItems, ...newItems].slice(0, 5);
          }
        }

        return settings;
      }
      ```

    - _Requirements: 1.1, 1.2, 1.3, 5.2, 5.5_

  - [ ] 5.2 Implement Strategy Agent

    - Create keyword analysis functionality
    - Build competitor analysis capabilities
    - Implement topic tree generation
    - Add demand testing integration
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

  - [ ] 5.3 Build Research Agent

    - Implement topic research capabilities
    - Create source validation functionality
    - Build information cross-validation
    - Add source documentation compilation
    - _Requirements: 3.1, 3.2, 3.5, 3.6_

  - [ ] 5.4 Develop Writing Agent with Claude

    - Create content brief processing
    - Implement outline generation
    - Build article writing capabilities
    - Add headline and meta description generation
    - _Requirements: 4.1, 4.5, 4.6, 4.7_

  - [ ] 5.5 Create SEO Optimization Agent

    - Implement content optimization algorithms
    - Build keyword density analysis
    - Create readability enhancement
    - Add schema markup generation
    - _Requirements: 4.2, 4.4, 4.5_

  - [ ] 5.6 Implement Fact-Checking Agent

    - Create claim extraction functionality
    - Build fact verification capabilities
    - Implement source validation
    - Add correction suggestion generation
    - _Requirements: 3.2, 3.3, 3.4, 3.5_

  - [ ] 5.7 Develop Internal Linking Agent

    - Create content analysis for link opportunities
    - Build link insertion algorithms
    - Implement anchor text optimization
    - Add link relevance scoring
    - _Requirements: 4.3_

  - [ ] 5.8 Build Plan Adjustment Agent
    - Implement error detection capabilities
    - Create alternative plan generation
    - Build resource reallocation logic
    - Add failure recovery strategies
    - _Requirements: 2.6, 8.1, 8.2, 8.3, 8.4, 8.6_

- [ ] 6. Create orchestration engine

  - [ ] 6.1 Implement workflow management

    - Design workflow state machine
    - Create workflow transition logic
    - Implement workflow persistence
    - Add workflow visualization
    - _Requirements: 2.1, 2.2, 2.7, 7.2, 7.6_

  - [ ] 6.2 Build agent coordination system

    - Implement task distribution logic
    - Create result aggregation functionality
    - Build feedback processing system
    - Add quality control mechanisms
    - _Requirements: 2.3, 2.4, 2.5, 2.7_

  - [ ] 6.3 Develop human-in-the-loop integration

    - Create review request generation
    - Implement feedback collection interfaces
    - Build approval workflow integration
    - Add rejection handling logic
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

  - [ ] 6.4 Implement error handling and recovery
    - Create error detection and classification
    - Build recovery strategy selection
    - Implement compensating actions
    - Add monitoring and alerting
    - _Requirements: 8.2, 8.3, 8.4, 8.5, 8.6_

- [ ] 7. Develop user interface

  - [ ] 7.1 Create project management dashboard

    - Implement project creation and configuration
    - Build project listing and filtering
    - Create project status visualization
    - Add project settings management
    - _Requirements: 6.2, 6.3, 6.5_

  - [ ] 7.2 Build content review interface

    - Create content preview components
    - Implement editing capabilities
    - Build approval workflow UI
    - Add feedback submission forms
    - _Requirements: 6.1, 6.3, 6.4, 6.5, 6.6_

  - [ ] 7.3 Develop workflow monitoring UI

    - Create task status visualization
    - Implement progress tracking
    - Build error and warning displays
    - Add intervention controls
    - _Requirements: 6.2, 6.5, 8.5_

  - [ ] 7.4 Implement analytics dashboard
    - Create content performance metrics
    - Build keyword ranking visualization
    - Implement traffic and conversion tracking
    - Add comparative analytics
    - _Requirements: 1.5, 1.6_

- [ ] 8. Implement end-to-end workflows

  - [ ] 8.1 Create website analysis and article settings generation

    - Implement website URL input and validation
    - Build website content scraping and analysis
    - Create website structure analysis
    - Implement automatic article settings generation
    - Add settings review and customization interface
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 5.2, 5.5, 6.2_

  - [ ] 8.2 Create SEO strategy generation workflow

    - Implement topic input and validation
    - Build strategy generation process using article settings
    - Create strategy review interface
    - Add strategy approval workflow
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 6.2_

  - [ ] 8.3 Develop content creation workflow

    - Implement task breakdown process
    - Build research and writing coordination
    - Create content optimization flow
    - Add content review and publication
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

  - [ ] 8.4 Build error recovery workflows
    - Implement API failure recovery
    - Create scraping error handling
    - Build content quality remediation
    - Add human intervention triggers
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

- [ ] 9. Testing and optimization

  - [ ] 9.1 Implement unit tests

    - Create tests for agent functions
    - Build API integration tests
    - Implement data model tests
    - Add utility function tests
    - _Requirements: All_

  - [ ] 9.2 Develop integration tests

    - Create workflow integration tests
    - Build agent interaction tests
    - Implement API chain tests
    - Add database operation tests
    - _Requirements: All_

  - [ ] 9.3 Perform system testing

    - Create end-to-end workflow tests
    - Build performance testing suite
    - Implement security testing
    - Add load testing scenarios
    - _Requirements: All_

  - [ ] 9.4 Optimize AI performance
    - Tune prompt engineering
    - Optimize model parameters
    - Implement caching strategies
    - Add performance monitoring
    - _Requirements: 3.2, 3.3, 4.1, 4.2, 4.5, 4.6_

- [ ] 10. Documentation and deployment

  - [ ] 10.1 Create technical documentation

    - Write API documentation
    - Create system architecture docs
    - Build agent interaction guides
    - Add troubleshooting documentation
    - _Requirements: All_

  - [ ] 10.2 Develop user guides

    - Create user onboarding documentation
    - Build feature guides
    - Implement interactive tutorials
    - Add FAQ and support resources
    - _Requirements: 6.1, 6.2, 6.3_

  - [ ] 10.3 Set up deployment pipeline

    - Configure CI/CD workflows
    - Implement database migration process
    - Create environment configuration
    - Add monitoring and logging
    - _Requirements: 7.2, 7.3, 8.5_

  - [ ] 10.4 Perform security review
    - Conduct authentication audit
    - Implement API security measures
    - Create data protection mechanisms
    - Add compliance documentation
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 6.1, 6.2, 6.3_
