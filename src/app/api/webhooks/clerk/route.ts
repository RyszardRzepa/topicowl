import type { NextRequest } from 'next/server';
import { headers } from 'next/headers';
import { Webhook } from 'svix';
import type { WebhookEvent } from '@clerk/nextjs/server';
import { db } from '@/server/db';
import { users } from '@/server/db/schema';
import { eq } from 'drizzle-orm';

export interface ClerkWebhookResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export async function POST(request: NextRequest): Promise<Response> {
  // Get webhook secret from environment
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;
  
  if (!WEBHOOK_SECRET) {
    throw new Error('Please add CLERK_WEBHOOK_SECRET from Clerk Dashboard to .env or .env.local');
  }

  // Get headers
  const headerPayload = await headers();
  const svix_id = headerPayload.get('svix-id');
  const svix_timestamp = headerPayload.get('svix-timestamp');
  const svix_signature = headerPayload.get('svix-signature');

  // If there are no headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response('Error occured -- no svix headers', {
      status: 400,
    });
  }

  // Get body
  const payload: unknown = await request.json();
  const body = JSON.stringify(payload);

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
    console.error('Error verifying webhook:', err);
    return new Response('Error occured', {
      status: 400,
    });
  }

  // Handle the webhook
  const { type, data } = evt;

  try {
    switch (type) {
      case 'user.created':
        // Create user record inline
        await db.insert(users).values({
          clerk_user_id: data.id,
          email: data.email_addresses[0]?.email_address ?? '',
          firstName: data.first_name ?? null,
          lastName: data.last_name ?? null,
          onboarding_completed: false,
        });
        
        console.log(`User created: ${data.id}`);
        break;
        
      case 'user.updated':
        // Update user record inline
        await db.update(users)
          .set({
            email: data.email_addresses[0]?.email_address ?? '',
            firstName: data.first_name ?? null,
            lastName: data.last_name ?? null,
            updatedAt: new Date(),
          })
          .where(eq(users.clerk_user_id, data.id));
          
        console.log(`User updated: ${data.id}`);
        break;
        
      case 'user.deleted':
        // Handle user deletion
        if (data.id) {
          await db.delete(users)
            .where(eq(users.clerk_user_id, data.id));
            
          console.log(`User deleted: ${data.id}`);
        }
        break;
        
      default:
        console.log(`Unhandled webhook type: ${type}`);
    }

    const response: ClerkWebhookResponse = {
      success: true,
      message: `Webhook ${type} processed successfully`,
    };

    return Response.json(response);
  } catch (error) {
    console.error('Error processing webhook:', error);
    
    const response: ClerkWebhookResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
    
    return Response.json(response, { status: 500 });
  }
}
