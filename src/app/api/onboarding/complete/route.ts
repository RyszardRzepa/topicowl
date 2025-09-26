import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { db } from "@/server/db";
import { users, projects } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import type { Project } from "@/types";
import { prompts } from "@/prompts";

const projectDataSchema = z.object({
  name: z.string().min(1),
  websiteUrl: z.string().url(),
  domain: z.string().optional(),
  sitemapUrl: z.string().url().optional(),
  exampleArticleUrl: z.string().url().optional(),
  excludedDomains: z.array(z.string()).optional().default([]),
  companyName: z.string().optional().default(""),
  productDescription: z.string().optional().default(""),
  targetAudience: z.string().optional(),
  keywords: z.array(z.string()).optional().default([]),
  toneOfVoice: z.string().optional().default(""),
  articleStructure: z.string().optional().default(""),
  maxWords: z.number().int().min(500).max(2500).optional().default(800),
  includeVideo: z.boolean().optional().default(true),
  includeTables: z.boolean().optional().default(true),
  includeCitations: z.boolean().optional().default(true),
  citationRegion: z.string().optional().default("worldwide"),
  brandColor: z.string().optional(),
  language: z.string().optional().default("en"),
});

const onboardingCompleteSchema = z.object({
  projectData: projectDataSchema,
});

// Inline URL normalization
function normalizeWebsiteUrl(raw: string): {
  websiteUrl: string;
  domain: string;
} {
  const trimmed = raw.trim();
  const withProtocol = /^(https?:)?\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  const url = new URL(withProtocol);
  const host = url.hostname.toLowerCase();
  const protocol = "https:";
  return {
    websiteUrl: `${protocol}//${host}${url.pathname.replace(/\/+$/g, "")}`,
    domain: host.replace(/^www\./, ""),
  };
}

export async function POST(request: Request): Promise<Response> {
  try {
    // Get current user from Clerk
    const { userId } = await auth();

    if (!userId) {
      return Response.json(
        { success: false, error: "Not authenticated" },
        { status: 401 },
      );
    }

    // Parse and validate request body
    const bodyRaw: unknown = await request.json();
    const validated = onboardingCompleteSchema.parse(bodyRaw);
    const { projectData } = validated;

    // Normalize website URL
    let normalized;
    try {
      normalized = normalizeWebsiteUrl(projectData.websiteUrl);
    } catch {
      return Response.json(
        { success: false, error: "Invalid website URL" },
        { status: 400 },
      );
    }

    // Check if this user already has a project for this website URL
    const existing = await db
      .select({ id: projects.id, userId: projects.userId })
      .from(projects)
      .where(
        and(
          eq(projects.websiteUrl, normalized.websiteUrl),
          eq(projects.userId, userId),
        ),
      )
      .limit(1);

    let newProject: Project | undefined;

    if (existing.length > 0) {
      const existingProject = existing[0]!;

      // Update the existing project for this user
      const updated = await db
        .update(projects)
        .set({
          name: projectData.name,
          domain: projectData.domain ?? normalized.domain,
          sitemapUrl: projectData.sitemapUrl,
          exampleArticleUrl: projectData.exampleArticleUrl,
          excludedDomains: projectData.excludedDomains,
          companyName: projectData.companyName,
          productDescription: projectData.productDescription,
          targetAudience: projectData.targetAudience,
          keywords: projectData.keywords,
          toneOfVoice: projectData.toneOfVoice,
          articleStructure:
            projectData.articleStructure && projectData.articleStructure.trim().length > 0
              ? projectData.articleStructure
              : prompts.articleStructure(),
          maxWords: projectData.maxWords,
          includeVideo: projectData.includeVideo,
          includeTables: projectData.includeTables,
          includeCitations: projectData.includeCitations,
          citationRegion: projectData.citationRegion,
          brandColor: projectData.brandColor,
          language: projectData.language ?? "en",
          updatedAt: new Date(),
        })
        .where(eq(projects.id, existingProject.id))
        .returning();

      newProject = updated[0] as Project | undefined;

      if (!newProject) {
        return Response.json(
          { success: false, error: "Failed to update project" },
          { status: 500 },
        );
      }
    } else {
      // Create new project
      const inserted = await db
        .insert(projects)
        .values({
          userId,
          name: projectData.name,
          websiteUrl: normalized.websiteUrl,
          domain: projectData.domain ?? normalized.domain,
          sitemapUrl: projectData.sitemapUrl,
          exampleArticleUrl: projectData.exampleArticleUrl,
          excludedDomains: projectData.excludedDomains,
          companyName: projectData.companyName,
          productDescription: projectData.productDescription,
          targetAudience: projectData.targetAudience,
          keywords: projectData.keywords,
          toneOfVoice: projectData.toneOfVoice,
          articleStructure:
            projectData.articleStructure && projectData.articleStructure.trim().length > 0
              ? projectData.articleStructure
              : prompts.articleStructure(),
          maxWords: projectData.maxWords,
          includeVideo: projectData.includeVideo,
          includeTables: projectData.includeTables,
          includeCitations: projectData.includeCitations,
          citationRegion: projectData.citationRegion,
          brandColor: projectData.brandColor,
          language: projectData.language ?? "en",
          webhookEnabled: false,
          webhookEvents: ["article.published"],
        })
        .returning();

      newProject = inserted[0] as Project | undefined;
      if (!newProject) {
        return Response.json(
          { success: false, error: "Failed to create project" },
          { status: 500 },
        );
      }
    }

    // Update user's onboarding status to completed
    await db
      .update(users)
      .set({
        onboardingCompleted: true,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    // Set project cookie to switch to the newly created project
    const cookieStore = await cookies();
    cookieStore.set("current-project-id", newProject.id.toString(), {
      path: "/",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365, // 1 year
    });

    // Trigger automatic topic generation for new users
    let taskId: string | undefined;
    try {
      // Import the topic discovery service directly
      const { createTopicDiscoveryTask } = await import("@/lib/services/topic-discovery");
      
      // Call the service directly instead of making HTTP request
      const topicTask = await createTopicDiscoveryTask(newProject);
      
      if (topicTask?.run_id) {
        taskId = topicTask.run_id;
      }
    } catch (error) {
      // Don't fail onboarding if topic generation fails
      console.error('Failed to trigger topic generation during onboarding:', error);
    }

    return Response.json({
      success: true,
      message: "Onboarding completed successfully",
      data: {
        projectId: newProject.id,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        {
          success: false,
          error: "Validation failed",
          message: error.errors.map((e) => e.message).join(", "),
        },
        { status: 400 },
      );
    }

    console.error("Error completing onboarding:", error);

    return Response.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 },
    );
  }
}
