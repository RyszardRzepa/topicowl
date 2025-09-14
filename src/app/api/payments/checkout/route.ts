import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { db } from "@/server/db/index";
import { users } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { PRICING_PLANS, API_BASE_URL } from "@/constants";
import { CREDIT_COSTS } from "@/lib/utils/credit-costs";
import { env } from "@/env";
import Stripe from "stripe";
import { logServerError } from "@/lib/posthog-server";

const stripe = new Stripe(env.STRIPE_PRIVATE_KEY!);

const checkoutSchema = z.object({
  planKey: z.enum(["STARTER", "WRITER", "PRO"]),
});

export async function POST(req: NextRequest) {
  try {
    // Authenticate user
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user data from Clerk to get email
    const client = await clerkClient();
    const clerkUser = await client.users.getUser(userId);
    const userEmail = clerkUser.emailAddresses[0]?.emailAddress;

    if (!userEmail) {
      return NextResponse.json(
        { error: "User email not found" },
        { status: 400 },
      );
    }

    // Parse and validate request body
    const body: unknown = await req.json();
    const { planKey } = checkoutSchema.parse(body);

    // Get the pricing plan (server-side validation)
    const plan = PRICING_PLANS[planKey];
    if (!plan) {
      return NextResponse.json(
        { error: "Invalid pricing plan" },
        { status: 400 },
      );
    }

    // Get or create user record in our database
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      // Create user if doesn't exist
      await db.insert(users).values({
        id: userId,
        email: userEmail,
      });
    }

    // Find or create Stripe customer by email
    let stripeCustomer;
    const existingCustomers = await stripe.customers.list({
      email: userEmail,
      limit: 1,
    });

    if (existingCustomers.data.length > 0) {
      stripeCustomer = existingCustomers.data[0]!;

      // Update customer metadata if needed
      if (stripeCustomer.metadata.userId !== userId) {
        stripeCustomer = await stripe.customers.update(stripeCustomer.id, {
          metadata: { userId },
        });
      }
    } else {
      // Create new Stripe customer
      stripeCustomer = await stripe.customers.create({
        email: userEmail,
        metadata: { userId },
      });
    }

    // Create checkout session for one-time payment
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomer.id,
      mode: "payment", // One-time payment, not subscription
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `${plan.name} Plan - ${plan.credits} Credits`,
              description: `${plan.description} • ${Math.floor(plan.credits / CREDIT_COSTS.ARTICLE_GENERATION)} article generations • ${Math.floor(plan.credits / CREDIT_COSTS.REDDIT_TASKS)} Reddit tasks • ${Math.floor(plan.credits / CREDIT_COSTS.ARTICLE_IDEAS)} article ideas • Credits never expire`,
              images: [], // Optional: Add product images if needed
            },
            unit_amount: plan.priceInCents, // Server-side price validation
          },
          quantity: 1,
        },
      ],
      success_url: `${API_BASE_URL}/api/payments/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${API_BASE_URL}/dashboard?modal=pricing`,
      metadata: {
        userId,
        planKey,
        planName: plan.name,
        credits: plan.credits.toString(),
        pricePerCredit: plan.pricePerCredit.toString(),
      },
      payment_intent_data: {
        metadata: {
          userId,
          planKey,
          planName: plan.name,
          credits: plan.credits.toString(),
          pricePerCredit: plan.pricePerCredit.toString(),
        },
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    await logServerError(error, { operation: "stripe_checkout" });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
