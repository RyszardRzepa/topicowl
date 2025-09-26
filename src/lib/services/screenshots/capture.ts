import { put } from "@vercel/blob";
import crypto from "node:crypto";
import { env } from "@/env";
import { logger } from "@/lib/utils/logger";

export interface ScreenshotRequest {
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

interface ScreenshotUsageStats {
  requestsAttempted: number;
  requestsSuccessful: number;
  requestsFailed: number;
  estimatedUsageMinutes: number;
}

interface ScreenshotRecord {
  imageUrl: string;
  alt: string;
  status: number;
}

interface ScreenshotResult {
  screenshots: Record<string, ScreenshotRecord>;
  usageStats: ScreenshotUsageStats;
}

interface PageValidationResult {
  url: string;
  isValid: boolean;
  reason?: string;
  htmlLength?: number;
}

const CLOUDFLARE_LIMITS = {
  MAX_REQUESTS_PER_MINUTE: 6,
  MAX_CONCURRENT_BROWSERS: 3,
  MAX_DAILY_USAGE_MINUTES: 10,
  BROWSER_TIMEOUT_SECONDS: 60,
  ESTIMATED_SECONDS_PER_REQUEST: 15,
} as const;

let requestsThisMinute = 0;
let minuteWindowStart = Date.now();
let nextAllowedAtMs = 0;

async function waitForGlobalRateLimitSlot(): Promise<void> {
  const perRequestInterval = Math.ceil(
    60000 / CLOUDFLARE_LIMITS.MAX_REQUESTS_PER_MINUTE,
  );
  const now = Date.now();
  const delayMs = Math.max(0, nextAllowedAtMs - now);
  if (delayMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  nextAllowedAtMs = Date.now() + perRequestInterval;
}

function checkRateLimits(requestCount: number): {
  allowed: boolean;
  reason?: string;
  requestsRemaining: number;
} {
  const now = Date.now();
  if (now - minuteWindowStart > 60000) {
    requestsThisMinute = 0;
    minuteWindowStart = now;
  }

  if (requestsThisMinute + requestCount > CLOUDFLARE_LIMITS.MAX_REQUESTS_PER_MINUTE) {
    return {
      allowed: false,
      reason: "Requests per minute limit exceeded",
      requestsRemaining:
        CLOUDFLARE_LIMITS.MAX_REQUESTS_PER_MINUTE - requestsThisMinute,
    };
  }

  const estimatedUsageMinutes =
    (requestCount * CLOUDFLARE_LIMITS.ESTIMATED_SECONDS_PER_REQUEST) / 60;
  if (estimatedUsageMinutes > CLOUDFLARE_LIMITS.MAX_DAILY_USAGE_MINUTES) {
    return {
      allowed: false,
      reason: "Daily usage limit would be exceeded",
      requestsRemaining: 0,
    };
  }

  return {
    allowed: true,
    requestsRemaining:
      CLOUDFLARE_LIMITS.MAX_REQUESTS_PER_MINUTE - requestsThisMinute,
  };
}

function updateRateLimit(): void {
  requestsThisMinute += 1;
}

export async function captureSpecificScreenshots(
  params: ScreenshotParams,
): Promise<ScreenshotResult> {
  const { screenshotRequests, articleId, projectId, generationId } = params;

  logger.debug("screenshot:capture_start", {
    requests: screenshotRequests.length,
    articleId,
    projectId,
    generationId,
  });

  if (!(env.CF_API_TOKEN && env.CF_ACCOUNT_ID)) {
    logger.warn("screenshot:missing_credentials", {
      hasToken: !!env.CF_API_TOKEN,
      hasAccountId: !!env.CF_ACCOUNT_ID,
    });
    return {
      screenshots: {},
      usageStats: {
        requestsAttempted: 0,
        requestsSuccessful: 0,
        requestsFailed: 0,
        estimatedUsageMinutes: 0,
      },
    };
  }

  if (screenshotRequests.length === 0) {
    return {
      screenshots: {},
      usageStats: {
        requestsAttempted: 0,
        requestsSuccessful: 0,
        requestsFailed: 0,
        estimatedUsageMinutes: 0,
      },
    };
  }

  const rateLimitCheck = checkRateLimits(screenshotRequests.length);
  if (!rateLimitCheck.allowed) {
    logger.warn("screenshot:rate_limited", {
      reason: rateLimitCheck.reason,
      remaining: rateLimitCheck.requestsRemaining,
    });
    return {
      screenshots: {},
      usageStats: {
        requestsAttempted: screenshotRequests.length,
        requestsSuccessful: 0,
        requestsFailed: screenshotRequests.length,
        estimatedUsageMinutes: 0,
      },
    };
  }

  const screenshots: Record<string, ScreenshotRecord> = {};
  let successfulRequests = 0;
  let failedRequests = 0;

  for (const request of screenshotRequests.slice(0, 3)) {
    try {
      const result = await captureScreenshot(request, articleId, projectId);
      screenshots[request.url] = result;
      if (result.status === 200 && result.imageUrl.length > 0) {
        successfulRequests += 1;
      } else {
        failedRequests += 1;
      }
      updateRateLimit();
      if (screenshotRequests.length > 1) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    } catch (error) {
      failedRequests += 1;
      logger.error("screenshot:capture_error", {
        url: request.url,
        error: error instanceof Error ? error.message : "unknown",
      });
      screenshots[request.url] = {
        imageUrl: "",
        alt: request.title ?? "screenshot",
        status: 500,
      };
    }
  }

  const estimatedUsageMinutes =
    (screenshotRequests.length * CLOUDFLARE_LIMITS.ESTIMATED_SECONDS_PER_REQUEST) /
    60;

  return {
    screenshots,
    usageStats: {
      requestsAttempted: screenshotRequests.length,
      requestsSuccessful: successfulRequests,
      requestsFailed: failedRequests,
      estimatedUsageMinutes,
    },
  };
}

async function captureScreenshot(
  request: ScreenshotRequest,
  articleId: number,
  projectId: number,
): Promise<ScreenshotRecord> {
  await waitForGlobalRateLimitSlot();

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
          screenshotOptions: { fullPage: false, omitBackground: true },
          viewport: { width: 1280, height: 720 },
          gotoOptions: { waitUntil: "networkidle0", timeout: 45000 },
        }),
      },
    );

    if (response.status === 429 && attempt < 1) {
      const retryAfterHeader = response.headers.get("retry-after");
      const retrySeconds = retryAfterHeader
        ? Number.parseInt(retryAfterHeader, 10)
        : Number.NaN;
      const retryMs = Number.isNaN(retrySeconds)
        ? 10000
        : Math.max(retrySeconds * 1000, 10000);
      await new Promise((resolve) => setTimeout(resolve, retryMs));
      await waitForGlobalRateLimitSlot();
      continue;
    }
    break;
  }

  if (!response?.ok) {
    const status = response ? response.status : 0;
    const statusText = response ? response.statusText : "Unknown";
    throw new Error(`Screenshot API failed: ${status} ${statusText}`);
  }

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
    allowOverwrite: true
  });

  return {
    imageUrl: blob.url,
    alt: request.title ?? "screenshot",
    status: response.status,
  };
}

export async function validatePagesBeforeScreenshots(
  urls: string[],
): Promise<string[]> {
  if (!(env.CF_API_TOKEN && env.CF_ACCOUNT_ID)) {
    logger.warn("screenshot:validation_missing_credentials", {
      hasToken: !!env.CF_API_TOKEN,
      hasAccountId: !!env.CF_ACCOUNT_ID,
    });
    return urls; // Return all URLs if no validation possible
  }

  const validUrls: string[] = [];

  for (const url of urls) {
    try {
      const validationResult = await validateSinglePage(url);
      if (validationResult.isValid) {
        validUrls.push(url);
        logger.debug("screenshot:page_validation_passed", {
          url,
          htmlLength: validationResult.htmlLength,
        });
      } else {
        logger.warn("screenshot:page_validation_failed", {
          url,
          reason: validationResult.reason,
        });
      }
    } catch (error) {
      logger.error("screenshot:page_validation_error", {
        url,
        error: error instanceof Error ? error.message : "unknown",
      });
      // If validation fails with an error, we still include the URL to avoid breaking the flow
      validUrls.push(url);
    }
  }

  logger.info("screenshot:validation_complete", {
    totalUrls: urls.length,
    validUrls: validUrls.length,
    filteredUrls: urls.length - validUrls.length,
  });

  return validUrls;
}

async function validateSinglePage(url: string): Promise<PageValidationResult> {
  try {
    // Use Cloudflare Browser Rendering /content endpoint to check if page loads correctly
    // Based on official docs: curl https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/browser-rendering/content
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/browser-rendering/content`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.CF_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url,
          timeout: 15000, // Use shorter timeout for validation
        }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      return {
        url,
        isValid: false,
        reason: `HTTP ${response.status}: ${response.statusText} - ${errorText}`,
      };
    }

    const data = (await response.json()) as {
      success?: boolean; // Keep for backward compatibility
      status?: boolean;  // Official Cloudflare format
      result?: string | { html?: string; content?: string };
      html?: string;     // Keep for backward compatibility
      errors?: Array<{ code: number; message: string }>;
      meta?: { status: number; title?: string };
    };

    // Check for API errors using official Cloudflare format
    if (data.status === false || (data.errors && data.errors.length > 0)) {
      const errorMessage = data.errors?.[0]?.message ?? "Unknown API error";
      return {
        url,
        isValid: false,
        reason: `API error: ${errorMessage}`,
      };
    }

    // Handle different response formats from Cloudflare API
    // Official format: { "status": true, "result": "html_content" }
    // Legacy format: { "success": true, "result": { "html": "..." } }
    // Direct format: { "html": "..." }
    let html = "";
    
    if (typeof data.result === "string") {
      // Official format: result is the HTML string directly
      html = data.result;
    } else if (typeof data.result === "object" && data.result) {
      // Legacy format: result is an object with html property
      html = data.result.html ?? data.result.content ?? "";
    } else {
      // Fallback: check for direct html property
      html = data.html ?? "";
    }

    if (!html || html.length < 100) {
      logger.debug("screenshot:page_validation_minimal_content", {
        url,
        htmlLength: html.length,
        responseStructure: {
          hasStatus: "status" in data,
          hasSuccess: "success" in data,
          hasResult: "result" in data,
          resultType: typeof data.result,
          hasHtml: "html" in data,
          hasErrors: "errors" in data,
        },
      });
      return {
        url,
        isValid: false,
        reason: "Empty or minimal HTML content",
        htmlLength: html.length,
      };
    }

    // Check for common blocking patterns
    const htmlLower = html.toLowerCase();
    
    // Check for Cloudflare challenge pages
    if (
      htmlLower.includes("cloudflare") &&
      (htmlLower.includes("checking your browser") ||
        htmlLower.includes("ddos protection") ||
        htmlLower.includes("ray id"))
    ) {
      return {
        url,
        isValid: false,
        reason: "Cloudflare challenge page detected",
        htmlLength: html.length,
      };
    }

    // Check for CAPTCHA patterns
    if (
      htmlLower.includes("captcha") ||
      htmlLower.includes("recaptcha") ||
      htmlLower.includes("hcaptcha") ||
      htmlLower.includes("verify you are human")
    ) {
      return {
        url,
        isValid: false,
        reason: "CAPTCHA detected",
        htmlLength: html.length,
      };
    }

    // Check for common error pages
    if (
      (htmlLower.includes("404") && htmlLower.includes("not found")) ||
      (htmlLower.includes("403") && htmlLower.includes("forbidden")) ||
      (htmlLower.includes("500") && htmlLower.includes("internal server error")) ||
      htmlLower.includes("access denied") ||
      htmlLower.includes("blocked") ||
      htmlLower.includes("rate limit") ||
      htmlLower.includes("temporarily unavailable")
    ) {
      return {
        url,
        isValid: false,
        reason: "Error page detected",
        htmlLength: html.length,
      };
    }

    // Check if page has minimal content structure
    if (
      !htmlLower.includes("<body") ||
      (!htmlLower.includes("<p") && 
       !htmlLower.includes("<div") && 
       !htmlLower.includes("<main") && 
       !htmlLower.includes("<article") &&
       !htmlLower.includes("<section") &&
       !htmlLower.includes("<h1") &&
       !htmlLower.includes("<h2") &&
       !htmlLower.includes("<h3"))
    ) {
      return {
        url,
        isValid: false,
        reason: "Page lacks content structure",
        htmlLength: html.length,
      };
    }

    return {
      url,
      isValid: true,
      htmlLength: html.length,
    };
  } catch (error) {
    // Network or parsing error
    return {
      url,
      isValid: false,
      reason: `Network error: ${error instanceof Error ? error.message : "Unknown"}`,
    };
  }
}