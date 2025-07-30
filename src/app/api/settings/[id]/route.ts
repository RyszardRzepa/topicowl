import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { articleSettings } from "@/server/db/schema";
import { eq } from "drizzle-orm";
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
    const { id } = await params;
    const settingsId = parseInt(id);
    
    if (!settingsId || isNaN(settingsId)) {
      return NextResponse.json(
        { error: "Invalid settings ID" },
        { status: 400 }
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
    const { id } = await params;
    const settingsId = parseInt(id);
    
    if (!settingsId || isNaN(settingsId)) {
      return NextResponse.json(
        { error: "Invalid settings ID" },
        { status: 400 }
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
