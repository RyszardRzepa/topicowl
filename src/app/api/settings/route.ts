import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/server/db";
import { projects } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { validateDomains } from "@/lib/utils/domain";

// Types colocated with this API route
export interface ProjectSettingsRequest {
  projectId: number;
  // Project-specific settings
  companyName?: string;
  productDescription?: string;
  keywords?: string[];
  // Article generation settings
  toneOfVoice?: string;
  articleStructure?: string;
  maxWords?: number;
  excludedDomains?: string[];
  sitemapUrl?: string;
  // Webhook configuration
  webhookUrl?: string;
  webhookSecret?: string;
  webhookEnabled?: boolean;
  webhookEvents?: string[];
}

export interface ProjectSettingsResponse {
  id: number;
  name: string;
  websiteUrl: string;
  domain: string | null;
  // Project-specific settings
  companyName: string | null;
  productDescription: string | null;
  keywords: string[];
  // Article generation settings
  toneOfVoice: string | null;
  articleStructure: string | null;
  maxWords: number | null;
  excludedDomains: string[];
  sitemapUrl: string | null;
  // Webhook configuration
  webhookUrl: string | null;
  webhookSecret: string | null;
  webhookEnabled: boolean;
  webhookEvents: string[];
  createdAt: Date;
  updatedAt: Date;
}

const projectSettingsSchema = z.object({
  projectId: z.number().int().positive(),
  // Project-specific settings
  companyName: z.string().min(1).max(255).optional(),
  productDescription: z.string().max(1000).optional(),
  keywords: z.array(z.string()).max(20).optional(),
  // Article generation settings
  toneOfVoice: z.string().optional(),
  articleStructure: z.string().optional(),
  maxWords: z.number().min(100).max(5000).optional(),
  excludedDomains: z.array(z.string()).max(100).optional(),
  sitemapUrl: z.string().url().optional().or(z.literal("")),
  // Webhook configuration
  webhookUrl: z.string().url().optional().or(z.literal("")),
  webhookSecret: z.string().optional(),
  webhookEnabled: z.boolean().optional(),
  webhookEvents: z.array(z.string()).optional(),
});

// GET /api/settings?projectId=123 - Get project settings
export async function GET(req: NextRequest) {
  try {
    // Get current user from Clerk
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get projectId from query params
    const { searchParams } = new URL(req.url);
    const projectIdParam = searchParams.get('projectId');
    
    if (!projectIdParam) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      );
    }

    const projectId = parseInt(projectIdParam, 10);
    if (isNaN(projectId)) {
      return NextResponse.json(
        { error: 'Invalid project ID' },
        { status: 400 }
      );
    }

    // Get project with ownership verification
    const [project] = await db
      .select()
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
      .limit(1);

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found or access denied' },
        { status: 404 }
      );
    }
    
    // Transform project data to response format
    const settingsResponse: ProjectSettingsResponse = {
      id: project.id,
      name: project.name,
      websiteUrl: project.websiteUrl,
      domain: project.domain,
      companyName: project.companyName,
      productDescription: project.productDescription,
      keywords: Array.isArray(project.keywords) ? project.keywords as string[] : [],
      toneOfVoice: project.toneOfVoice,
      articleStructure: project.articleStructure,
      maxWords: project.maxWords,
      excludedDomains: Array.isArray(project.excludedDomains) ? project.excludedDomains : [],
      sitemapUrl: project.sitemapUrl,
      webhookUrl: project.webhookUrl,
      webhookSecret: project.webhookSecret,
      webhookEnabled: project.webhookEnabled,
      webhookEvents: Array.isArray(project.webhookEvents) ? project.webhookEvents as string[] : [],
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    };
    
    return NextResponse.json(settingsResponse);
  } catch (error) {
    console.error('Get project settings error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve project settings' },
      { status: 500 }
    );
  }
}

// PUT /api/settings - Update project settings
export async function PUT(req: NextRequest) {
  try {
    // Get current user from Clerk
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await req.json() as unknown;
    const validatedData = projectSettingsSchema.parse(body);
    
    // Validate excluded domains if provided
    if (validatedData.excludedDomains) {
      const domainValidation = validateDomains(validatedData.excludedDomains);
      
      if (domainValidation.invalidDomains.length > 0) {
        return NextResponse.json(
          { 
            error: 'Invalid domains provided', 
            details: domainValidation.invalidDomains 
          },
          { status: 400 }
        );
      }
      
      // Use normalized domains for storage
      validatedData.excludedDomains = domainValidation.normalizedDomains;
    }
    
    // Verify project ownership
    const [project] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, validatedData.projectId), eq(projects.userId, userId)))
      .limit(1);

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found or access denied' },
        { status: 404 }
      );
    }

    // Prepare update data (exclude projectId from update)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { projectId: _, ...updateData } = validatedData;
    
    // Handle empty string to null conversion for optional URLs
    if ('sitemapUrl' in updateData && updateData.sitemapUrl === "") {
      updateData.sitemapUrl = undefined;
    }
    if ('webhookUrl' in updateData && updateData.webhookUrl === "") {
      updateData.webhookUrl = undefined;
    }

    // Update the project
    const [updatedProject] = await db
      .update(projects)
      .set({
        ...updateData,
        updatedAt: new Date(),
      })
      .where(eq(projects.id, validatedData.projectId))
      .returning();

    if (!updatedProject) {
      return NextResponse.json(
        { error: 'Failed to update project settings' },
        { status: 500 }
      );
    }
    
    // Transform to response format
    const settingsResponse: ProjectSettingsResponse = {
      id: updatedProject.id,
      name: updatedProject.name,
      websiteUrl: updatedProject.websiteUrl,
      domain: updatedProject.domain,
      companyName: updatedProject.companyName,
      productDescription: updatedProject.productDescription,
      keywords: Array.isArray(updatedProject.keywords) ? updatedProject.keywords as string[] : [],
      toneOfVoice: updatedProject.toneOfVoice,
      articleStructure: updatedProject.articleStructure,
      maxWords: updatedProject.maxWords,
      excludedDomains: Array.isArray(updatedProject.excludedDomains) ? updatedProject.excludedDomains : [],
      sitemapUrl: updatedProject.sitemapUrl,
      webhookUrl: updatedProject.webhookUrl,
      webhookSecret: updatedProject.webhookSecret,
      webhookEnabled: updatedProject.webhookEnabled,
      webhookEvents: Array.isArray(updatedProject.webhookEvents) ? updatedProject.webhookEvents as string[] : [],
      createdAt: updatedProject.createdAt,
      updatedAt: updatedProject.updatedAt,
    };
    
    return NextResponse.json(settingsResponse);
  } catch (error) {
    console.error('Update project settings error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input data', details: error.errors },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to save project settings' },
      { status: 500 }
    );
  }
}
