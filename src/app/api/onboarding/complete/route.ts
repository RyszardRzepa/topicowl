import { auth } from '@clerk/nextjs/server';
import { cookies } from 'next/headers';
import { db } from '@/server/db';
import { users, projects, articleSettings } from '@/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import type { Project } from '@/types';

const projectDataSchema = z.object({
  name: z.string().min(1),
  websiteUrl: z.string().url(),
  companyName: z.string().optional().default(""),
  productDescription: z.string().optional().default(""),
  keywords: z.array(z.string()).optional().default([]),
  toneOfVoice: z.string().optional().default(""),
  articleStructure: z.string().optional().default(""),
  maxWords: z.number().int().min(800).max(2000).optional().default(800),
});

const onboardingCompleteSchema = z.object({
  projectData: projectDataSchema,
});

// Inline URL normalization
function normalizeWebsiteUrl(raw: string): { websiteUrl: string; domain: string } {
  const trimmed = raw.trim();
  const withProtocol = /^(https?:)?\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const url = new URL(withProtocol);
  const host = url.hostname.toLowerCase();
  const protocol = "https:";
  return { websiteUrl: `${protocol}//${host}${url.pathname.replace(/\/+$/g, "")}`, domain: host.replace(/^www\./, "") };
}

export async function POST(request: Request): Promise<Response> {
  try {
    // Get current user from Clerk
    const { userId } = await auth();
    
    if (!userId) {
      return Response.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }

    // Parse and validate request body
    const bodyRaw: unknown = await request.json();
    const validated = onboardingCompleteSchema.parse(bodyRaw);
    const { projectData } = validated;

    // Normalize website URL
    let normalized;
    try {
      normalized = normalizeWebsiteUrl(projectData.websiteUrl);
    } catch {
      return Response.json({ success: false, error: 'Invalid website URL' }, { status: 400 });
    }

    // Check if this user already has a project for this website URL
    const existing = await db
      .select({ id: projects.id, userId: projects.userId })
      .from(projects)
      .where(and(eq(projects.websiteUrl, normalized.websiteUrl), eq(projects.userId, userId)))
      .limit(1);

    let newProject: Project | undefined;

    if (existing.length > 0) {
      const existingProject = existing[0]!;
      
      // Update the existing project for this user
      const updated = await db
        .update(projects)
        .set({
          name: projectData.name,
          companyName: projectData.companyName,
          productDescription: projectData.productDescription,
          keywords: projectData.keywords,
          updatedAt: new Date(),
        })
        .where(eq(projects.id, existingProject.id))
        .returning();

      newProject = updated[0] as Project | undefined;
      
      if (!newProject) {
        return Response.json({ success: false, error: 'Failed to update project' }, { status: 500 });
      }

      // Upsert article settings for the project
      await db.insert(articleSettings).values({
        projectId: newProject.id,
        toneOfVoice: projectData.toneOfVoice,
        articleStructure: projectData.articleStructure,
        maxWords: projectData.maxWords,
      }).onConflictDoUpdate({
        target: articleSettings.projectId,
        set: {
          toneOfVoice: projectData.toneOfVoice,
          articleStructure: projectData.articleStructure,
          maxWords: projectData.maxWords,
          updatedAt: new Date(),
        }
      });
    } else {
      // Create new project
      const inserted = await db.insert(projects).values({
        userId,
        name: projectData.name,
        websiteUrl: normalized.websiteUrl,
        domain: normalized.domain,
        companyName: projectData.companyName,
        productDescription: projectData.productDescription,
        keywords: projectData.keywords,
        webhookEnabled: false,
        webhookEvents: ["article.published"],
      }).returning();

      newProject = inserted[0] as Project | undefined;
      if (!newProject) {
        return Response.json({ success: false, error: 'Failed to create project' }, { status: 500 });
      }

      // Create article settings for the project (using upsert in case settings already exist)
      await db.insert(articleSettings).values({
        projectId: newProject.id,
        toneOfVoice: projectData.toneOfVoice,
        articleStructure: projectData.articleStructure,
        maxWords: projectData.maxWords,
      }).onConflictDoUpdate({
        target: articleSettings.projectId,
        set: {
          toneOfVoice: projectData.toneOfVoice,
          articleStructure: projectData.articleStructure,
          maxWords: projectData.maxWords,
          updatedAt: new Date(),
        }
      });
    }

    // Update user's onboarding status to completed
    await db.update(users)
      .set({ 
        onboardingCompleted: true,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId));

    // Set project cookie to switch to the newly created project
    const cookieStore = await cookies();
    cookieStore.set('current-project-id', newProject.id.toString(), {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365, // 1 year
    });

    return Response.json({ 
      success: true, 
      message: 'Onboarding completed successfully',
      data: {
        projectId: newProject.id,
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ 
        success: false, 
        error: 'Validation failed',
        message: error.errors.map(e => e.message).join(', ')
      }, { status: 400 });
    }

    console.error('Error completing onboarding:', error);
    
    return Response.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    }, { status: 500 });
  }
}