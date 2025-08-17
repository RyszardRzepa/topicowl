import { google } from "@ai-sdk/google";
import { generateText } from "ai";
import { type NextRequest } from "next/server";
import { MODELS } from "../../../../../constants";
import { auth } from "@clerk/nextjs/server";

// Simple in-memory rate limiter
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(
  ip: string,
  maxRequests = 3,
  windowMs: number = 60 * 60 * 1000,
): boolean {
  const now = Date.now();
  const userLimit = rateLimitMap.get(ip);

  if (!userLimit || now > userLimit.resetTime) {
    // Reset or create new limit
    rateLimitMap.set(ip, { count: 1, resetTime: now + windowMs });
    return false; // Not rate limited
  }

  if (userLimit.count >= maxRequests) {
    return true; // Rate limited
  }

  // Increment count
  userLimit.count++;
  return false; // Not rate limited
}

// Types for the API response
interface SEOStrategyResponse {
  strategy: string;
  sources?: Array<{
    id: string;
    url: string;
    title?: string;
  }>;
  metadata?: {
    groundingMetadata?: unknown;
    urlContextMetadata?: unknown;
  };
}

interface ErrorResponse {
  error: string;
  details?: string;
}

// URL validation function with enhanced security
function validateUrl(url: string): { isValid: boolean; error?: string } {
  try {
    // Check URL length to prevent abuse
    if (url.length > 2048) {
      return { isValid: false, error: "URL is too long" };
    }

    const urlObj = new URL(url);

    // Check if protocol is http or https
    if (!["http:", "https:"].includes(urlObj.protocol)) {
      return { isValid: false, error: "URL must use HTTP or HTTPS protocol" };
    }

    // Check if hostname exists
    if (!urlObj.hostname) {
      return { isValid: false, error: "URL must have a valid hostname" };
    }

    // Enhanced hostname validation (block localhost, private IPs, and suspicious domains)
    const hostname = urlObj.hostname.toLowerCase();

    // Block localhost variations
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return { isValid: false, error: "Local addresses are not allowed" };
    }

    // Block private IP ranges (RFC 1918)
    if (
      hostname.startsWith("127.") ||
      hostname.startsWith("192.168.") ||
      hostname.startsWith("10.") ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname) ||
      /^\d+\.\d+\.\d+\.\d+$/.test(hostname)
    ) {
      return { isValid: false, error: "Private IP addresses are not allowed" };
    }

    // Block suspicious TLDs and domains
    const suspiciousTlds = [".local", ".internal", ".corp", ".home"];
    if (suspiciousTlds.some((tld) => hostname.endsWith(tld))) {
      return { isValid: false, error: "Internal domains are not allowed" };
    }

    // Ensure hostname has at least one dot (basic domain validation)
    if (!hostname.includes(".")) {
      return { isValid: false, error: "Invalid domain format" };
    }

    return { isValid: true };
  } catch {
    return { isValid: false, error: "Invalid URL format" };
  }
}

// Retry logic wrapper
async function withRetry<T>(
  operation: () => Promise<T>,
  maxAttempts = 3,
  delay = 1000,
): Promise<T> {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      if (attempt === maxAttempts) {
        throw lastError;
      }

      // Wait before retrying (exponential backoff)
      await new Promise((resolve) => setTimeout(resolve, delay * attempt));
    }
  }

  throw lastError!;
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    // Get authenticated user (optional for this public tool)
    const { userId } = await auth();

    // Get client IP for rate limiting with better extraction
    const forwardedFor = request.headers.get("x-forwarded-for");
    const realIp = request.headers.get("x-real-ip");
    const cfConnectingIp = request.headers.get("cf-connecting-ip");

    // Use the most reliable IP source available
    const clientIp =
      cfConnectingIp ??
      realIp ??
      forwardedFor?.split(",")[0]?.trim() ??
      "unknown";

    // Use user ID for rate limiting if authenticated, otherwise fall back to IP
    const rateLimitKey = userId ?? `ip:${clientIp}`;

    // Authenticated users get higher limits
    const maxRequests = userId ? 10 : 3;
    const windowMs = userId ? 60 * 60 * 1000 : 60 * 60 * 1000; // 1 hour for both

    // Check rate limit
    if (checkRateLimit(rateLimitKey, maxRequests, windowMs)) {
      const errorMessage = userId
        ? "Rate limit exceeded. You can analyze 10 websites per hour."
        : "Rate limit exceeded. You can analyze 3 websites per hour. Sign up for unlimited access!";

      return Response.json(
        {
          error: errorMessage,
          details: "Rate limit exceeded",
          rateLimited: true,
        } as ErrorResponse,
        { status: 429 },
      );
    }

    // Parse request body
    const body = (await request.json()) as { url?: unknown };
    const { url } = body;

    // Validate required fields with enhanced checks
    if (!url || typeof url !== "string" || url.trim().length === 0) {
      return Response.json(
        {
          error: "URL is required and must be a valid string",
        } as ErrorResponse,
        { status: 400 },
      );
    }

    // Sanitize and validate URL
    const sanitizedUrl = url.trim();

    // Additional input validation
    if (sanitizedUrl.length < 8) {
      // Minimum viable URL length
      return Response.json(
        { error: "URL is too short to be valid" } as ErrorResponse,
        { status: 400 },
      );
    }

    // Validate URL format and security
    const urlValidation = validateUrl(sanitizedUrl);
    if (!urlValidation.isValid) {
      return Response.json({ error: urlValidation.error } as ErrorResponse, {
        status: 400,
      });
    }

    // Generate SEO strategy with retry logic
    const result = await withRetry(
      async () => {
        return await generateText({
          model: google(MODELS.GEMINI_2_5_FLASH),
          tools: {
            url_context: google.tools.urlContext({}),
          },
          system: `You are an SEO strategy expert specializing in topic cluster methodology. Analyze the provided website content and generate a comprehensive topic pillar SEO strategy following these specific principles:

TOPIC CLUSTER METHODOLOGY:
1. PILLAR TOPIC (The Hub): Identify ONE main pillar keyword that is:
   - High search volume (broad intent keyword)
   - Covers multiple subtopics naturally
   - Business-relevant to the website's core offering
   - Example: "things to do in Oslo" for a travel site

2. CLUSTER ARTICLES (Supporting Posts): Create 8-12 cluster topics that:
   - Go deep on specific slices of the pillar topic
   - Each targets a more specific long-tail keyword
   - Categories like: Food & Drink, Culture & Attractions, Nature & Outdoors, Local Life & Hidden Gems, Practical Guides
   - Example clusters for Oslo: "Best coffee shops in Oslo", "Must-see museums in Oslo", "Best hikes near Oslo"

3. LINKING STRUCTURE:
   - Pillar links OUT to each cluster article
   - Each cluster links BACK to pillar with anchor text like "For the complete guide, see our [pillar topic]"
   - Clusters link sideways to related clusters
   - Creates a content hub that dominates the topic space

4. WHY THIS WORKS:
   - Google SEO: Shows breadth + depth, dominates keyword space
   - AI SEO: Becomes authority hub for AI overviews and citations
   - User flow: Visitors explore between pillar and clusters, increasing time on site

FORMAT: Structure as a detailed strategy report with pillar recommendation, categorized clusters, and linking strategy.`,
          prompt: `Analyze this website: ${sanitizedUrl}
    
Based on the website content, create a topic cluster SEO strategy following this structure:

🎯 PILLAR TOPIC (The Hub):
- Identify the ONE main keyword that meets: high search volume + broad intent + business relevance
- Suggest pillar article title (e.g., "The Complete Guide to [Topic] (2025 Edition)")
- Explain why this keyword dominates the topic space

🗂 CLUSTER ARTICLES (Supporting Posts):
Organize 8-12 cluster topics by categories such as:
- [Category 1]: 2-3 specific cluster topics
- [Category 2]: 2-3 specific cluster topics  
- [Category 3]: 2-3 specific cluster topics
- [Category 4]: 2-3 specific cluster topics

Each cluster should:
- Target a specific long-tail keyword
- Go deep on one slice of the pillar
- Be linkable back to the main pillar

🔗 LINKING STRUCTURE:
- How pillar links out to clusters
- How clusters link back to pillar (with anchor text examples)
- Cross-cluster linking opportunities

📈 STRATEGIC VALUE:
- Why this approach dominates Google SEO
- How it positions for AI search citations
- Expected user flow and engagement benefits`,
        });
      },
      3,
      1000,
    );

    // Format response
    const response: SEOStrategyResponse = {
      strategy: result.text,
      sources: result.sources?.map((source) => ({
        id: source.id,
        url: sanitizedUrl, // Use the original URL since sources don't have URL property
        title: source.title,
      })),
      metadata: {
        groundingMetadata: result.providerMetadata?.google?.groundingMetadata,
        urlContextMetadata: result.providerMetadata?.google?.urlContextMetadata,
      },
    };

    return Response.json(response, { status: 200 });
  } catch (error) {
    // Log error securely (avoid logging sensitive data)
    console.error("SEO strategy generation error:", {
      message: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString(),
    });

    // Handle specific error types with sanitized responses
    if (error instanceof Error) {
      // Check for rate limiting or quota errors
      if (
        error.message.includes("quota") ||
        error.message.includes("rate limit") ||
        error.message.includes("429")
      ) {
        return Response.json(
          {
            error:
              "Service temporarily unavailable due to high demand. Please try again in a few minutes.",
            details: "Service unavailable",
          } as ErrorResponse,
          { status: 429 },
        );
      }

      // Check for invalid URL errors from the AI service
      if (
        error.message.includes("invalid URL") ||
        error.message.includes("unreachable") ||
        error.message.includes("403") ||
        error.message.includes("404")
      ) {
        return Response.json(
          {
            error:
              "Unable to access the provided website. Please check the URL and try again.",
            details: "Website inaccessible",
          } as ErrorResponse,
          { status: 400 },
        );
      }

      // Check for timeout errors
      if (
        error.message.includes("timeout") ||
        error.message.includes("TIMEOUT")
      ) {
        return Response.json(
          {
            error:
              "Analysis timed out. Please try again with a different website.",
            details: "Request timeout",
          } as ErrorResponse,
          { status: 408 },
        );
      }
    }

    // Generic server error (don't leak internal details)
    return Response.json(
      {
        error:
          "An unexpected error occurred while generating the SEO strategy. Please try again.",
        details: "Service error",
      } as ErrorResponse,
      { status: 500 },
    );
  }
}
