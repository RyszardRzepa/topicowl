import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

// Types colocated with this API route
export interface WebhookSettingsRequest {
  webhookUrl?: string;
  webhookSecret?: string;
  webhookEnabled?: boolean;
  webhookEvents?: string[];
}

export interface WebhookSettingsResponse {
  success: boolean;
  data?: {
    webhookUrl?: string;
    webhookEnabled: boolean;
    webhookEvents: string[];
    hasSecret: boolean; // Don't expose actual secret
  };
  error?: string;
  details?: unknown;
}

export interface WebhookTestRequest {
  webhookUrl: string;
  webhookSecret?: string;
}

export interface WebhookTestResponse {
  success: boolean;
  responseTime?: number;
  error?: string;
}

const webhookSettingsSchema = z.object({
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

export async function GET() {
  try {
    // Get current user from Clerk
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' } as WebhookSettingsResponse,
        { status: 401 }
      );
    }

    // Get user record with webhook settings
    const [userRecord] = await db
      .select({
        webhookUrl: users.webhookUrl,
        webhookEnabled: users.webhookEnabled,
        webhookEvents: users.webhookEvents,
        webhookSecret: users.webhookSecret,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!userRecord) {
      return NextResponse.json(
        { success: false, error: 'User not found' } as WebhookSettingsResponse,
        { status: 404 }
      );
    }

    const response: WebhookSettingsResponse = {
      success: true,
      data: {
        webhookUrl: userRecord.webhookUrl ?? undefined,
        webhookEnabled: userRecord.webhookEnabled,
        webhookEvents: Array.isArray(userRecord.webhookEvents) 
          ? userRecord.webhookEvents as string[]
          : ['article.published'],
        hasSecret: !!(userRecord.webhookSecret && userRecord.webhookSecret.length > 0),
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

    // Prepare update data
    const updateData: Partial<typeof users.$inferInsert> = {};
    
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

    // Update user webhook settings
    const [updatedUser] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, userId))
      .returning({
        webhookUrl: users.webhookUrl,
        webhookEnabled: users.webhookEnabled,
        webhookEvents: users.webhookEvents,
        webhookSecret: users.webhookSecret,
      });

    if (!updatedUser) {
      return NextResponse.json(
        { success: false, error: 'User not found' } as WebhookSettingsResponse,
        { status: 404 }
      );
    }

    const response: WebhookSettingsResponse = {
      success: true,
      data: {
        webhookUrl: updatedUser.webhookUrl ?? undefined,
        webhookEnabled: updatedUser.webhookEnabled,
        webhookEvents: Array.isArray(updatedUser.webhookEvents) 
          ? updatedUser.webhookEvents as string[]
          : ['article.published'],
        hasSecret: !!(updatedUser.webhookSecret && updatedUser.webhookSecret.length > 0),
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
