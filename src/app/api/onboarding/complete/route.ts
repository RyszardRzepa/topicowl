import { auth } from '@clerk/nextjs/server';
import { db } from '@/server/db';
import { users } from '@/server/db/schema';
import { eq } from 'drizzle-orm';

export interface CompleteOnboardingResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export async function POST(): Promise<Response> {
  try {
    // Authentication check
    const { userId } = await auth();
    if (!userId) {
      const response: CompleteOnboardingResponse = {
        success: false,
        error: 'Unauthorized',
      };
      return Response.json(response, { status: 401 });
    }

    // Mark onboarding as complete
    await db.update(users)
      .set({
        onboarding_completed: true,
        updatedAt: new Date(),
      })
      .where(eq(users.clerk_user_id, userId));
    
    const response: CompleteOnboardingResponse = {
      success: true,
      message: 'Onboarding completed successfully',
    };
    
    return Response.json(response);
  } catch (error) {
    console.error('Error completing onboarding:', error);
    
    const response: CompleteOnboardingResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
    
    return Response.json(response, { status: 500 });
  }
}
