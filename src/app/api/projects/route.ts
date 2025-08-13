import type { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/server/db";
import { projects } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import type { ApiResponse, Project } from "@/types";

// Validation schemas
const createProjectSchema = z.object({
  name: z.string().min(1, "Project name is required").max(100, "Project name too long"),
  websiteUrl: z.string().url("Valid website URL is required"),
  companyName: z.string().optional(),
  productDescription: z.string().optional(),
  keywords: z.array(z.string()).optional(),
});

// GET /api/projects - List user's projects
export async function GET(): Promise<Response> {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return Response.json(
        { success: false, error: "Unauthorized" } satisfies ApiResponse,
        { status: 401 }
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
    console.error('Error fetching projects:', error);
    return Response.json(
      { success: false, error: "Failed to fetch projects" } satisfies ApiResponse,
      { status: 500 }
    );
  }
}

// Inline URL normalization (avoid shared util per repo guidance)
function normalizeWebsiteUrl(raw: string): { websiteUrl: string; domain: string } {
  const trimmed = raw.trim();
  const url = new URL(trimmed);
  const host = url.hostname.toLowerCase();
  let pathname = url.pathname.replace(/\/+$|$/g, "");
  if (pathname === "") pathname = ""; // ensure root only
  const protocol = "https:"; // canonical protocol
  return { websiteUrl: `${protocol}//${host}${pathname}`, domain: host };
}

// POST /api/projects - Create new project
export async function POST(request: NextRequest): Promise<Response> {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return Response.json(
        { success: false, error: "Unauthorized" } satisfies ApiResponse,
        { status: 401 }
      );
    }

    const body: unknown = await request.json();
    const validatedData = createProjectSchema.parse(body);

    // Normalize URL & derive domain
    let normalized;
    try {
      normalized = normalizeWebsiteUrl(validatedData.websiteUrl);
    } catch {
      return Response.json(
        { success: false, error: "Invalid website URL" } satisfies ApiResponse,
        { status: 400 }
      );
    }

    // Check if website URL is already used
    const existingProject = await db
      .select()
      .from(projects)
      .where(eq(projects.websiteUrl, normalized.websiteUrl))
      .limit(1);

    if (existingProject.length > 0) {
      return Response.json(
        { success: false, error: "Website URL is already used by another project" } satisfies ApiResponse,
        { status: 400 }
      );
    }

    const [newProject] = await db
      .insert(projects)
      .values({
        userId,
        name: validatedData.name,
  websiteUrl: normalized.websiteUrl,
  domain: normalized.domain,
        companyName: validatedData.companyName,
        productDescription: validatedData.productDescription,
        keywords: validatedData.keywords ?? [],
        webhookEnabled: false,
        webhookEvents: ["article.published"],
      })
      .returning();

    if (!newProject) {
      return Response.json(
        { success: false, error: "Failed to create project" } satisfies ApiResponse,
        { status: 500 }
      );
    }

    return Response.json({
      success: true,
      data: newProject,
      message: "Project created successfully",
    } satisfies ApiResponse<Project>, { status: 201 });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        { 
          success: false, 
          error: "Validation failed",
          message: error.errors.map(e => e.message).join(", ")
        } satisfies ApiResponse,
        { status: 400 }
      );
    }

    console.error('Error creating project:', error);
    return Response.json(
      { success: false, error: "Failed to create project" } satisfies ApiResponse,
      { status: 500 }
    );
  }
}
