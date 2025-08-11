import { auth, currentUser } from '@clerk/nextjs/server';
import { db } from '@/server/db';
import { users } from '@/server/db/schema';
import { eq } from 'drizzle-orm';

export interface OnboardingStatusResponse {
  success: boolean;
  onboarding_completed: boolean;
  user?: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
  };
  error?: string;
}

export async function GET(): Promise<Response> {
  try {
    // Get current user from Clerk
    const { userId } = await auth();
    
    if (!userId) {
      const response: OnboardingStatusResponse = {
        success: false,
        onboarding_completed: false,
        error: 'Not authenticated',
      };
      
      return Response.json(response, { status: 401 });
    }

    // Get user from database
    const dbUser = await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        onboarding_completed: users.onboarding_completed,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (dbUser.length === 0) {
      // User not found in database - this can happen if webhook hasn't processed yet
      // Get user info from Clerk and create the record
      try {
        const clerkUser = await currentUser();
        
        if (!clerkUser) {
          const response: OnboardingStatusResponse = {
            success: false,
            onboarding_completed: false,
            error: 'User not found',
          };
          
          return Response.json(response, { status: 404 });
        }

        const primaryEmail = clerkUser.emailAddresses[0]?.emailAddress;
        
        if (!primaryEmail) {
          const response: OnboardingStatusResponse = {
            success: false,
            onboarding_completed: false,
            error: 'No email address found',
          };
          
          return Response.json(response, { status: 400 });
        }

        // Create user record inline
        const newUser = await db.insert(users).values({
          id: userId,
          email: primaryEmail,
          firstName: clerkUser.firstName,
          lastName: clerkUser.lastName,
          onboarding_completed: false,
        }).returning({
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          onboarding_completed: users.onboarding_completed,
        });

        const user = newUser[0]!;
        
        const response: OnboardingStatusResponse = {
          success: true,
          onboarding_completed: user.onboarding_completed,
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName ?? undefined,
            lastName: user.lastName ?? undefined,
          },
        };

        return Response.json(response);

      } catch (createError) {
        console.error('Error creating user record:', createError);
        
        // If we can't create the user, return a "pending" state
        const response: OnboardingStatusResponse = {
          success: true,
          onboarding_completed: false,
          error: 'User record creation pending',
        };
        
        return Response.json(response);
      }
    }

    const user = dbUser[0]!;
    
    const response: OnboardingStatusResponse = {
      success: true,
      onboarding_completed: user.onboarding_completed,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName ?? undefined,
        lastName: user.lastName ?? undefined,
      },
    };

    return Response.json(response);
  } catch (error) {
    console.error('Error checking onboarding status:', error);
    
    const response: OnboardingStatusResponse = {
      success: false,
      onboarding_completed: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
    
    return Response.json(response, { status: 500 });
  }
}
