import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/server/db";
import { projects } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

// Types colocated with this API route
export interface WebhookSettingsRequest {
  projectId: number;
  webhookUrl?: string;
  webhookSecret?: string;
  webhookEnabled?: boolean;
  webhookEvents?: string[];
}

export interface WebhookSettingsResponse {
  success: boolean;
  data?: {
    projectId: number;
    webhookUrl?: string;
    webhookEnabled: boolean;
    webhookEvents: string[];
    hasSecret: boolean; // Don't expose actual secret
  };
  error?: string;
  details?: unknown;
}

export interface WebhookTestRequest {
  projectId: number;
  webhookUrl: string;
  webhookSecret?: string;
}

export interface WebhookTestResponse {
  success: boolean;
  responseTime?: number;
  error?: string;
}

const webhookSettingsSchema = z.object({
  projectId: z.number().int().positive(),
  webhookUrl: z.string().url().optional().or(z.literal("")),
  webhookSecret: z.string().min(16).optional().or(z.literal("")),
  webhookEnabled: z.boolean().optional(),
  webhookEvents: z.array(z.string()).optional(),
});

// Validate webhook URL (require HTTPS in production)
function validateWebhookUrl(url: string): { isValid: boolean; error?: string } {
  try {
    const parsedUrl = new URL(url);
    
    // Require HTTPS in production
    if (process.env.NODE_ENV === 'production' && parsedUrl.protocol !== 'https:') {
      return { isValid: false, error: 'Webhook URL must use HTTPS in production' };
    }
    
    // Block localhost/private IPs in production
    if (process.env.NODE_ENV === 'production') {
      const hostname = parsedUrl.hostname;
      if (hostname === 'localhost' || 
          hostname === '127.0.0.1' || 
          hostname.startsWith('192.168.') ||
          hostname.startsWith('10.') ||
          hostname.startsWith('172.')) {
        return { isValid: false, error: 'Cannot use private/local URLs in production' };
      }
    }
    
    return { isValid: true };
  } catch {
    return { isValid: false, error: 'Invalid URL format' };
  }
}

export async function GET(request: NextRequest) {
  try {
    // Get current user from Clerk
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' } as WebhookSettingsResponse,
        { status: 401 }
      );
    }

    // Get projectId from query parameters
    const { searchParams } = new URL(request.url);
    const projectIdParam = searchParams.get("projectId");

    if (!projectIdParam) {
      return NextResponse.json(
        { success: false, error: "Project ID is required" } as WebhookSettingsResponse,
        { status: 400 },
      );
    }

    const projectId = parseInt(projectIdParam, 10);
    if (isNaN(projectId)) {
      return NextResponse.json(
        { success: false, error: "Invalid project ID" } as WebhookSettingsResponse,
        { status: 400 },
      );
    }

    // Get project record with webhook settings and ownership verification
    const [projectRecord] = await db
      .select({
        projectId: projects.id,
        webhookUrl: projects.webhookUrl,
        webhookEnabled: projects.webhookEnabled,
        webhookEvents: projects.webhookEvents,
        webhookSecret: projects.webhookSecret,
      })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
      .limit(1);

    if (!projectRecord) {
      return NextResponse.json(
        { success: false, error: 'Project not found or access denied' } as WebhookSettingsResponse,
        { status: 404 }
      );
    }

    const response: WebhookSettingsResponse = {
      success: true,
      data: {
        projectId: projectRecord.projectId,
        webhookUrl: projectRecord.webhookUrl ?? undefined,
        webhookEnabled: projectRecord.webhookEnabled ?? false,
        webhookEvents: Array.isArray(projectRecord.webhookEvents) 
          ? projectRecord.webhookEvents as string[]
          : ['article.published'],
        hasSecret: !!(projectRecord.webhookSecret && projectRecord.webhookSecret.length > 0),
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Get webhook settings error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve webhook settings' } as WebhookSettingsResponse,
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    // Get current user from Clerk
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' } as WebhookSettingsResponse,
        { status: 401 }
      );
    }

    const body = await req.json() as unknown;
    const validatedData = webhookSettingsSchema.parse(body);

    // Validate webhook URL if provided
    if (validatedData.webhookUrl?.trim()) {
      const urlValidation = validateWebhookUrl(validatedData.webhookUrl);
      if (!urlValidation.isValid) {
        return NextResponse.json(
          { success: false, error: urlValidation.error } as WebhookSettingsResponse,
          { status: 400 }
        );
      }
    }

    // Verify project ownership
    const [existingProject] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, validatedData.projectId), eq(projects.userId, userId)))
      .limit(1);

    if (!existingProject) {
      return NextResponse.json(
        { success: false, error: 'Project not found or access denied' } as WebhookSettingsResponse,
        { status: 404 }
      );
    }

    // Prepare update data
    const updateData: Partial<typeof projects.$inferInsert> = {};
    
    if (validatedData.webhookUrl !== undefined) {
      updateData.webhookUrl = validatedData.webhookUrl.trim() || null;
    }
    
    if (validatedData.webhookSecret !== undefined) {
      updateData.webhookSecret = validatedData.webhookSecret.trim() || null;
    }
    
    if (validatedData.webhookEnabled !== undefined) {
      updateData.webhookEnabled = validatedData.webhookEnabled;
    }
    
    if (validatedData.webhookEvents !== undefined) {
      updateData.webhookEvents = validatedData.webhookEvents;
    }

    // Add timestamp
    updateData.updatedAt = new Date();

    // Update project webhook settings
    const [updatedProject] = await db
      .update(projects)
      .set(updateData)
      .where(eq(projects.id, validatedData.projectId))
      .returning({
        projectId: projects.id,
        webhookUrl: projects.webhookUrl,
        webhookEnabled: projects.webhookEnabled,
        webhookEvents: projects.webhookEvents,
        webhookSecret: projects.webhookSecret,
      });

    if (!updatedProject) {
      return NextResponse.json(
        { success: false, error: 'Project not found' } as WebhookSettingsResponse,
        { status: 404 }
      );
    }

    const response: WebhookSettingsResponse = {
      success: true,
      data: {
        projectId: updatedProject.projectId,
        webhookUrl: updatedProject.webhookUrl ?? undefined,
        webhookEnabled: updatedProject.webhookEnabled ?? false,
        webhookEvents: Array.isArray(updatedProject.webhookEvents) 
          ? updatedProject.webhookEvents as string[]
          : ['article.published'],
        hasSecret: !!(updatedProject.webhookSecret && updatedProject.webhookSecret.length > 0),
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Update webhook settings error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid input data', details: error.errors } as WebhookSettingsResponse,
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { success: false, error: 'Failed to update webhook settings' } as WebhookSettingsResponse,
      { status: 500 }
    );
  }
}
