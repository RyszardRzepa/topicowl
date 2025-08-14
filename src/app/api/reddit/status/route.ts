import { NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const clerk = await clerkClient();
    const user = await clerk.users.getUser(userId);
    const refreshToken = user.privateMetadata?.redditRefreshToken as string;

    return NextResponse.json({ 
      connected: !!refreshToken,
      connectedAt: user.privateMetadata?.redditConnectedAt as string | undefined
    });
  } catch (error) {
    console.error('Failed to check Reddit connection status:', error);
    return NextResponse.json(
      { error: 'Failed to check connection status' },
      { status: 500 }
    );
  }
}