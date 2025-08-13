import type { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/server/db";
import { projects } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";

/**
 * Get the validated project ID from middleware headers or fallback to user's first project
 */
export async function getValidatedProjectId(request: NextRequest): Promise<number | null> {
  const { userId } = await auth();
  
  if (!userId) {
    return null;
  }

  // Try to get validated project ID from middleware
  const validatedProjectId = request.headers.get("x-validated-project-id");
  
  if (validatedProjectId) {
    const projectIdNum = parseInt(validatedProjectId, 10);
    return isNaN(projectIdNum) ? null : projectIdNum;
  }

  // Fallback: Get user's first project
  try {
    const [firstProject] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.userId, userId))
      .limit(1);
    
    return firstProject?.id ?? null;
  } catch (error) {
    console.error("Error getting user's first project:", error);
    return null;
  }
}

/**
 * Get project ID from request (headers, cookies, or fallback)
 */
export async function getProjectIdFromRequest(request: NextRequest): Promise<number | null> {
  // First try middleware-validated project ID
  const validatedId = await getValidatedProjectId(request);
  if (validatedId) {
    return validatedId;
  }

  // Try to get from x-project-id header
  const headerProjectId = request.headers.get("x-project-id");
  if (headerProjectId) {
    const projectIdNum = parseInt(headerProjectId, 10);
    if (!isNaN(projectIdNum)) {
      return projectIdNum;
    }
  }

  // Try to get from cookie
  const cookieProjectId = request.cookies.get("currentProject")?.value;
  if (cookieProjectId) {
    const projectIdNum = parseInt(cookieProjectId, 10);
    if (!isNaN(projectIdNum)) {
      return projectIdNum;
    }
  }

  return null;
}

/**
 * Verify that a user owns a specific project
 */
export async function verifyProjectOwnership(userId: string, projectId: number): Promise<boolean> {
  try {
    const [project] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(
        eq(projects.id, projectId),
        eq(projects.userId, userId)
      ))
      .limit(1);
    
    return !!project;
  } catch (error) {
    console.error("Error verifying project ownership:", error);
    return false;
  }
}

/**
 * Get current project context with ownership validation
 */
export async function getCurrentProject(request: NextRequest) {
  const { userId } = await auth();
  
  if (!userId) {
    return { userId: null, projectId: null, error: "Not authenticated" };
  }

  const projectId = await getProjectIdFromRequest(request);
  
  if (!projectId) {
    return { userId, projectId: null, error: "No project context" };
  }

  const hasAccess = await verifyProjectOwnership(userId, projectId);
  
  if (!hasAccess) {
    return { userId, projectId: null, error: "Project access denied" };
  }

  return { userId, projectId, error: null };
}
