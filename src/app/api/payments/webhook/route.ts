import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { env } from "@/env";
import { db } from "@/server/db";
import { userCredits } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { PRICING_PLANS } from "@/constants";
import Stripe from "stripe";

const stripe = new Stripe(env.STRIPE_PRIVATE_KEY!);
const endpointSecret = env.STRIPE_WEBHOOK_SECRET!;

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    console.error("No Stripe signature found");
    return NextResponse.json({ error: "No signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, endpointSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // Handle the event
  switch (event.type) {
    case "payment_intent.succeeded": {
      const paymentIntent = event.data.object;
      await handlePaymentSuccess(paymentIntent);
      break;
    }
    case "payment_intent.payment_failed": {
      const paymentIntent = event.data.object;
      await handlePaymentFailure(paymentIntent);
      break;
    }
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  return NextResponse.json({ received: true });
}

async function handlePaymentSuccess(paymentIntent: Stripe.PaymentIntent) {
  try {
    const userId = paymentIntent.metadata?.userId;
    const planKey = paymentIntent.metadata
      ?.planKey as keyof typeof PRICING_PLANS;

    if (!userId || !planKey) {
      console.error("Missing metadata in payment intent:", paymentIntent.id, {
        userId,
        planKey,
      });
      return;
    }

    // Validate plan exists
    const plan = PRICING_PLANS[planKey];
    if (!plan) {
      console.error("Invalid plan key:", planKey);
      return;
    }

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
      `[WEBHOOK] Successfully added ${plan.credits} credits to user ${userId} for plan ${planKey} (Payment Intent: ${paymentIntent.id})`,
    );
  } catch (error) {
    console.error("[WEBHOOK] Error processing payment success:", error);
  }
}

async function handlePaymentFailure(paymentIntent: Stripe.PaymentIntent) {
  const userId = paymentIntent.metadata?.userId;
  const planKey = paymentIntent.metadata?.planKey;

  console.log(
    `[WEBHOOK] Payment failed for user ${userId}, plan ${planKey} (Payment Intent: ${paymentIntent.id})`,
  );

  // Optionally, you could implement failure handling logic here
  // such as sending an email notification or logging to analytics
}
