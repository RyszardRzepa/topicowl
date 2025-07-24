import { auth } from '@clerk/nextjs/server';
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
      .where(eq(users.clerk_user_id, userId))
      .limit(1);

    if (dbUser.length === 0) {
      const response: OnboardingStatusResponse = {
        success: false,
        onboarding_completed: false,
        error: 'User not found in database',
      };
      
      return Response.json(response, { status: 404 });
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
