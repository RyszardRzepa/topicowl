import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Define public routes that don't require authentication
const isPublicRoute = createRouteMatcher([
  "/",
  "/demo",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks/clerk",
]);

// Define onboarding route
const isOnboardingRoute = createRouteMatcher(["/onboarding"]);

export default clerkMiddleware(async (auth, req) => {
  // Allow public routes to pass through without authentication
  if (isPublicRoute(req)) {
    return;
  }

  // For API routes that use auth(), we need to let clerkMiddleware handle them
  // but not redirect if user is not authenticated - let the API route handle it
  if (req.nextUrl.pathname.startsWith("/api/")) {
    return;
  }

  // For all other routes, require authentication
  const { userId } = await auth();
  
  if (!userId) {
    // Redirect to sign-in if not authenticated
    const signInUrl = new URL("/sign-in", req.url);
    return Response.redirect(signInUrl);
  }

  // Allow onboarding routes to pass through
  // Onboarding check will be handled in the app pages themselves
  if (isOnboardingRoute(req)) {
    return;
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
