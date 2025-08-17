import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/server/db";
import { articleSettings, projects, users } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const articleSettingsUpdateSchema = z.object({
  toneOfVoice: z.string().optional(),
  articleStructure: z.string().optional(),
  maxWords: z.number().min(100).max(5000).optional(),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Get current user from Clerk
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verify user exists in database
    const [userRecord] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!userRecord) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const { id } = await params;
    const settingsId = parseInt(id);
    
    if (!settingsId || isNaN(settingsId)) {
      return NextResponse.json(
        { error: "Invalid settings ID" },
        { status: 400 }
      );
    }

    // Verify that the article settings belong to a project owned by the current user
    const [settingsRecord] = await db
      .select({
        id: articleSettings.id,
        projectId: articleSettings.projectId,
      })
      .from(articleSettings)
      .innerJoin(projects, eq(articleSettings.projectId, projects.id))
      .where(and(eq(articleSettings.id, settingsId), eq(projects.userId, userRecord.id)))
      .limit(1);

    if (!settingsRecord) {
      return NextResponse.json(
        { error: "Settings not found or access denied" },
        { status: 404 }
      );
    }

    const body = await req.json() as unknown;
    const validatedData = articleSettingsUpdateSchema.parse(body);
    
    const [updatedSettings] = await db
      .update(articleSettings)
      .set({
        ...validatedData,
        updatedAt: new Date(),
      })
      .where(eq(articleSettings.id, settingsId))
      .returning();

    if (!updatedSettings) {
      return NextResponse.json(
        { error: "Settings not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(updatedSettings);
  } catch (error) {
    console.error('Update settings error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input data', details: error.errors },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Get current user from Clerk
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verify user exists in database
    const [userRecord] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!userRecord) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const { id } = await params;
    const settingsId = parseInt(id);
    
    if (!settingsId || isNaN(settingsId)) {
      return NextResponse.json(
        { error: "Invalid settings ID" },
        { status: 400 }
      );
    }

    // Verify that the article settings belong to a project owned by the current user
    const [settingsRecord] = await db
      .select({
        id: articleSettings.id,
        projectId: articleSettings.projectId,
      })
      .from(articleSettings)
      .innerJoin(projects, eq(articleSettings.projectId, projects.id))
      .where(and(eq(articleSettings.id, settingsId), eq(projects.userId, userRecord.id)))
      .limit(1);

    if (!settingsRecord) {
      return NextResponse.json(
        { error: "Settings not found or access denied" },
        { status: 404 }
      );
    }

    // Reset to default values instead of deleting
    const [resetSettings] = await db
      .update(articleSettings)
      .set({
        toneOfVoice: "Professional and informative tone that speaks directly to business professionals. Use clear, authoritative language while remaining approachable and practical.",
        articleStructure: "introduction-body-conclusion",
        maxWords: 800,
        updatedAt: new Date(),
      })
      .where(eq(articleSettings.id, settingsId))
      .returning();

    if (!resetSettings) {
      return NextResponse.json(
        { error: "Settings not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ 
      message: "Settings reset to defaults",
      settings: resetSettings 
    });
  } catch (error) {
    console.error('Reset settings error:', error);
    return NextResponse.json(
      { error: 'Failed to reset settings' },
      { status: 500 }
    );
  }
}
