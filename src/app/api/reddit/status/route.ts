import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { db } from '@/server/db';
import { projects } from '@/server/db/schema';
import { eq, and } from 'drizzle-orm';
import type { ClerkPrivateMetadata, RedditConnectionStatus } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get project ID from query parameters
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json({ error: "Project ID is required" }, { status: 400 });
    }

    // Validate project ID format
    const projectIdNum = parseInt(projectId, 10);
    if (isNaN(projectIdNum)) {
      return NextResponse.json({ error: "Invalid project ID format" }, { status: 400 });
    }

    // Verify project exists and user owns it
    const [project] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, projectIdNum), eq(projects.userId, userId)))
      .limit(1);

    if (!project) {
      return NextResponse.json({ error: "Project not found or access denied" }, { status: 404 });
    }

    // Get user metadata and check for project-specific Reddit connection
    const clerk = await clerkClient();
    const user = await clerk.users.getUser(userId);
    const metadata = (user.privateMetadata ?? {}) as ClerkPrivateMetadata;
    
    const projectConnection = metadata.redditTokens?.[projectId];
    
    if (!projectConnection) {
      return NextResponse.json({
        connected: false,
      } satisfies RedditConnectionStatus);
    }

    return NextResponse.json({
      connected: true,
      connection: {
        projectId: projectIdNum,
        redditUsername: projectConnection.redditUsername,
        connectedAt: projectConnection.connectedAt,
        lastUsedAt: projectConnection.lastUsedAt,
        scopes: projectConnection.scopes,
      },
    } satisfies RedditConnectionStatus);
  } catch (error) {
    console.error('Failed to check Reddit connection status:', error);
    return NextResponse.json(
      { error: 'Failed to check connection status' },
      { status: 500 }
    );
  }
}