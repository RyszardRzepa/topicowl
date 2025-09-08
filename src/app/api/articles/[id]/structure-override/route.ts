import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/server/db";
import { articles, projects } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import type { ApiResponse, StructureTemplate } from "@/types";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" } as ApiResponse,
      { status: 401 },
    );
  }

  const articleId = parseInt(params.id, 10);
  const result = await db
    .select({ structureOverride: articles.structureOverride, projectId: articles.projectId, userId: projects.userId })
    .from(articles)
    .innerJoin(projects, eq(articles.projectId, projects.id))
    .where(eq(articles.id, articleId));

  const record = result[0];
  if (!record || record.userId !== userId) {
    return NextResponse.json(
      { success: false, error: "Not found" } as ApiResponse,
      { status: 404 },
    );
  }

  return NextResponse.json(
    { success: true, data: { structureOverride: record.structureOverride } } as ApiResponse,
  );
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" } as ApiResponse,
      { status: 401 },
    );
  }

  const articleId = parseInt(params.id, 10);
  const override = (await req.json()) as StructureTemplate;

  const ownership = await db
    .select({ projectId: articles.projectId, userId: projects.userId })
    .from(articles)
    .innerJoin(projects, eq(articles.projectId, projects.id))
    .where(eq(articles.id, articleId));

  const record = ownership[0];
  if (!record || record.userId !== userId) {
    return NextResponse.json(
      { success: false, error: "Not found" } as ApiResponse,
      { status: 404 },
    );
  }

  await db
    .update(articles)
    .set({ structureOverride: override, updatedAt: new Date() })
    .where(eq(articles.id, articleId));

  return NextResponse.json({ success: true } as ApiResponse);
}
