import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { db } from "@/server/db/index";
import { users } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { PRICING_PLANS, BASE_URL } from "@/constants";
import { env } from "@/env";
import Stripe from 'stripe';

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
      return NextResponse.json({ error: "User email not found" }, { status: 400 });
    }

    // Parse and validate request body
    const body: unknown = await req.json();
    const { planKey } = checkoutSchema.parse(body);

    // Get the pricing plan (server-side validation)
    const plan = PRICING_PLANS[planKey];
    if (!plan) {
      return NextResponse.json({ error: "Invalid pricing plan" }, { status: 400 });
    }

    // Get or create user record in our database
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId)
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
          metadata: { userId }
        });
      }
    } else {
      // Create new Stripe customer
      stripeCustomer = await stripe.customers.create({
        email: userEmail,
        metadata: { userId }
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
              name: `${plan.credits} Credits`,
              description: plan.description,
            },
            unit_amount: plan.priceInCents, // Server-side price validation
          },
          quantity: 1,
        },
      ],
      success_url: `${BASE_URL}/api/payments/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${BASE_URL}/dashboard?modal=pricing`,
      metadata: {
        userId,
        planKey,
        credits: plan.credits.toString(), // For audit purposes only - NOT used for credit calculation
      },
      payment_intent_data: {
        metadata: {
          userId,
          planKey,
          credits: plan.credits.toString(), // For audit purposes only - NOT used for credit calculation
        },
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Checkout session creation error:", error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request data", details: error.errors }, { status: 400 });
    }
    
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
