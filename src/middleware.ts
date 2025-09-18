import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Define public routes that don't require authentication
const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
]);

// Define public API routes (external/webhook routes that should remain open)
const isPublicApiRoute = createRouteMatcher([
  "/api/webhooks/clerk",
  "/api/external(.*)",
  "/api/tools/seo-cluster-map/analyze",
  "/api/topics-finder",
]);

export default clerkMiddleware(async (auth, req) => {
  // Allow public routes to pass through without authentication
  if (isPublicRoute(req)) {
    return;
  }

  // Allow specific public API routes to pass through without authentication
  if (isPublicApiRoute(req)) {
    return;
  }

  // For API routes, require authentication (this will now protect all internal API routes)
  if (req.nextUrl.pathname.startsWith("/api/")) {
    await auth.protect();
    return;
  }

  // For non-API routes, require authentication
  await auth.protect();
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
