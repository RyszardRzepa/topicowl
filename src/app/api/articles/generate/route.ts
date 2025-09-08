import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { auth } from "@clerk/nextjs/server";
import type { ApiResponse } from "@/types";
import { logServerError } from "@/lib/posthog-server";
import {
  validateAndSetupGeneration,
  generateArticle,
  claimArticleForGeneration,
} from "@/lib/services/generation-orchestrator";

export const maxDuration = 800;

export interface ArticleGenerationRequest {
  articleId: string;
  forceRegenerate?: boolean;
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" } as ApiResponse,
        { status: 401 },
      );
    }

    const body = (await req.json()) as ArticleGenerationRequest;
    const { articleId, forceRegenerate } = body;

    const context = await validateAndSetupGeneration(
      userId,
      articleId,
      forceRegenerate,
    );

    // Atomic claim to prevent races with cron/manual triggers
    const claim = await claimArticleForGeneration(parseInt(articleId, 10));
    if (claim !== "claimed") {
      const msg =
        claim === "already_generating"
          ? "Article generation already in progress"
          : "Article cannot be generated in current state";
      return NextResponse.json(
        { success: false, error: msg } as ApiResponse,
        { status: 409 },
      );
    }

    // Run generation in background (Vercel waitUntil)
    waitUntil(generateArticle(context));

    return NextResponse.json({
      success: true,
      data: {
        message: "Article generation started",
        articleId: articleId,
        relatedArticles: context.relatedArticles,
      },
    } as ApiResponse);
  } catch (error) {
    await logServerError(error, { operation: "generate_article" });
    return NextResponse.json(
      {
        success: false,
        error: "Error generating article. Please try again.",
      } as ApiResponse,
      { status: 500 },
    );
  }
}
