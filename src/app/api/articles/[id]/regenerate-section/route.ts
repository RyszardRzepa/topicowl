import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import type { ApiResponse } from "@/types";
import { db } from "@/server/db";
import { articles, articleGeneration, projects } from "@/server/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { regenerateSection } from "@/lib/services/write-service";

interface Body {
  sectionId?: string;
  sectionHeading?: string; // exact H2 text to replace (used if present)
  notes?: string;
}

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" } as ApiResponse,
        { status: 401 },
      );
    }

    const articleId = parseInt(params.id, 10);
    if (!articleId || Number.isNaN(articleId)) {
      return NextResponse.json(
        { success: false, error: "Invalid article ID" } as ApiResponse,
        { status: 400 },
      );
    }

    const body = (await _req.json()) as Body;
    let sectionHeading = (body.sectionHeading ?? "").trim();

    // Ownership check (article belongs to user's project)
    const [art] = await db
      .select({ id: articles.id, projectId: articles.projectId, draft: articles.draft, title: articles.title, keywords: articles.keywords })
      .from(articles)
      .innerJoin(projects, eq(articles.projectId, projects.id))
      .where(and(eq(articles.id, articleId), eq(projects.userId, userId)))
      .limit(1);
    if (!art) {
      return NextResponse.json(
        { success: false, error: "Not found" } as ApiResponse,
        { status: 404 },
      );
    }

    // Load latest generation for research and notes
    const [gen] = await db
      .select()
      .from(articleGeneration)
      .where(eq(articleGeneration.articleId, articleId))
      .orderBy(desc(articleGeneration.createdAt))
      .limit(1);
    if (!gen) {
      return NextResponse.json(
        { success: false, error: "No generation found for this article" } as ApiResponse,
        { status: 404 },
      );
    }

    const currentDraft = (art.draft ?? gen.draftContent ?? "").toString();
    if (!currentDraft) {
      return NextResponse.json(
        { success: false, error: "No draft content available to regenerate" } as ApiResponse,
        { status: 400 },
      );
    }

    const keywords = Array.isArray(art.keywords) ? (art.keywords as string[]) : [];

    // If sectionId is provided and sectionHeading missing, attempt to map from outline
    if (!sectionHeading && body.sectionId) {
      const ol: unknown = gen.outline as unknown;
      if (ol && typeof ol === "object" && !Array.isArray(ol)) {
        const sections = (ol as any).sections as Array<{ id: string; type: string; label?: string }> | undefined;
        if (Array.isArray(sections)) {
          const s = sections.find((x) => x.id === body.sectionId);
          if (s) {
            if (s.type === "tldr") sectionHeading = "TL;DR";
            else if (s.type === "faq") sectionHeading = "FAQ";
            else if (s.type === "section") sectionHeading = s.label ?? s.id;
          }
        }
      }
      if (!sectionHeading) {
        return NextResponse.json(
          { success: false, error: "Unable to map sectionId to a heading; provide sectionHeading explicitly" } as ApiResponse,
          { status: 400 },
        );
      }
    }
    if (!sectionHeading) {
      return NextResponse.json(
        { success: false, error: "sectionHeading or sectionId is required" } as ApiResponse,
        { status: 400 },
      );
    }

    const { updatedContent, updatedSectionHeading } = await regenerateSection({
      articleMarkdown: currentDraft,
      sectionHeading,
      researchData: gen.researchData as any,
      title: art.title,
      keywords: keywords,
      notes: body.notes,
      userId,
      projectId: art.projectId,
      generationId: gen.id,
    });

    // Persist updates to article draft and generation snapshot
    await db.update(articles).set({ draft: updatedContent, updatedAt: new Date() }).where(eq(articles.id, articleId));
    await db.update(articleGeneration).set({ draftContent: updatedContent, updatedAt: new Date() }).where(eq(articleGeneration.id, gen.id));

    return NextResponse.json({
      success: true,
      data: { draft: updatedContent, updatedSectionHeading },
    } as ApiResponse);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to regenerate section" } as ApiResponse,
      { status: 500 },
    );
  }
}
