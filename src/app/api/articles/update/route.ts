import { NextResponse } from "next/server";
import { performUpdateLogic, performQualityControlUpdate, performGenericUpdate } from "@/lib/services/update-service";

export const maxDuration = 800;

// Types colocated with this API route
interface UpdateRequest {
  article: string;
  corrections?: string;
  validationIssues?: string;
  validationText?: string;
  qualityControlIssues?: string;
  settings?: {
    toneOfVoice?: string;
    articleStructure?: string;
    maxWords?: number;
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as UpdateRequest;

    if (!body.article) {
      return NextResponse.json(
        {
          error: "Article is required",
        },
        { status: 400 },
      );
    }

    if (!body.corrections && !body.validationIssues && !body.validationText && !body.qualityControlIssues) {
      return NextResponse.json(
        {
          error:
            "Either corrections, validationIssues, validationText, or qualityControlIssues are required",
        },
        { status: 400 },
      );
    }

    let result;

    // Determine which update function to call based on what's provided
    if (body.validationText) {
      result = await performUpdateLogic(body.article, body.validationText, body.settings);
    } else if (body.qualityControlIssues) {
      result = await performQualityControlUpdate(body.article, body.qualityControlIssues, body.settings);
    } else if (body.corrections ?? body.validationIssues) {
      const corrections = body.corrections ?? body.validationIssues ?? "";
      // For generic update, we need to create a proper request object
      result = await performGenericUpdate({
        article: body.article,
        corrections: [{ fact: "", issue: "", correction: corrections }],
        settings: body.settings,
      });
    } else {
      return NextResponse.json(
        {
          error: "No valid correction method specified",
        },
        { status: 400 },
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Update endpoint error:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to update article";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 },
    );
  }
}
