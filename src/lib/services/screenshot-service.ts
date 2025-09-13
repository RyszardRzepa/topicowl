import { put } from "@vercel/blob";
import crypto from "node:crypto";
import { env } from "@/env";
import { logger } from "@/lib/utils/logger";

interface ScreenshotRequest {
  url: string;
  title?: string;
  sectionHeading?: string;
  placement?: "start" | "middle" | "end";
}

interface ScreenshotParams {
  articleId: number;
  generationId: number;
  projectId: number;
  screenshotRequests: ScreenshotRequest[];
}

interface ScreenshotResult {
  screenshots: Record<string, { imageUrl: string; alt: string; status: number }>;
  usageStats: {
    requestsAttempted: number;
    requestsSuccessful: number;
    requestsFailed: number;
    estimatedUsageMinutes: number;
  };
}

// Rate limiting for Cloudflare Browser Rendering API
const CLOUDFLARE_LIMITS = {
  MAX_REQUESTS_PER_MINUTE: 6,
  MAX_CONCURRENT_BROWSERS: 3,
  MAX_DAILY_USAGE_MINUTES: 10,
  BROWSER_TIMEOUT_SECONDS: 60,
  ESTIMATED_SECONDS_PER_REQUEST: 15, // Conservative estimate
} as const;

// Simple in-memory rate limiting (in production, use Redis or database)
let requestsThisMinute = 0;
let minuteWindowStart = Date.now();

// Simple per-process global throttle to keep <= 6 RPM
let nextAllowedAtMs = 0;
async function waitForGlobalRateLimitSlot(): Promise<void> {
  const perRequestInterval = Math.ceil(
    60000 / CLOUDFLARE_LIMITS.MAX_REQUESTS_PER_MINUTE,
  ); // ~10s for 6 RPM
  const now = Date.now();
  const delayMs = Math.max(0, nextAllowedAtMs - now);
  if (delayMs > 0) {
    await new Promise((r) => setTimeout(r, delayMs));
  }
  nextAllowedAtMs = Date.now() + perRequestInterval;
}

/**
 * Simplified screenshot service that takes specific URLs and captures them
 * Decision-making about which URLs to capture is handled upstream
 */
export async function captureSpecificScreenshots(
  params: ScreenshotParams,
): Promise<ScreenshotResult> {
  const { screenshotRequests, articleId, projectId, generationId } = params;

  logger.debug("[SCREENSHOT_SERVICE] Starting targeted screenshot capture", {
    requestsCount: screenshotRequests.length,
    articleId,
    projectId,
    generationId
  });

  // Validate environment
  if (!env.CF_API_TOKEN || !env.CF_ACCOUNT_ID) {
    logger.warn("[SCREENSHOT_SERVICE] Cloudflare credentials missing", {
      hasToken: !!env.CF_API_TOKEN,
      hasAccountId: !!env.CF_ACCOUNT_ID,
      articleId,
      projectId
    });
    return { 
      screenshots: {}, 
      usageStats: { requestsAttempted: 0, requestsSuccessful: 0, requestsFailed: 0, estimatedUsageMinutes: 0 }
    };
  }

  if (screenshotRequests.length === 0) {
    logger.warn("[SCREENSHOT_SERVICE] No screenshot requests provided", {
      articleId,
      projectId
    });
    return { 
      screenshots: {}, 
      usageStats: { requestsAttempted: 0, requestsSuccessful: 0, requestsFailed: 0, estimatedUsageMinutes: 0 }
    };
  }

  // Check rate limits before proceeding
  const rateLimitCheck = checkRateLimits(screenshotRequests.length);
  if (!rateLimitCheck.allowed) {
    logger.warn("[SCREENSHOT_SERVICE] Rate limit exceeded", {
      reason: rateLimitCheck.reason,
      requestsRemaining: rateLimitCheck.requestsRemaining,
      articleId
    });
    return { 
      screenshots: {}, 
      usageStats: { requestsAttempted: screenshotRequests.length, requestsSuccessful: 0, requestsFailed: screenshotRequests.length, estimatedUsageMinutes: 0 }
    };
  }

  const screenshots: Record<string, { imageUrl: string; alt: string; status: number }> = {};
  let successfulRequests = 0;
  let failedRequests = 0;

  // Process each screenshot request
  for (const request of screenshotRequests.slice(0, 3)) { // Limit to 3 max
    try {
      logger.debug("[SCREENSHOT_SERVICE] Capturing screenshot", {
        url: request.url,
        articleId
      });

      const result = await captureScreenshot(request, articleId, projectId);
      screenshots[request.url] = result;
      
      if (result.status === 200) {
        successfulRequests++;
        logger.debug("[SCREENSHOT_SERVICE] Screenshot captured successfully", {
          url: request.url,
          imageUrl: result.imageUrl,
          articleId
        });
      } else {
        failedRequests++;
      }

      // Update rate limiting counter
      updateRateLimit();

      // Small delay between requests to avoid hitting rate limits
      if (screenshotRequests.length > 1) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
      }

    } catch (error) {
      failedRequests++;
      logger.error("[SCREENSHOT_SERVICE] Screenshot capture failed", {
        url: request.url,
        error: error instanceof Error ? error.message : "Unknown error",
        articleId
      });
      
      screenshots[request.url] = {
        imageUrl: "",
        alt: request.title ?? "screenshot",
        status: 500
      };
    }
  }

  const estimatedUsageMinutes = (screenshotRequests.length * CLOUDFLARE_LIMITS.ESTIMATED_SECONDS_PER_REQUEST) / 60;

  logger.debug("[SCREENSHOT_SERVICE] Screenshot capture completed", {
    requestsAttempted: screenshotRequests.length,
    requestsSuccessful: successfulRequests,
    requestsFailed: failedRequests,
    estimatedUsageMinutes,
    articleId
  });

  return {
    screenshots,
    usageStats: {
      requestsAttempted: screenshotRequests.length,
      requestsSuccessful: successfulRequests,
      requestsFailed: failedRequests,
      estimatedUsageMinutes
    }
  };
}

/**
 * Captures a single screenshot and uploads to Vercel Blob
 */
async function captureScreenshot(
  request: ScreenshotRequest,
  articleId: number,
  projectId: number
): Promise<{ imageUrl: string; alt: string; status: number }> {
  // Respect global throttle (<= 6 requests/min per process)
  await waitForGlobalRateLimitSlot();

  // Single retry on 429 with backoff
  let response: Response | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/browser-rendering/screenshot`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.CF_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: request.url,
          screenshotOptions: {
            fullPage: false,
            omitBackground: true,
          },
          viewport: {
            width: 1280,
            height: 720,
          },
          gotoOptions: {
            waitUntil: "networkidle0",
            timeout: 45000,
          },
        }),
      },
    );

    if (response.status === 429 && attempt < 1) {
      const retryAfterHeader = response.headers.get("retry-after");
      const retryMs = Number.isNaN(parseInt(retryAfterHeader ?? "", 10))
        ? 10000
        : parseInt(retryAfterHeader ?? "0", 10) * 1000;
      await new Promise((r) => setTimeout(r, Math.max(retryMs, 10000)));
      // Also update throttle window after a 429 to space subsequent calls
      await waitForGlobalRateLimitSlot();
      continue;
    }
    break;
  }

  if (!response?.ok) {
    const status = response?.status ?? 0;
    const statusText = response?.statusText ?? "Unknown";
    throw new Error(`Screenshot API failed: ${status} ${statusText}`);
  }

  // Upload to Vercel Blob
  const buffer = Buffer.from(await response.arrayBuffer());
  const hash = crypto
    .createHash("sha256")
    .update(request.url)
    .digest("hex")
    .slice(0, 16);
  const key = `article_screenshots/${projectId}/${articleId}/${hash}.png`;
  
  const blob = await put(key, buffer, {
    access: "public",
    contentType: "image/png",
  });

  return {
    imageUrl: blob.url,
    alt: request.title ?? "screenshot",
    status: response.status
  };
}

/**
 * Checks if we can make the requested number of screenshot calls
 */
function checkRateLimits(requestCount: number): { 
  allowed: boolean; 
  reason?: string; 
  requestsRemaining: number;
} {
  const now = Date.now();
  
  // Reset minute window if needed
  if (now - minuteWindowStart > 60000) {
    requestsThisMinute = 0;
    minuteWindowStart = now;
  }

  // Check requests per minute limit
  if (requestsThisMinute + requestCount > CLOUDFLARE_LIMITS.MAX_REQUESTS_PER_MINUTE) {
    return {
      allowed: false,
      reason: "Requests per minute limit exceeded",
      requestsRemaining: CLOUDFLARE_LIMITS.MAX_REQUESTS_PER_MINUTE - requestsThisMinute
    };
  }

  // Check daily usage estimate (rough approximation)
  const estimatedUsageMinutes = (requestCount * CLOUDFLARE_LIMITS.ESTIMATED_SECONDS_PER_REQUEST) / 60;
  if (estimatedUsageMinutes > CLOUDFLARE_LIMITS.MAX_DAILY_USAGE_MINUTES) {
    return {
      allowed: false,
      reason: "Daily usage limit would be exceeded",
      requestsRemaining: 0
    };
  }

  return {
    allowed: true,
    requestsRemaining: CLOUDFLARE_LIMITS.MAX_REQUESTS_PER_MINUTE - requestsThisMinute
  };
}

/**
 * Updates rate limiting counters
 */
function updateRateLimit(): void {
  requestsThisMinute++;
}

// Legacy injection function removed — images are embedded by the writer model only
