import type { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/server/db";
import { projects, articles, generationQueue, articleGeneration, articleSettings, webhookDeliveries } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import type { ApiResponse, Project } from "@/types";

function normalizeWebsiteUrl(raw: string): { websiteUrl: string; domain: string } {
  const trimmed = raw.trim();
  const url = new URL(trimmed);
  const host = url.hostname.toLowerCase();
  let pathname = url.pathname.replace(/\/+$|$/g, "");
  if (pathname === "") pathname = "";
  const protocol = "https:";
  return { websiteUrl: `${protocol}//${host}${pathname}`, domain: host };
}

// Validation schemas
const updateProjectSchema = z.object({
  name: z.string().min(1, "Project name is required").max(100, "Project name too long").optional(),
  websiteUrl: z.string().url("Valid website URL is required").optional(),
  companyName: z.string().optional(),
  productDescription: z.string().optional(),
  keywords: z.array(z.string()).optional(),
  toneOfVoice: z.string().optional(),
  articleStructure: z.string().optional(),
  maxWords: z.number().positive().optional(),
  excludedDomains: z.array(z.string()).optional(),
  sitemapUrl: z.string().url().optional(),
  webhookUrl: z.string().url().optional(),
  webhookSecret: z.string().optional(),
  webhookEnabled: z.boolean().optional(),
  webhookEvents: z.array(z.string()).optional(),
});

// Helper function to verify project ownership
async function verifyProjectOwnership(projectId: number, userId: string) {
  const project = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .limit(1);
  
  return project[0] ?? null;
}

// PUT /api/projects/[id] - Update project
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return Response.json(
        { success: false, error: "Unauthorized" } satisfies ApiResponse,
        { status: 401 }
      );
    }

    const { id } = await params;
    const projectId = parseInt(id, 10);
    
    if (isNaN(projectId)) {
      return Response.json(
        { success: false, error: "Invalid project ID" } satisfies ApiResponse,
        { status: 400 }
      );
    }

    // Verify project ownership
    const existingProject = await verifyProjectOwnership(projectId, userId);
    if (!existingProject) {
      return Response.json(
        { success: false, error: "Project not found" } satisfies ApiResponse,
        { status: 404 }
      );
    }

    const body: unknown = await request.json();
    const validatedData = updateProjectSchema.parse(body);

    // If website URL is being updated, check uniqueness
    let domain = existingProject.domain;
    if (validatedData.websiteUrl && validatedData.websiteUrl !== existingProject.websiteUrl) {
      // Normalize new URL
      let normalized;
      try {
        normalized = normalizeWebsiteUrl(validatedData.websiteUrl);
      } catch {
        return Response.json(
          { success: false, error: "Invalid website URL" } satisfies ApiResponse,
          { status: 400 }
        );
      }
      // Uniqueness on normalized form
      const existingUrlProject = await db
        .select()
        .from(projects)
        .where(eq(projects.websiteUrl, normalized.websiteUrl))
        .limit(1);
      if (existingUrlProject.length > 0) {
        return Response.json(
          { success: false, error: "Website URL is already used by another project" } satisfies ApiResponse,
          { status: 400 }
        );
      }
      validatedData.websiteUrl = normalized.websiteUrl;
      domain = normalized.domain;
    }

    const [updatedProject] = await db
      .update(projects)
      .set({
        ...validatedData,
        domain,
        updatedAt: new Date(),
      })
      .where(eq(projects.id, projectId))
      .returning();

    if (!updatedProject) {
      return Response.json(
        { success: false, error: "Failed to update project" } satisfies ApiResponse,
        { status: 500 }
      );
    }

    return Response.json({
      success: true,
      data: updatedProject,
      message: "Project updated successfully",
    } satisfies ApiResponse<Project>);

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

    console.error('Error updating project:', error);
    return Response.json(
      { success: false, error: "Failed to update project" } satisfies ApiResponse,
      { status: 500 }
    );
  }
}

// DELETE /api/projects/[id] - Delete project
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return Response.json(
        { success: false, error: "Unauthorized" } satisfies ApiResponse,
        { status: 401 }
      );
    }

    const { id } = await params;
    const projectId = parseInt(id, 10);
    
    if (isNaN(projectId)) {
      return Response.json(
        { success: false, error: "Invalid project ID" } satisfies ApiResponse,
        { status: 400 }
      );
    }

    // Verify project ownership
    const existingProject = await verifyProjectOwnership(projectId, userId);
    if (!existingProject) {
      return Response.json(
        { success: false, error: "Project not found" } satisfies ApiResponse,
        { status: 404 }
      );
    }

    // Check if this is the user's only project
    const userProjectCount = await db
      .select()
      .from(projects)
      .where(eq(projects.userId, userId));

    if (userProjectCount.length <= 1) {
      return Response.json(
        { 
          success: false, 
          error: "Cannot delete your only project. Please create another project first." 
        } satisfies ApiResponse,
        { status: 400 }
      );
    }

    // Start cascade deletion
    try {
      // Delete webhook deliveries
      await db
        .delete(webhookDeliveries)
        .where(eq(webhookDeliveries.projectId, projectId));

      // Delete article settings
      await db
        .delete(articleSettings)
        .where(eq(articleSettings.projectId, projectId));

      // Delete article generation records
      await db
        .delete(articleGeneration)
        .where(eq(articleGeneration.projectId, projectId));

      // Delete generation queue entries
      await db
        .delete(generationQueue)
        .where(eq(generationQueue.projectId, projectId));

      // Delete articles
      await db
        .delete(articles)
        .where(eq(articles.projectId, projectId));

      // Finally delete the project
      await db
        .delete(projects)
        .where(eq(projects.id, projectId));

      return Response.json({
        success: true,
        message: "Project and all associated data deleted successfully",
      } satisfies ApiResponse);

    } catch (deleteError) {
      console.error('Error during cascade deletion:', deleteError);
      return Response.json(
        { success: false, error: "Failed to delete project and associated data" } satisfies ApiResponse,
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Error deleting project:', error);
    return Response.json(
      { success: false, error: "Failed to delete project" } satisfies ApiResponse,
      { status: 500 }
    );
  }
}
