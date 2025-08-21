import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { PRICING_PLANS } from "@/constants";

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

    // For now, return success without Stripe integration
    // TODO: Integrate with Stripe when ready
    return NextResponse.json({
      message: "Payment integration not yet implemented",
      plan: plan,
      userId: userId,
    });
  } catch (error) {
    console.error("Checkout session creation error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
