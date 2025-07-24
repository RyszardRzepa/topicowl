import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/server/db";
import { articleSettings, users } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

// Types colocated with this API route
export interface ArticleSettingsRequest {
  // Article generation settings
  toneOfVoice?: string;
  articleStructure?: string;
  maxWords?: number;
  // Company/business settings
  companyName?: string;
  productDescription?: string;
  keywords?: string[];
  industryCategory?: string;
  targetAudience?: string;
  publishingFrequency?: string;
}

export interface ArticleSettingsResponse {
  // Article settings from articleSettings table
  id: number;
  toneOfVoice: string;
  articleStructure: string;
  maxWords: number;
  createdAt: Date;
  updatedAt: Date;
  // Company settings from users table
  companyName?: string;
  productDescription?: string;
  keywords?: string[];
  domain?: string;
  industryCategory?: string;
  targetAudience?: string;
  publishingFrequency?: string;
}

const articleSettingsSchema = z.object({
  // Article generation settings
  toneOfVoice: z.string().optional(),
  articleStructure: z.string().optional(),
  maxWords: z.number().min(100).max(5000).optional(),
  // Company/business settings
  companyName: z.string().min(1).max(255).optional(),
  productDescription: z.string().max(1000).optional(),
  keywords: z.array(z.string()).max(20).optional(),
  industryCategory: z.string().optional(),
  targetAudience: z.string().max(255).optional(),
  publishingFrequency: z.enum(['daily', 'weekly', 'bi-weekly', 'monthly']).optional(),
});

export async function GET() {
  try {
    // Get current user from Clerk
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user record to access company settings
    const [userRecord] = await db
      .select({
        id: users.id,
        company_name: users.company_name,
        product_description: users.product_description,
        keywords: users.keywords,
        domain: users.domain,
      })
      .from(users)
      .where(eq(users.clerk_user_id, userId))
      .limit(1);

    if (!userRecord) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Get article settings
    const [articleSettingsRecord] = await db
      .select()
      .from(articleSettings)
      .where(eq(articleSettings.user_id, userRecord.id))
      .limit(1);
    
    if (!articleSettingsRecord) {
      // Return default settings if none exist
      const defaultSettings: ArticleSettingsResponse = {
        id: 0,
        toneOfVoice: "professional",
        articleStructure: "Introduction • Main points with subheadings • Practical tips • Conclusion",
        maxWords: 800,
        createdAt: new Date(),
        updatedAt: new Date(),
        companyName: userRecord.company_name ?? undefined,
        productDescription: userRecord.product_description ?? undefined,
        keywords: Array.isArray(userRecord.keywords) ? userRecord.keywords as string[] : [],
        domain: userRecord.domain ?? undefined,
      };
      
      return NextResponse.json(defaultSettings);
    }
    
    // Combine article settings with user company data
    const combinedSettings: ArticleSettingsResponse = {
      ...articleSettingsRecord,
      companyName: userRecord.company_name ?? undefined,
      productDescription: userRecord.product_description ?? undefined,
      keywords: Array.isArray(userRecord.keywords) ? userRecord.keywords as string[] : [],
      domain: userRecord.domain ?? undefined,
    };
    
    return NextResponse.json(combinedSettings);
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
    // Get current user from Clerk
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await req.json() as unknown;
    const validatedData = articleSettingsSchema.parse(body);
    
    // Get user record
    const [userRecord] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerk_user_id, userId))
      .limit(1);

    if (!userRecord) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Use transaction to update both tables
    const result = await db.transaction(async (tx) => {
      // Extract company settings for users table
      const {
        companyName,
        productDescription,
        keywords,
        industryCategory,
        targetAudience,
        publishingFrequency,
        ...articleSettingsData
      } = validatedData;

      // Update user company data if provided
      if (companyName !== undefined || productDescription !== undefined || keywords !== undefined) {
        await tx
          .update(users)
          .set({
            ...(companyName !== undefined && { company_name: companyName }),
            ...(productDescription !== undefined && { product_description: productDescription }),
            ...(keywords !== undefined && { keywords: keywords }),
            updatedAt: new Date(),
          })
          .where(eq(users.clerk_user_id, userId));
      }

      // Check if article settings already exist for this user
      const [existingSettings] = await tx
        .select({ id: articleSettings.id })
        .from(articleSettings)
        .where(eq(articleSettings.user_id, userRecord.id))
        .limit(1);
      
      let updatedArticleSettings;
      
      if (existingSettings) {
        // Update existing article settings
        [updatedArticleSettings] = await tx
          .update(articleSettings)
          .set({
            ...articleSettingsData,
            updatedAt: new Date(),
          })
          .where(eq(articleSettings.id, existingSettings.id))
          .returning();
      } else {
        // Create new article settings
        [updatedArticleSettings] = await tx
          .insert(articleSettings)
          .values({
            user_id: userRecord.id,
            ...articleSettingsData,
          })
          .returning();
      }

      // Get updated user data for response
      const [updatedUser] = await tx
        .select({
          company_name: users.company_name,
          product_description: users.product_description,
          keywords: users.keywords,
          domain: users.domain,
        })
        .from(users)
        .where(eq(users.clerk_user_id, userId))
        .limit(1);

      // Combine for response
      const combinedResponse: ArticleSettingsResponse = {
        ...updatedArticleSettings!,
        companyName: updatedUser?.company_name ?? undefined,
        productDescription: updatedUser?.product_description ?? undefined,
        keywords: Array.isArray(updatedUser?.keywords) ? updatedUser.keywords as string[] : [],
        domain: updatedUser?.domain ?? undefined,
        industryCategory,
        targetAudience,
        publishingFrequency,
      };

      return combinedResponse;
    });
    
    return NextResponse.json(result);
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
