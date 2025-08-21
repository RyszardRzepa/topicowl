import type { NextRequest } from "next/server";
import { BASE_URL } from "@/constants";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("session_id");

    if (!sessionId) {
      console.error("No session_id provided in success callback");
      return Response.redirect(
        new URL("/dashboard?error=missing_session", BASE_URL),
      );
    }

    // TODO: Implement Stripe success handling when payment integration is ready
    console.log("Payment success callback received for session:", sessionId);

    // For now, redirect to dashboard with success message
    return Response.redirect(
      new URL("/dashboard?success=payment_complete", BASE_URL),
    );
  } catch (error) {
    console.error("Success page error:", error);
    return Response.redirect(
      new URL("/dashboard?error=processing_error", BASE_URL),
    );
  }
}
