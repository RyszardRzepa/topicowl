import { NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';

export async function POST() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const clerk = await clerkClient();
    const user = await clerk.users.getUser(userId);
    
    // Remove Reddit tokens from private metadata
    const updatedMetadata = { ...user.privateMetadata };
    delete updatedMetadata.redditRefreshToken;
    delete updatedMetadata.redditConnectedAt;

    await clerk.users.updateUserMetadata(userId, {
      privateMetadata: updatedMetadata
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to disconnect Reddit account:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect Reddit account' },
      { status: 500 }
    );
  }
}