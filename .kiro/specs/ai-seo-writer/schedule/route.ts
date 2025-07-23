import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { articles } from "@/server/db/schema";
import { eq } from "drizzle-orm";

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json() as { 
      id: number; 
      scheduledAt: string | null; 
      status: 'draft' | 'scheduled' | 'published' | 'archived';
    };

    if (!body.id) {
      return NextResponse.json(
        { error: "Article ID is required" },
        { status: 400 }
      );
    }

    const updateData: {
      status: 'draft' | 'scheduled' | 'published' | 'archived';
      scheduledAt?: Date | null;
      publishedAt?: Date | null;
    } = {
      status: body.status,
    };

    if (body.status === 'scheduled' && body.scheduledAt) {
      const scheduledDate = new Date(body.scheduledAt);
      if (scheduledDate <= new Date()) {
        return NextResponse.json(
          { error: "Scheduled time must be in the future" },
          { status: 400 }
        );
      }
      updateData.scheduledAt = scheduledDate;
    } else if (body.status === 'published') {
      updateData.publishedAt = new Date();
      updateData.scheduledAt = null;
    } else {
      updateData.scheduledAt = null;
    }

    const [updatedArticle] = await db
      .update(articles)
      .set(updateData)
      .where(eq(articles.id, body.id))
      .returning();

    if (!updatedArticle) {
      return NextResponse.json(
        { error: "Article not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(updatedArticle);
  } catch (error) {
    console.error("Error updating article schedule:", error);
    return NextResponse.json(
      { error: "Failed to update article schedule" },
      { status: 500 }
    );
  }
}
