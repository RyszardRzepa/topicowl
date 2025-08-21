import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import crypto from "crypto";
import { db } from "@/server/db";
import { projects } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";

// Types colocated with this API route
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

const webhookTestSchema = z.object({
  projectId: z.number().int().positive(),
  webhookUrl: z.string().url(),
  webhookSecret: z.string().optional(),
});

// Generate webhook signature for testing
function generateWebhookSignature(payload: string, secret: string): string {
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(payload);
  return `sha256=${hmac.digest("hex")}`;
}

export async function POST(req: NextRequest) {
  try {
    // Get current user from Clerk
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" } as WebhookTestResponse,
        { status: 401 },
      );
    }

    const body = (await req.json()) as unknown;
    const validatedData = webhookTestSchema.parse(body);

    // Verify project ownership
    const [existingProject] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(
        and(
          eq(projects.id, validatedData.projectId),
          eq(projects.userId, userId),
        ),
      )
      .limit(1);

    if (!existingProject) {
      return NextResponse.json(
        {
          success: false,
          error: "Project not found or access denied",
        } as WebhookTestResponse,
        { status: 404 },
      );
    }

    // Create test payload
    const testPayload = {
      event: "webhook.test",
      timestamp: new Date().toISOString(),
      data: {
        message: "This is a test webhook from Contentbot",
        userId: userId,
        projectId: validatedData.projectId,
      },
    };

    const payloadString = JSON.stringify(testPayload);

    // Prepare headers
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "Contentbot-Webhook/1.0",
      "X-Webhook-Event": "webhook.test",
      "X-Webhook-Timestamp": Math.floor(Date.now() / 1000).toString(),
    };

    // Add signature if secret is provided
    if (validatedData.webhookSecret) {
      headers["X-Webhook-Signature"] = generateWebhookSignature(
        payloadString,
        validatedData.webhookSecret,
      );
    }

    // Measure response time
    const startTime = Date.now();

    try {
      const response = await fetch(validatedData.webhookUrl, {
        method: "POST",
        headers,
        body: payloadString,
        signal: AbortSignal.timeout(30000), // 30 second timeout
      });

      const responseTime = Date.now() - startTime;

      if (!response.ok) {
        return NextResponse.json({
          success: false,
          responseTime,
          error: `HTTP ${response.status}: ${response.statusText}`,
        } as WebhookTestResponse);
      }

      return NextResponse.json({
        success: true,
        responseTime,
      } as WebhookTestResponse);
    } catch (fetchError) {
      const responseTime = Date.now() - startTime;

      let errorMessage = "Unknown error";
      if (fetchError instanceof Error) {
        if (fetchError.name === "AbortError") {
          errorMessage = "Request timeout (30 seconds)";
        } else if (fetchError.name === "TypeError") {
          errorMessage = "Network error or invalid URL";
        } else {
          errorMessage = fetchError.message;
        }
      }

      return NextResponse.json({
        success: false,
        responseTime,
        error: errorMessage,
      } as WebhookTestResponse);
    }
  } catch (error) {
    console.error("Webhook test error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: "Invalid input data" } as WebhookTestResponse,
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: "Failed to test webhook",
      } as WebhookTestResponse,
      { status: 500 },
    );
  }
}
