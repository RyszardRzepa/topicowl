import type { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/server/db";
import { projects, articleSettings } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import type { ApiResponse, Project } from "@/types";
import { analyzeWebsitePure } from "@/lib/website-analysis";

// --- Validation schemas ---
const analysisContentStrategySchema = z.object({
  articleStructure: z.string().min(1).optional(),
  maxWords: z.number().int().min(200).max(2000).optional(),
  publishingFrequency: z.string().optional(),
});

const analysisDataSchema = z.object({
  domain: z.string(),
  companyName: z.string().min(1).optional(),
  productDescription: z.string().min(1).optional(),
  toneOfVoice: z.string().optional(),
  suggestedKeywords: z.array(z.string()).max(20).optional(),
  industryCategory: z.string().optional(),
  targetAudience: z.string().optional(),
  contentStrategy: analysisContentStrategySchema.optional(),
});

const analyzeRequestSchema = z.object({
  action: z.literal("analyze"),
  websiteUrl: z.string().min(1),
});

const createProjectSchema = z.object({
  // legacy manual creation fields
  name: z
    .string()
    .min(1, "Project name is required")
    .max(100, "Project name too long")
    .optional(),
  websiteUrl: z.string().url("Valid website URL is required"),
  companyName: z.string().optional(),
  productDescription: z.string().optional(),
  keywords: z.array(z.string()).optional(),
  // AI assisted path
  analysisData: analysisDataSchema.optional(),
  useAnalyzedName: z.boolean().optional(),
});

// GET /api/projects - List user's projects
export async function GET(): Promise<Response> {
  try {
    const { userId } = await auth();

    if (!userId) {
      return Response.json(
        { success: false, error: "Unauthorized" } satisfies ApiResponse,
        { status: 401 },
      );
    }

    const userProjects = await db
      .select()
      .from(projects)
      .where(eq(projects.userId, userId))
      .orderBy(projects.createdAt);

    return Response.json({
      success: true,
      data: userProjects,
    } satisfies ApiResponse<Project[]>);
  } catch (error) {
    console.error("Error fetching projects:", error);
    return Response.json(
      {
        success: false,
        error: "Failed to fetch projects",
      } satisfies ApiResponse,
      { status: 500 },
    );
  }
}

// Inline URL normalization (avoid shared util per repo guidance)
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
  const protocol = "https:"; // canonical protocol
  return {
    websiteUrl: `${protocol}//${host}${url.pathname.replace(/\/+$/g, "")}`,
    domain: host.replace(/^www\./, ""),
  };
}

// WebsiteAnalysisSchema imported for potential validation reuse (kept minimal here)

// POST /api/projects - Create new project
export async function POST(request: NextRequest): Promise<Response> {
  try {
    const { userId } = await auth();
    if (!userId) {
      return Response.json(
        { success: false, error: "Unauthorized" } satisfies ApiResponse,
        { status: 401 },
      );
    }

    const bodyRaw: unknown = await request.json();

    // Branch: analysis only (no creation)
    const maybeAction = (bodyRaw as { action?: string })?.action;
    if (maybeAction === "analyze") {
      let analyzedRequest;
      try {
        analyzedRequest = analyzeRequestSchema.parse(bodyRaw);
      } catch {
        return Response.json(
          {
            success: false,
            error: "Invalid analyze request",
          } satisfies ApiResponse,
          { status: 400 },
        );
      }
      let normalized;
      try {
        normalized = normalizeWebsiteUrl(analyzedRequest.websiteUrl);
      } catch {
        return Response.json(
          {
            success: false,
            error: "Invalid website URL",
          } satisfies ApiResponse,
          { status: 400 },
        );
      }
      const analysis = await analyzeWebsitePure(normalized.websiteUrl);
      return Response.json(
        { success: true, data: { ...analysis } } satisfies ApiResponse,
        { status: 200 },
      );
    }

    // Creation path (manual or AI-assisted)
    const validated = createProjectSchema.parse(bodyRaw);

    // Normalize URL
    let normalized;
    try {
      normalized = normalizeWebsiteUrl(validated.websiteUrl);
    } catch {
      return Response.json(
        { success: false, error: "Invalid website URL" } satisfies ApiResponse,
        { status: 400 },
      );
    }

    // Per-user uniqueness check (prevent same user from creating duplicate projects)
    const existing = await db
      .select({ id: projects.id })
      .from(projects)
      .where(
        and(
          eq(projects.websiteUrl, normalized.websiteUrl),
          eq(projects.userId, userId),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      return Response.json(
        {
          success: false,
          error: "You already have a project for this website URL",
        } satisfies ApiResponse,
        { status: 400 },
      );
    }

    const analysisData = validated.analysisData;
    const finalName =
      validated.name ??
      (validated.useAnalyzedName ? analysisData?.companyName : undefined) ??
      analysisData?.companyName ??
      normalized.domain;
    const finalCompanyName =
      analysisData?.companyName ?? validated.companyName ?? finalName;
    const finalProductDescription =
      analysisData?.productDescription ?? validated.productDescription;
    const finalKeywords =
      analysisData?.suggestedKeywords ?? validated.keywords ?? [];

    let newProject: Project | undefined;
    await db.transaction(async (tx) => {
      const inserted = await tx
        .insert(projects)
        .values({
          userId,
          name: finalName,
          websiteUrl: normalized.websiteUrl,
          domain: normalized.domain,
          companyName: finalCompanyName,
          productDescription: finalProductDescription,
          keywords: finalKeywords,
          webhookEnabled: false,
          webhookEvents: ["article.published"],
          // Do NOT set article settings fields here (schema cleanup path); leave null
        })
        .returning();
      newProject = inserted[0] as Project | undefined;
      if (!newProject) throw new Error("Insert failed");
      if (analysisData) {
        await tx.insert(articleSettings).values({
          projectId: newProject.id,
          toneOfVoice: analysisData.toneOfVoice,
          articleStructure: analysisData.contentStrategy?.articleStructure,
          maxWords: analysisData.contentStrategy?.maxWords ?? 800,
        });
      }
    });

    if (!newProject) {
      return Response.json(
        {
          success: false,
          error: "Failed to create project",
        } satisfies ApiResponse,
        { status: 500 },
      );
    }

    return Response.json(
      {
        success: true,
        data: newProject,
        message: "Project created successfully",
      } satisfies ApiResponse<Project>,
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        {
          success: false,
          error: "Validation failed",
          message: error.errors.map((e) => e.message).join(", "),
        } satisfies ApiResponse,
        { status: 400 },
      );
    }
    console.error("Error creating/analyzing project:", error);
    return Response.json(
      {
        success: false,
        error: "Failed to process request",
      } satisfies ApiResponse,
      { status: 500 },
    );
  }
}
