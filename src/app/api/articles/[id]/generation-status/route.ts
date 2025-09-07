import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/server/db";
import {
  articles,
  articleGeneration,
  users,
  projects,
} from "@/server/db/schema";
import { eq, desc, and } from "drizzle-orm";
import type { ApiResponse } from "@/types";

// Types colocated with this API route
export interface GenerationStatus {
  articleId: string;
  status:
    | "pending"
    | "researching"
    | "writing"
    | "quality-control"
    | "validating"
    | "updating"
    | "completed"
    | "failed";
  progress: number;
  currentStep?: string;
  phase?: string;
  error?: string;
  estimatedCompletion?: string;
  startedAt: string;
  completedAt?: string;
  // SEO audit fields (optional during generation)
  currentPhase?: string;
  seoScore?: number;
  seoIssues?: Array<{ code: string; severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"; message: string }>;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // Get current user from Clerk
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" } as ApiResponse,
        { status: 401 },
      );
    }

    // Get user record from database
    const [userRecord] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!userRecord) {
      return NextResponse.json(
        { success: false, error: "User not found" } as ApiResponse,
        { status: 404 },
      );
    }

    const { id } = await params;

    if (!id && isNaN(parseInt(id))) {
      return NextResponse.json(
        { success: false, error: "Invalid article ID" } as ApiResponse,
        { status: 400 },
      );
    }

    const articleId = parseInt(id);

    // Check if article exists and belongs to current user's project using JOIN
    const [article] = await db
      .select({
        id: articles.id,
        projectId: articles.projectId,
      })
      .from(articles)
      .innerJoin(projects, eq(articles.projectId, projects.id))
      .where(
        and(eq(articles.id, articleId), eq(projects.userId, userRecord.id)),
      )
      .limit(1);

    if (!article) {
      return NextResponse.json(
        {
          success: false,
          error: "Article not found or access denied",
        } as ApiResponse,
        { status: 404 },
      );
    }

    // Get the latest generation record for this article
    const [latestGeneration] = await db
      .select()
      .from(articleGeneration)
      .where(eq(articleGeneration.articleId, articleId))
      .orderBy(desc(articleGeneration.createdAt))
      .limit(1);

    // If no generation record exists, return not found
    if (!latestGeneration) {
      return NextResponse.json(
        {
          success: false,
          error: "No generation found for this article",
        } as ApiResponse,
        { status: 404 },
      );
    }

    // Map generation record status to response
    const mapStatus = (dbStatus: string): GenerationStatus["status"] => {
      switch (dbStatus) {
        case "pending":
          return "pending";
        case "researching":
          return "researching";
        case "writing":
          return "writing";
        case "quality-control":
          return "quality-control";
        case "validating":
          return "validating";
        case "updating":
          return "updating";
        case "completed":
          return "completed";
        case "failed":
          return "failed";
        default:
          return "pending";
      }
    };

    // Enhanced phase descriptions
    const getPhaseDescription = (status: string): string => {
      switch (status) {
        case "pending":
          return "Queued for generation";
        case "researching":
          return "Researching topic and gathering information";
        case "writing":
          return "Writing article content";
        case "quality-control":
          return "Analyzing content quality";
        case "validating":
          return "Fact-checking and validation";
        case "updating":
          return "Applying final optimizations";
        case "completed":
          return "Generation completed successfully";
        case "failed":
          return "Generation failed";
        default:
          return "Processing...";
      }
    };

    // Derive SEO report details
    const rawSeo: unknown = latestGeneration.seoReport ?? {};
    
    // Type guard for SEO report structure
    const isSeoReport = (obj: unknown): obj is { score?: unknown; issues?: unknown[] } => {
      return obj !== null && typeof obj === "object" && !Array.isArray(obj);
    };
    
    // Type guard for SEO issue structure
    const isSeoIssue = (obj: unknown): obj is { code: string; severity?: string; message: string } => {
      return (
        obj !== null &&
        typeof obj === "object" &&
        !Array.isArray(obj) &&
        typeof (obj as Record<string, unknown>).code === "string" &&
        typeof (obj as Record<string, unknown>).message === "string"
      );
    };
    
    const seoScore = isSeoReport(rawSeo) && typeof rawSeo.score === "number" 
      ? rawSeo.score 
      : undefined;
    
    let seoIssues: Array<{ code: string; severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"; message: string }> | undefined;
    
    if (isSeoReport(rawSeo) && Array.isArray(rawSeo.issues)) {
      const order: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
      const validIssues = rawSeo.issues.filter(isSeoIssue);
      
      seoIssues = validIssues
        .map((issue) => ({
          code: issue.code,
          severity: (String(issue.severity ?? "MEDIUM").toUpperCase() as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"),
          message: issue.message,
        }))
        .sort((a, b) => (order[a.severity] ?? 9) - (order[b.severity] ?? 9))
        .slice(0, 5);
    }

    // Map to high-level phase for UI (including SEO sub-phases)
    const currentPhaseRaw = latestGeneration.currentPhase ?? undefined;
    const mapPhaseFromCurrent = (p?: string): string | undefined => {
      switch (p) {
        case "research":
          return "research";
        case "writing":
          return "writing";
        case "quality-control":
          return "quality-control";
        case "validation":
          return "validation";
        case "seo-audit":
        case "seo-remediation":
        case "schema-generation":
        case "image-selection":
          return "optimization";
        default:
          return undefined;
      }
    };

    const status: GenerationStatus = {
      articleId: id,
      status: mapStatus(latestGeneration.status),
      progress: latestGeneration.progress,
      currentStep:
        latestGeneration.status === "completed"
          ? undefined
          : getPhaseDescription(latestGeneration.status),
      phase:
        mapPhaseFromCurrent(currentPhaseRaw) ??
        (latestGeneration.status === "researching"
          ? "research"
          : latestGeneration.status === "writing"
            ? "writing"
            : latestGeneration.status === "quality-control"
              ? "quality-control"
              : latestGeneration.status === "validating"
                ? "validation"
                : latestGeneration.status === "updating"
                  ? "optimization"
                  : undefined),
      startedAt:
        latestGeneration.startedAt?.toISOString() ??
        latestGeneration.createdAt.toISOString(),
      completedAt: latestGeneration.completedAt?.toISOString(),
      error: latestGeneration.error ?? undefined,
      currentPhase: currentPhaseRaw,
      seoScore,
      seoIssues,
    };

    return NextResponse.json({
      success: true,
      ...status,
    });
  } catch (error) {
    console.error("Get generation status error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to get generation status",
      } as ApiResponse,
      { status: 500 },
    );
  }
}
