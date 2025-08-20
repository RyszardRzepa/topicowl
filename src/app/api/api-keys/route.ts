import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/server/db';
import { users, apiKeys, projects } from '@/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { randomBytes, createHash } from 'crypto';

// POST /api/api-keys - create API key for project if none exists
export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get projectId from request body
    const body: unknown = await request.json();
    const { projectId } = body as { projectId?: number };
    if (!projectId || typeof projectId !== 'number') {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
    }

    // Verify user exists
    const [userRecord] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!userRecord) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Verify project ownership
    const [projectRecord] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, userRecord.id)))
      .limit(1);

    if (!projectRecord) {
      return NextResponse.json({ error: 'Project not found or access denied' }, { status: 404 });
    }

    // Check if key already exists for this project
    const existing = await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.projectId, projectId))
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json({ error: 'API key already exists for this project' }, { status: 400 });
    }

    // Generate 40-byte random key (hex -> 80 chars) for sufficient entropy
    const rawKey = randomBytes(40).toString('hex');
    const keyHash = createHash('sha256').update(rawKey).digest('hex');

    await db.insert(apiKeys).values({ projectId, keyHash });

    // Return plaintext ONLY once
    return NextResponse.json({ apiKey: rawKey }, { status: 201 });
  } catch (error) {
    console.error('Create API key error:', error);
    return NextResponse.json({ error: 'Failed to create API key' }, { status: 500 });
  }
}

// GET /api/api-keys - get API key metadata for project (without plaintext key)
export async function GET(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get projectId from query params
    const url = new URL(request.url);
    const projectIdParam = url.searchParams.get('projectId');
    if (!projectIdParam) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
    }

    const projectId = parseInt(projectIdParam, 10);
    if (isNaN(projectId)) {
      return NextResponse.json({ error: 'Invalid projectId' }, { status: 400 });
    }

    // Verify user exists
    const [userRecord] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!userRecord) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Verify project ownership
    const [projectRecord] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, userRecord.id)))
      .limit(1);

    if (!projectRecord) {
      return NextResponse.json({ error: 'Project not found or access denied' }, { status: 404 });
    }

    // Get key metadata (never return plaintext key)
    const [keyRecord] = await db
      .select({
        id: apiKeys.id,
        createdAt: apiKeys.createdAt,
        updatedAt: apiKeys.updatedAt,
      })
      .from(apiKeys)
      .where(eq(apiKeys.projectId, projectId))
      .limit(1);

    if (!keyRecord) {
      return NextResponse.json({ hasKey: false }, { status: 200 });
    }

    return NextResponse.json({
      hasKey: true,
      keyId: keyRecord.id,
      createdAt: keyRecord.createdAt,
      lastRefreshed: keyRecord.updatedAt,
    });
  } catch (error) {
    console.error('Get API key metadata error:', error);
    return NextResponse.json({ error: 'Failed to get API key info' }, { status: 500 });
  }
}// DELETE /api/api-keys - refresh API key for project (delete old, generate new)
export async function DELETE(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get projectId from request body
    const body: unknown = await request.json();
    const { projectId } = body as { projectId?: number };
    if (!projectId || typeof projectId !== 'number') {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
    }

    // Verify user exists
    const [userRecord] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!userRecord) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Verify project ownership
    const [projectRecord] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, userRecord.id)))
      .limit(1);

    if (!projectRecord) {
      return NextResponse.json({ error: 'Project not found or access denied' }, { status: 404 });
    }

    // Check if key exists for this project
    const existing = await db
      .select({ id: apiKeys.id })
      .from(apiKeys)
      .where(eq(apiKeys.projectId, projectId))
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json({ error: 'No API key exists for this project' }, { status: 404 });
    }

    // Delete existing key and create new one (refresh workflow)
    const rawKey = randomBytes(40).toString('hex');
    const keyHash = createHash('sha256').update(rawKey).digest('hex');

    await db.transaction(async (tx) => {
      // Delete old key
      await tx.delete(apiKeys).where(eq(apiKeys.projectId, projectId));
      // Insert new key
      await tx.insert(apiKeys).values({ projectId, keyHash });
    });

    return NextResponse.json({ apiKey: rawKey }, { status: 200 });
  } catch (error) {
    console.error('Refresh API key error:', error);
    return NextResponse.json({ error: 'Failed to refresh API key' }, { status: 500 });
  }
}
