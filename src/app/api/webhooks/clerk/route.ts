import type { NextRequest } from 'next/server';
import { headers } from 'next/headers';
import { Webhook } from 'svix';
import type { WebhookEvent } from '@clerk/nextjs/server';
import { db } from '@/server/db';
import { users } from '@/server/db/schema';
import { eq } from 'drizzle-orm';
import { env } from '@/env';

export interface ClerkWebhookResponse {
  success: boolean;
  message?: string;
  error?: string;
}

// Types for Clerk webhook data
interface ClerkEmailAddress {
  email_address: string;
  id: string;
}

interface ClerkUserData {
  id: string;
  email_addresses: ClerkEmailAddress[];
  first_name?: string | null;
  last_name?: string | null;
}

interface LogData {
  [key: string]: unknown;
  email_addresses?: Array<{
    id: string;
    email_address: string | null;
  }>;
}

// Enhanced logging utility for webhook events
function logWebhookEvent(level: 'info' | 'warn' | 'error', message: string, data?: Record<string, unknown>) {
  const timestamp = new Date().toISOString();
  const logData: LogData = data ? { ...data } : {};
  
  // Remove sensitive data from logs
  if (logData.email_addresses && Array.isArray(logData.email_addresses)) {
    logData.email_addresses = logData.email_addresses.map((addr) => ({
      ...addr,
      email_address: typeof addr.email_address === 'string' && addr.email_address 
        ? `${addr.email_address.split('@')[0]}@***` 
        : null
    }));
  }
  
  console[level](`[CLERK_WEBHOOK] ${timestamp} - ${message}`, logData);
}

// Validate user data from Clerk webhook
function validateUserData(data: unknown): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!data || typeof data !== 'object') {
    errors.push('Invalid data object');
    return { isValid: false, errors };
  }
  
  const userData = data as Record<string, unknown>;
  
  if (!userData.id || typeof userData.id !== 'string') {
    errors.push('Missing or invalid user ID');
  }
  
  if (!userData.email_addresses || !Array.isArray(userData.email_addresses) || userData.email_addresses.length === 0) {
    errors.push('Missing or invalid email addresses');
  } else {
    const primaryEmail = userData.email_addresses[0] as Record<string, unknown>;
    if (!primaryEmail?.email_address || typeof primaryEmail.email_address !== 'string' || !primaryEmail.email_address.includes('@')) {
      errors.push('Invalid primary email address');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

// Extract safe user data with fallbacks
function extractUserData(data: unknown) {
  const userData = data as ClerkUserData;
  const primaryEmail = userData.email_addresses?.[0]?.email_address;
  
  return {
    clerk_user_id: userData.id,
    email: primaryEmail ?? '',
    firstName: userData.first_name && typeof userData.first_name === 'string' ? userData.first_name : null,
    lastName: userData.last_name && typeof userData.last_name === 'string' ? userData.last_name : null,
  };
}

export async function POST(request: NextRequest): Promise<Response> {
  const startTime = Date.now();
  
  try {
    // Get webhook secret from environment
    const WEBHOOK_SECRET = env.CLERK_WEBHOOK_SECRET;
    
    if (!WEBHOOK_SECRET) {
      logWebhookEvent('error', 'Missing CLERK_WEBHOOK_SECRET environment variable');
      return Response.json(
        { success: false, error: 'Webhook secret not configured' } as ClerkWebhookResponse,
        { status: 500 }
      );
    }

    // Get headers with validation
    const headerPayload = await headers();
    const svix_id = headerPayload.get('svix-id');
    const svix_timestamp = headerPayload.get('svix-timestamp');
    const svix_signature = headerPayload.get('svix-signature');

    // Validate required headers
    if (!svix_id || !svix_timestamp || !svix_signature) {
      logWebhookEvent('warn', 'Missing required svix headers', {
        svix_id: !!svix_id,
        svix_timestamp: !!svix_timestamp,
        svix_signature: !!svix_signature
      });
      
      return Response.json(
        { success: false, error: 'Missing required webhook headers' } as ClerkWebhookResponse,
        { status: 400 }
      );
    }

    // Get and validate body
    let payload: unknown;
    let body: string;
    
    try {
      payload = await request.json();
      body = JSON.stringify(payload);
    } catch (err) {
      logWebhookEvent('error', 'Failed to parse webhook body', { error: err });
      return Response.json(
        { success: false, error: 'Invalid JSON payload' } as ClerkWebhookResponse,
        { status: 400 }
      );
    }

    // Create new Svix instance with webhook secret
    const wh = new Webhook(WEBHOOK_SECRET);
    let evt: WebhookEvent;

    // Verify payload with headers
    try {
      evt = wh.verify(body, {
        'svix-id': svix_id,
        'svix-timestamp': svix_timestamp,
        'svix-signature': svix_signature,
      }) as WebhookEvent;
    } catch (err) {
      logWebhookEvent('error', 'Webhook signature verification failed', { 
        error: err instanceof Error ? err.message : 'Unknown error',
        svix_id 
      });
      
      return Response.json(
        { success: false, error: 'Webhook signature verification failed' } as ClerkWebhookResponse,
        { status: 400 }
      );
    }

    // Handle the webhook with enhanced error handling and logging
    const { type, data } = evt;
    
    logWebhookEvent('info', `Processing webhook event: ${type}`, { 
      userId: data.id,
      eventType: type 
    });

    try {
      switch (type) {
        case 'user.created': {
          // Validate user data before processing
          const validation = validateUserData(data);
          if (!validation.isValid) {
            logWebhookEvent('warn', 'Invalid user data in user.created event', {
              userId: data.id,
              errors: validation.errors
            });
            
            return Response.json(
              { 
                success: false, 
                error: `Invalid user data: ${validation.errors.join(', ')}` 
              } as ClerkWebhookResponse,
              { status: 400 }
            );
          }

          const userData = extractUserData(data);
          
          try {
            // Use INSERT with ON CONFLICT to handle duplicates gracefully
            await db.insert(users).values({
              ...userData,
              onboarding_completed: false,
            }).onConflictDoUpdate({
              target: users.clerk_user_id,
              set: {
                email: userData.email,
                firstName: userData.firstName,
                lastName: userData.lastName,
                updatedAt: new Date(),
              }
            });
            
            logWebhookEvent('info', 'User created/updated successfully', {
              userId: data.id,
              email: userData.email ? `${userData.email.split('@')[0]}@***` : null
            });
          } catch (dbError) {
            logWebhookEvent('error', 'Database error during user creation', {
              userId: data.id,
              error: dbError instanceof Error ? dbError.message : 'Unknown database error'
            });
            
            return Response.json(
              { 
                success: false, 
                error: 'Failed to create user record' 
              } as ClerkWebhookResponse,
              { status: 500 }
            );
          }
          break;
        }
        
        case 'user.updated': {
          // Validate user data before processing
          const validation = validateUserData(data);
          if (!validation.isValid) {
            logWebhookEvent('warn', 'Invalid user data in user.updated event', {
              userId: data.id,
              errors: validation.errors
            });
            
            // For updates, we can be more lenient - just log the warning and continue
            logWebhookEvent('info', 'Proceeding with partial user update despite validation warnings');
          }

          const userData = extractUserData(data);
          
          try {
            await db.update(users)
              .set({
                email: userData.email,
                firstName: userData.firstName,
                lastName: userData.lastName,
                updatedAt: new Date(),
              })
              .where(eq(users.clerk_user_id, data.id));
              
            logWebhookEvent('info', 'User updated successfully', {
              userId: data.id,
              email: userData.email ? `${userData.email.split('@')[0]}@***` : null
            });
          } catch (dbError) {
            logWebhookEvent('error', 'Database error during user update', {
              userId: data.id,
              error: dbError instanceof Error ? dbError.message : 'Unknown database error'
            });
            
            return Response.json(
              { 
                success: false, 
                error: 'Failed to update user record' 
              } as ClerkWebhookResponse,
              { status: 500 }
            );
          }
          break;
        }
        
        case 'user.deleted': {
          if (!data.id) {
            logWebhookEvent('warn', 'Missing user ID in user.deleted event');
            return Response.json(
              { 
                success: false, 
                error: 'Missing user ID for deletion' 
              } as ClerkWebhookResponse,
              { status: 400 }
            );
          }
          
          try {
            await db.delete(users)
              .where(eq(users.clerk_user_id, data.id));
              
            logWebhookEvent('info', 'User deleted successfully', {
              userId: data.id
            });
          } catch (dbError) {
            logWebhookEvent('error', 'Database error during user deletion', {
              userId: data.id,
              error: dbError instanceof Error ? dbError.message : 'Unknown database error'
            });
            
            return Response.json(
              { 
                success: false, 
                error: 'Failed to delete user record' 
              } as ClerkWebhookResponse,
              { status: 500 }
            );
          }
          break;
        }
        
        default:
          logWebhookEvent('warn', `Unhandled webhook type: ${type}`, { eventType: type });
          
          // Return success for unhandled events to prevent retries
          return Response.json({
            success: true,
            message: `Webhook type ${type} acknowledged but not processed`
          } as ClerkWebhookResponse);
      }

      const processingTime = Date.now() - startTime;
      logWebhookEvent('info', `Webhook ${type} processed successfully`, {
        userId: data.id,
        processingTimeMs: processingTime
      });

      const response: ClerkWebhookResponse = {
        success: true,
        message: `Webhook ${type} processed successfully`,
      };

      return Response.json(response);
      
    } catch (error) {
      const processingTime = Date.now() - startTime;
      logWebhookEvent('error', 'Unexpected error processing webhook', {
        eventType: type,
        userId: data.id,
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTimeMs: processingTime,
        stack: error instanceof Error ? error.stack : undefined
      });
      
      const response: ClerkWebhookResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
      
      return Response.json(response, { status: 500 });
    }
    
  } catch (error) {
    // Catch-all for any errors in the outer try block
    const processingTime = Date.now() - startTime;
    logWebhookEvent('error', 'Critical error in webhook handler', {
      error: error instanceof Error ? error.message : 'Unknown critical error',
      processingTimeMs: processingTime,
      stack: error instanceof Error ? error.stack : undefined
    });
    
    return Response.json(
      { 
        success: false, 
        error: 'Internal server error' 
      } as ClerkWebhookResponse,
      { status: 500 }
    );
  }
}
