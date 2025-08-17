import { auth } from '@clerk/nextjs/server';
import { db } from '@/server/db';
import { users } from '@/server/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(): Promise<Response> {
  try {
    // Get current user from Clerk
    const { userId } = await auth();
    
    if (!userId) {
      return Response.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }

    // Update user's onboarding status to completed
    const updatedUser = await db
      .update(users)
      .set({ 
        onboardingCompleted: true,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId))
      .returning({
        id: users.id,
        email: users.email,
        onboardingCompleted: users.onboardingCompleted,
      });

    if (updatedUser.length === 0) {
      return Response.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const user = updatedUser[0]!;
    
    return Response.json({ 
      success: true, 
      message: 'Onboarding status updated successfully',
      user: {
        id: user.id,
        email: user.email,
        onboardingCompleted: user.onboardingCompleted,
      }
    });
  } catch (error) {
    console.error('Error updating onboarding status:', error);
    
    return Response.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    }, { status: 500 });
  }
}