import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/server/db";
import { projects } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
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

  const projectId = parseInt(params.id, 10);
  const [project] = await db
    .select({ structureTemplate: projects.structureTemplate, userId: projects.userId })
    .from(projects)
    .where(eq(projects.id, projectId));

  if (!project || project.userId !== userId) {
    return NextResponse.json(
      { success: false, error: "Not found" } as ApiResponse,
      { status: 404 },
    );
  }

  return NextResponse.json(
    { success: true, data: { structureTemplate: project.structureTemplate } } as ApiResponse,
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

  const projectId = parseInt(params.id, 10);
  const template = (await req.json()) as StructureTemplate;

  const result = await db
    .update(projects)
    .set({ structureTemplate: template, updatedAt: new Date() })
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .returning({ id: projects.id });

  if (result.length === 0) {
    return NextResponse.json(
      { success: false, error: "Not found" } as ApiResponse,
      { status: 404 },
    );
  }

  return NextResponse.json({ success: true } as ApiResponse);
}
