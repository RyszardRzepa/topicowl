import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { articleSettings } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

// Types colocated with this API route
export interface ArticleSettingsRequest {
  toneOfVoice?: string;
  articleStructure?: string;
  maxWords?: number;
}

const articleSettingsSchema = z.object({
  toneOfVoice: z.string().optional(),
  articleStructure: z.string().optional(),
  maxWords: z.number().min(100).max(5000).optional(),
});

export async function GET() {
  try {
    const settings = await db.select().from(articleSettings).limit(1);
    
    if (settings.length === 0) {
      // Return default settings if none exist
      const defaultSettings = {
        id: 0,
        toneOfVoice: "professional",
        articleStructure: "introduction-body-conclusion",
        maxWords: 800,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      return NextResponse.json(defaultSettings);
    }
    
    return NextResponse.json(settings[0]);
  } catch (error) {
    console.error('Get settings error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve settings' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as unknown;
    const validatedData = articleSettingsSchema.parse(body);
    
    // Check if settings already exist
    const existingSettings = await db.select().from(articleSettings).limit(1);
    
    if (existingSettings.length > 0) {
      // Update existing settings
      const [updatedSettings] = await db
        .update(articleSettings)
        .set({
          ...validatedData,
          updatedAt: new Date(),
        })
        .where(eq(articleSettings.id, existingSettings[0]!.id))
        .returning();
      
      return NextResponse.json(updatedSettings);
    } else {
      // Create new settings
      const [newSettings] = await db
        .insert(articleSettings)
        .values({
          ...validatedData,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();
      
      return NextResponse.json(newSettings);
    }
  } catch (error) {
    console.error('Create/update settings error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input data', details: error.errors },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to save settings' },
      { status: 500 }
    );
  }
}
