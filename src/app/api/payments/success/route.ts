import type { NextRequest } from "next/server";
import { BASE_URL, PRICING_PLANS } from "@/constants";
import { env } from "@/env";
import { db } from "@/server/db";
import { userCredits } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import Stripe from "stripe";

const stripe = new Stripe(env.STRIPE_PRIVATE_KEY!);

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

    // Verify the checkout session with Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["payment_intent"],
    });

    // Verify payment was successful
    if (session.payment_status !== "paid") {
      console.error(
        "Payment not completed for session:",
        sessionId,
        "Status:",
        session.payment_status,
      );
      return Response.redirect(
        new URL("/dashboard?error=payment_not_completed", BASE_URL),
      );
    }

    // Extract metadata
    const userId = session.metadata?.userId;
    const planKey = session.metadata?.planKey as keyof typeof PRICING_PLANS;

    if (!userId || !planKey) {
      console.error("Missing metadata in session:", sessionId, {
        userId,
        planKey,
      });
      return Response.redirect(
        new URL("/dashboard?error=missing_metadata", BASE_URL),
      );
    }

    // Validate plan exists
    const plan = PRICING_PLANS[planKey];
    if (!plan) {
      console.error("Invalid plan key:", planKey);
      return Response.redirect(
        new URL("/dashboard?error=invalid_plan", BASE_URL),
      );
    }

    // Check if we've already processed this payment (idempotency)
    const paymentIntentId =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id;

    if (!paymentIntentId) {
      console.error("No payment intent found for session:", sessionId);
      return Response.redirect(
        new URL("/dashboard?error=no_payment_intent", BASE_URL),
      );
    }

    // Add credits to user account
    try {
      // Get current user credits
      const currentCredits = await db.query.userCredits.findFirst({
        where: eq(userCredits.userId, userId),
      });

      const currentAmount = currentCredits?.amount ?? 0;
      const newAmount = currentAmount + plan.credits;

      // Use transaction to ensure atomicity
      await db.transaction(async (tx) => {
        // Update or create user credits
        if (currentCredits) {
          await tx
            .update(userCredits)
            .set({
              amount: newAmount,
              updatedAt: new Date(),
            })
            .where(eq(userCredits.userId, userId));
        } else {
          await tx.insert(userCredits).values({
            userId,
            amount: plan.credits,
          });
        }
      });

      console.log(
        `Successfully added ${plan.credits} credits to user ${userId} for plan ${planKey}`,
      );

      // Redirect to dashboard with success message and credit info
      return Response.redirect(
        new URL(
          `/dashboard?success=payment_complete&credits=${plan.credits}&plan=${planKey}`,
          BASE_URL,
        ),
      );
    } catch (dbError) {
      console.error("Database error adding credits:", dbError);
      return Response.redirect(
        new URL("/dashboard?error=credit_processing_failed", BASE_URL),
      );
    }
  } catch (error) {
    console.error("Success page error:", error);
    return Response.redirect(
      new URL("/dashboard?error=processing_error", BASE_URL),
    );
  }
}
