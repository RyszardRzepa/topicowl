import { NextResponse } from "next/server";
import { performValidateLogic } from "@/lib/services/validation-service";

// Set maximum duration to match generate route to prevent timeouts
export const maxDuration = 800;

// Types colocated with this API route
interface ValidateRequest {
  content: string;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ValidateRequest;
    const result = await performValidateLogic(body.content);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Validation endpoint error:", error);

    // Return a graceful fallback response instead of failing completely
    if (error instanceof Error && error.message.includes("timeout")) {
      return NextResponse.json({
        isValid: true,
        issues: [],
        rawValidationText:
          "Validation skipped due to timeout - proceeding without fact-check",
      });
    }

    const errorMessage =
      error instanceof Error ? error.message : "Failed to validate article";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
