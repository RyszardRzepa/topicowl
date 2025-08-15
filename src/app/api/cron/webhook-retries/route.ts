import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { webhookDeliveries, users } from "@/server/db/schema";
import { eq, and, lte } from "drizzle-orm";
import crypto from "crypto";

// Types colocated with this API route
export interface WebhookRetryResponse {
  success: boolean;
  processedCount: number;
  successCount: number;
  failedCount: number;
  error?: string;
}

// Generate webhook signature
function generateWebhookSignature(payload: string, secret: string): string {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  return `sha256=${hmac.digest('hex')}`;
}

// Calculate retry delay with exponential backoff
function calculateRetryDelay(attempt: number): number {
  const baseDelay = 30; // 30 seconds
  return baseDelay * Math.pow(2, attempt - 1);
}

// Determine if error should trigger retry
function shouldRetry(error: unknown, responseStatus?: number): boolean {
  // Retry for 5xx errors, timeouts, and network errors
  if (responseStatus && responseStatus >= 500) return true;
  if (responseStatus === 429) return true; // Rate limiting
  
  if (error instanceof Error) {
    if (error.name === 'AbortError') return true; // Timeout
    if (error.name === 'TypeError') return true; // Network error
  }
  
  // Don't retry for 4xx errors (except 429)
  if (responseStatus && responseStatus >= 400 && responseStatus < 500 && responseStatus !== 429) {
    return false;
  }
  
  return true;
}

export async function POST() {
  try {
    // Find webhook deliveries that need retry
    const now = new Date();
    const retryDeliveries = await db
      .select({
        delivery_id: webhookDeliveries.id,
        user_id: webhookDeliveries.userId,
        article_id: webhookDeliveries.articleId,
        webhook_url: webhookDeliveries.webhookUrl,
        event_type: webhookDeliveries.eventType,
        attempts: webhookDeliveries.attempts,
        max_attempts: webhookDeliveries.maxAttempts,
        request_payload: webhookDeliveries.requestPayload,
        webhook_secret: users.webhookSecret,
      })
      .from(webhookDeliveries)
      .innerJoin(users, eq(webhookDeliveries.userId, users.id))
      .where(
        and(
          eq(webhookDeliveries.status, 'retrying'),
          lte(webhookDeliveries.nextRetryAt, now)
        )
      );

    let processedCount = 0;
    let successCount = 0;
    let failedCount = 0;

    for (const delivery of retryDeliveries) {
      processedCount++;
      
      // Check if we've exceeded max attempts
      if (delivery.attempts >= delivery.max_attempts) {
        await db
          .update(webhookDeliveries)
          .set({
            status: 'failed',
            errorMessage: 'Maximum retry attempts exceeded',
            failedAt: new Date(),
          })
          .where(eq(webhookDeliveries.id, delivery.delivery_id));
        
        failedCount++;
        continue;
      }

      const payloadString = JSON.stringify(delivery.request_payload);
      
      // Prepare headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'Contentbot-Webhook/1.0',
        'X-Webhook-Event': delivery.event_type,
        'X-Webhook-Timestamp': Math.floor(Date.now() / 1000).toString(),
      };

      // Add signature if secret is provided
      if (delivery.webhook_secret) {
        headers['X-Webhook-Signature'] = generateWebhookSignature(
          payloadString, 
          delivery.webhook_secret
        );
      }

      // Attempt webhook delivery
      const startTime = Date.now();
      let responseStatus: number | undefined;
      let responseBody: string | undefined;
      let errorMessage: string | undefined;

      try {
        const response = await fetch(delivery.webhook_url, {
          method: 'POST',
          headers,
          body: payloadString,
          signal: AbortSignal.timeout(30000), // 30 second timeout
        });

        responseStatus = response.status;
        const deliveryTime = Date.now() - startTime;

        try {
          responseBody = await response.text();
        } catch {
          responseBody = 'Unable to read response body';
        }

        if (response.ok) {
          successCount++;
          
          // Update delivery record as successful
          await db
            .update(webhookDeliveries)
            .set({
              status: 'success',
              attempts: delivery.attempts + 1,
              responseStatus: responseStatus,
              responseBody: responseBody,
              deliveryTimeMs: deliveryTime,
              deliveredAt: new Date(),
            })
            .where(eq(webhookDeliveries.id, delivery.delivery_id));

        } else {
          errorMessage = `HTTP ${response.status}: ${response.statusText}`;
          
          // Check if we should retry again
          const nextAttempt = delivery.attempts + 1;
          if (nextAttempt < delivery.max_attempts && shouldRetry(null, responseStatus)) {
            const retryDelay = calculateRetryDelay(nextAttempt + 1);
            
            await db
              .update(webhookDeliveries)
              .set({
                status: 'retrying',
                attempts: nextAttempt,
                responseStatus: responseStatus,
                responseBody: responseBody,
                deliveryTimeMs: deliveryTime,
                errorMessage: errorMessage,
                nextRetryAt: new Date(Date.now() + retryDelay * 1000),
                retryBackoffSeconds: retryDelay,
              })
              .where(eq(webhookDeliveries.id, delivery.delivery_id));
          } else {
            failedCount++;
            await db
              .update(webhookDeliveries)
              .set({
                status: 'failed',
                attempts: nextAttempt,
                responseStatus: responseStatus,
                responseBody: responseBody,
                deliveryTimeMs: deliveryTime,
                errorMessage: errorMessage,
                failedAt: new Date(),
              })
              .where(eq(webhookDeliveries.id, delivery.delivery_id));
          }
        }

      } catch (fetchError) {
        const deliveryTime = Date.now() - startTime;
        
        if (fetchError instanceof Error) {
          if (fetchError.name === 'AbortError') {
            errorMessage = 'Request timeout (30 seconds)';
          } else if (fetchError.name === 'TypeError') {
            errorMessage = 'Network error or invalid URL';
          } else {
            errorMessage = fetchError.message;
          }
        } else {
          errorMessage = 'Unknown error';
        }

        // Check if we should retry again
        const nextAttempt = delivery.attempts + 1;
        if (nextAttempt < delivery.max_attempts && shouldRetry(fetchError, responseStatus)) {
          const retryDelay = calculateRetryDelay(nextAttempt + 1);
          
          await db
            .update(webhookDeliveries)
            .set({
              status: 'retrying',
              attempts: nextAttempt,
              deliveryTimeMs: deliveryTime,
              errorMessage: errorMessage,
              errorDetails: { error: fetchError instanceof Error ? fetchError.message : 'Unknown error' },
              nextRetryAt: new Date(Date.now() + retryDelay * 1000),
              retryBackoffSeconds: retryDelay,
            })
            .where(eq(webhookDeliveries.id, delivery.delivery_id));
        } else {
          failedCount++;
          await db
            .update(webhookDeliveries)
            .set({
              status: 'failed',
              attempts: nextAttempt,
              deliveryTimeMs: deliveryTime,
              errorMessage: errorMessage,
              errorDetails: { error: fetchError instanceof Error ? fetchError.message : 'Unknown error' },
              failedAt: new Date(),
            })
            .where(eq(webhookDeliveries.id, delivery.delivery_id));
        }
      }
    }

    return NextResponse.json({
      success: true,
      processedCount,
      successCount,
      failedCount,
    } as WebhookRetryResponse);

  } catch (error) {
    console.error('Webhook retry cron error:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        processedCount: 0,
        successCount: 0,
        failedCount: 0,
        error: 'Failed to process webhook retries',
      } as WebhookRetryResponse,
      { status: 500 }
    );
  }
}
