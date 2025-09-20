import { put } from "@vercel/blob";
import crypto from "node:crypto";
import { env } from "@/env";
import { logger } from "@/lib/utils/logger";
import { getProjectExcludedDomains } from "@/lib/utils/article-generation";
import { normalizeDomain } from "@/lib/utils/domain";

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

interface ScreenshotEnhancementArtifacts {
  requests: ScreenshotRequest[];
  successes: Array<{
    url: string;
    imageUrl: string;
    alt: string;
    sectionHeading?: string;
    placement?: "start" | "middle" | "end";
  }>;
  failures: Array<{ url: string; reason: string }>;
}

interface ScreenshotEnhancementResult {
  content: string;
  artifacts: ScreenshotEnhancementArtifacts;
  usageStats: ScreenshotUsageStats;
}

interface ExtractedLink {
  url: string;
  linkText: string;
  heading?: string;
  lineIndex: number;
}

interface ScreenshotCandidate {
  url: string;
  normalizedUrl: string;
  linkText: string;
  heading?: string;
  lineIndex: number;
  sourceTitle?: string;
  validation: ScreenshotUrlValidationResult;
}

interface ScreenshotUrlValidationResult {
  isValid: boolean;
  reason?: string;
  domain?: string;
  category?:
    | "social-media"
    | "video-platform"
    | "brand-domain"
    | "file-sharing"
    | "invalid-url"
    | "excluded-domain";
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

const MAX_SCREENSHOTS = 3;
const MIN_LINE_SPREAD = 12; // Require at least ~1 paragraph spacing between screenshots

const SOCIAL_MEDIA_DOMAINS: readonly string[] = [
  "facebook.com",
  "fb.com",
  "instagram.com",
  "threads.net",
  "whatsapp.com",
  "twitter.com",
  "x.com",
  "t.co",
  "linkedin.com",
  "lnkd.in",
  "youtube.com",
  "youtu.be",
  "vimeo.com",
  "tiktok.com",
  "snapchat.com",
  "twitch.tv",
  "dailymotion.com",
  "reddit.com",
  "pinterest.com",
  "tumblr.com",
  "discord.com",
  "telegram.org",
  "signal.org",
  "clubhouse.com",
  "mastodon.social",
  "mastodon.world",
  "slack.com",
  "zoom.us",
  "teams.microsoft.com",
  "meet.google.com",
  "discord.gg",
  "quora.com",
  "stackoverflow.com",
];

const VIDEO_PLATFORMS: readonly string[] = [
  "youtube.com",
  "youtu.be",
  "vimeo.com",
  "tiktok.com",
  "twitch.tv",
  "dailymotion.com",
  "wistia.com",
  "brightcove.com",
  "jwplayer.com",
  "kaltura.com",
];

const PROBLEMATIC_BRAND_DOMAINS: readonly string[] = [
  "google.com",
  "apple.com",
  "microsoft.com",
  "amazon.com",
  "netflix.com",
  "shopify.com",
  "etsy.com",
  "ebay.com",
  "alibaba.com",
  "salesforce.com",
  "hubspot.com",
  "zendesk.com",
  "intercom.com",
  "atlassian.com",
  "github.com",
  "gitlab.com",
  "bitbucket.org",
  "paypal.com",
  "stripe.com",
  "square.com",
  "venmo.com",
  "news.google.com",
  "flipboard.com",
];

const FILE_SHARING_DOMAINS: readonly string[] = [
  "dropbox.com",
  "drive.google.com",
  "onedrive.live.com",
  "box.com",
  "icloud.com",
  "mega.nz",
  "mediafire.com",
  "rapidshare.com",
  "sendspace.com",
  "wetransfer.com",
];

async function enhanceArticleWithScreenshots(params: {
  content: string;
  sources: Array<{ url: string; title?: string }>;
  articleId: number;
  projectId: number;
  generationId: number;
  articleTitle: string;
}): Promise<ScreenshotEnhancementResult | null> {
  const trimmedContent = params.content.trim();
  if (trimmedContent.length === 0) return null;

  if (!Array.isArray(params.sources) || params.sources.length === 0) {
    return null;
  }

  const extractedLinks = extractLinksWithContext(params.content);
  if (extractedLinks.length === 0) {
    return null;
  }

  const excludedDomains = await getProjectExcludedDomains(params.projectId);

  const sourceMap = new Map<string, { url: string; title?: string }>();
  for (const source of params.sources) {
    sourceMap.set(normalizeUrlForComparison(source.url), source);
  }

  const seen = new Set<string>();
  const candidates: ScreenshotCandidate[] = [];

  for (const link of extractedLinks) {
    const normalizedUrl = normalizeUrlForComparison(link.url);
    if (seen.has(normalizedUrl)) {
      continue;
    }
    seen.add(normalizedUrl);

    const source = sourceMap.get(normalizedUrl);
    if (!source) {
      continue;
    }

    const validation = validateUrlForScreenshot(link.url, excludedDomains);
    if (!validation.isValid) {
      logger.debug("screenshot:link_skipped", {
        url: link.url,
        reason: validation.reason,
        category: validation.category,
      });
      continue;
    }

    candidates.push({
      url: link.url,
      normalizedUrl,
      linkText: link.linkText,
      heading: link.heading,
      lineIndex: link.lineIndex,
      sourceTitle: source.title,
      validation,
    });
  }

  if (candidates.length === 0) {
    return null;
  }

  const scoredCandidates = candidates
    .map((candidate) => ({
      candidate,
      score: computeScreenshotScore(candidate),
    }))
    .sort((a, b) => {
      if (a.score === b.score) return 0;
      return a.score > b.score ? -1 : 1;
    });

  const selectedCandidates: ScreenshotCandidate[] = [];

  for (const item of scoredCandidates) {
    if (selectedCandidates.length >= MAX_SCREENSHOTS) {
      break;
    }

    const candidate = item.candidate;
    const tooClose = selectedCandidates.some(
      (selected) =>
        Math.abs(selected.lineIndex - candidate.lineIndex) < MIN_LINE_SPREAD,
    );
    const repeatsHeading = selectedCandidates.some(
      (selected) =>
        selected.heading && candidate.heading
          ? selected.heading === candidate.heading
          : false,
    );

    if (tooClose || repeatsHeading) {
      continue;
    }

    selectedCandidates.push(candidate);
  }

  if (selectedCandidates.length === 0) {
    const topCandidate = scoredCandidates[0]?.candidate;
    if (!topCandidate) {
      return null;
    }
    selectedCandidates.push(topCandidate);
  } else if (
    selectedCandidates.length < Math.min(MAX_SCREENSHOTS, scoredCandidates.length)
  ) {
    for (const item of scoredCandidates) {
      if (selectedCandidates.length >= MAX_SCREENSHOTS) {
        break;
      }
      const candidate = item.candidate;
      if (selectedCandidates.includes(candidate)) {
        continue;
      }
      const alreadyChosen = selectedCandidates.some(
        (selected) => selected.url === candidate.url,
      );
      if (alreadyChosen) {
        continue;
      }
      // Allow relaxed spacing but still avoid duplicate sections back-to-back
      const lastSelected = selectedCandidates[selectedCandidates.length - 1];
      if (
        lastSelected?.heading &&
        candidate.heading &&
        lastSelected.heading === candidate.heading
      ) {
        continue;
      }
      selectedCandidates.push(candidate);
    }
  }

  if (selectedCandidates.length === 0) {
    return null;
  }

  const screenshotRequests: ScreenshotRequest[] = selectedCandidates
    .slice(0, MAX_SCREENSHOTS)
    .map((candidate, index) => ({
      url: candidate.url,
      title: candidate.sourceTitle ?? candidate.linkText,
      sectionHeading: candidate.heading,
      placement: index === 0 ? "start" : index === 1 ? "middle" : "end",
    }));

  const screenshotResult = await captureSpecificScreenshots({
    articleId: params.articleId,
    generationId: params.generationId,
    projectId: params.projectId,
    screenshotRequests,
  });

  const successes: ScreenshotEnhancementArtifacts["successes"] = [];
  const failures: ScreenshotEnhancementArtifacts["failures"] = [];
  let enhancedContent = params.content;

  for (const request of screenshotRequests) {
    const result = screenshotResult.screenshots[request.url];
    if (result && result.imageUrl.length > 0 && result.status === 200) {
      const rawAlt = result.alt ?? request.title ?? request.url;
      const sanitizedAlt = sanitizeAltText(rawAlt);
      const finalAlt =
        sanitizedAlt.length > 0
          ? sanitizedAlt
          : `Screenshot of ${getDomainFromUrl(request.url)}`;
      enhancedContent = insertScreenshotBelowLink(
        enhancedContent,
        request.url,
        finalAlt,
        result.imageUrl,
      );
      successes.push({
        url: request.url,
        imageUrl: result.imageUrl,
        alt: finalAlt,
        sectionHeading: request.sectionHeading,
        placement: request.placement,
      });
    } else {
      const reason = result
        ? `Screenshot request failed with status ${result.status}`
        : "Screenshot result missing";
      failures.push({ url: request.url, reason });
    }
  }

  if (successes.length === 0) {
    if (failures.length === 0) {
      return null;
    }
    return {
      content: params.content,
      artifacts: { requests: screenshotRequests, successes, failures },
      usageStats: screenshotResult.usageStats,
    };
  }

  return {
    content: enhancedContent,
    artifacts: { requests: screenshotRequests, successes, failures },
    usageStats: screenshotResult.usageStats,
  };
}

function extractLinksWithContext(content: string): ExtractedLink[] {
  const lines = content.split("\n");
  const result: ExtractedLink[] = [];
  const headingRegex = /^#{2,6}\s+(.*)$/;
  let currentHeading = "";
  let inSourcesSection = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const headingMatch = headingRegex.exec(line);
    if (headingMatch) {
      const headingText = headingMatch[1]?.trim() ?? "";
      if (/^sources$/i.test(headingText)) {
        inSourcesSection = true;
      } else {
        inSourcesSection = false;
        currentHeading = headingText;
      }
      continue;
    }

    if (inSourcesSection) {
      continue;
    }

    const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
    let match: RegExpExecArray | null = linkRegex.exec(line);
    while (match) {
      result.push({
        url: match[2] ?? "",
        linkText: match[1]?.trim() ?? match[2] ?? "",
        heading: currentHeading,
        lineIndex: i,
      });
      match = linkRegex.exec(line);
    }
  }

  return result;
}

function insertScreenshotBelowLink(
  originalContent: string,
  targetUrl: string,
  altText: string,
  imageUrl: string,
): string {
  const lines = originalContent.split("\n");
  const escapedUrl = escapeRegExp(targetUrl);
  const linkPattern = new RegExp(`\\]\(${escapedUrl}\)`);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (!linkPattern.test(line)) {
      continue;
    }

    const imageMarkdown = `![${altText}](${imageUrl})`;
    const nextLine = lines[i + 1] ?? "";
    if (nextLine.trim() === imageMarkdown.trim()) {
      return originalContent;
    }

    const updatedLines = [...lines];
    if (nextLine.trim().length === 0) {
      const followingLine = updatedLines[i + 2] ?? "";
      if (followingLine.trim() === imageMarkdown.trim()) {
        return originalContent;
      }
      updatedLines.splice(i + 2, 0, imageMarkdown);
    } else {
      updatedLines.splice(i + 1, 0, "", imageMarkdown);
    }
    return updatedLines.join("\n");
  }

  return `${originalContent}\n\n![${altText}](${imageUrl})`;
}

function sanitizeAltText(input: string): string {
  return input
    .replace(/\r?\n/g, " ")
    .replace(/[\[\]]/g, "")
    .trim();
}

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeUrlForComparison(url: string): string {
  try {
    const parsed = new URL(url);
    const normalizedHost = normalizeDomain(parsed.hostname);
    const normalizedPath = parsed.pathname.replace(/\/+$/g, "");
    const normalizedSearch = parsed.search;
    return `${parsed.protocol}//${normalizedHost}${normalizedPath}${normalizedSearch}`;
  } catch (error) {
    logger.warn("screenshot:url_normalize_failed", {
      url: url.substring(0, 100),
      error: error instanceof Error ? error.message : "unknown",
    });
    return url.trim();
  }
}

function computeScreenshotScore(candidate: ScreenshotCandidate): number {
  let score = 1;
  const domain = candidate.validation.domain ?? getDomainFromUrl(candidate.url);
  if (
    domain.includes("news") ||
    domain.includes("edu") ||
    domain.includes("org") ||
    domain.endsWith(".gov")
  ) {
    score += 3;
  }

  if (
    domain.includes("blog") ||
    domain.includes("guide") ||
    domain.includes("tutorial")
  ) {
    score += 2;
  }

  if (candidate.url.startsWith("https://")) {
    score += 0.5;
  }

  const baseTitle = candidate.sourceTitle ?? candidate.linkText;
  if (baseTitle.length > 20) {
    score += 1;
  }

  if (candidate.heading && candidate.heading.length > 0) {
    score += 0.5;
  }

  return score;
}

function getDomainFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return normalizeDomain(parsed.hostname);
  } catch (error) {
    logger.debug("screenshot:domain_parse_failed", {
      url: url.substring(0, 100),
      error: error instanceof Error ? error.message : "unknown",
    });
    return url.trim().toLowerCase();
  }
}

function validateUrlForScreenshot(
  url: string,
  excludedDomains: string[],
): ScreenshotUrlValidationResult {
  try {
    const urlObj = new URL(url);
    const normalizedDomain = normalizeDomain(urlObj.hostname.toLowerCase());

    if (excludedDomains.length > 0) {
      const match = excludedDomains.some((excluded) => {
        const normalizedExcluded = normalizeDomain(excluded);
        return (
          normalizedDomain === normalizedExcluded ||
          normalizedDomain.endsWith(`.${normalizedExcluded}`)
        );
      });
      if (match) {
        return {
          isValid: false,
          reason: "Domain excluded by project settings",
          domain: normalizedDomain,
          category: "excluded-domain",
        };
      }
    }

    const isSocial = SOCIAL_MEDIA_DOMAINS.some(
      (blocked) =>
        normalizedDomain === blocked ||
        normalizedDomain.endsWith(`.${blocked}`),
    );
    if (isSocial) {
      return {
        isValid: false,
        reason: "Social media domain",
        domain: normalizedDomain,
        category: "social-media",
      };
    }

    const isVideoPlatform = VIDEO_PLATFORMS.some(
      (blocked) =>
        normalizedDomain === blocked ||
        normalizedDomain.endsWith(`.${blocked}`),
    );
    if (isVideoPlatform) {
      return {
        isValid: false,
        reason: "Video platform domain",
        domain: normalizedDomain,
        category: "video-platform",
      };
    }

    const isBrandDomain = PROBLEMATIC_BRAND_DOMAINS.some(
      (blocked) =>
        normalizedDomain === blocked ||
        normalizedDomain.endsWith(`.${blocked}`),
    );
    if (isBrandDomain) {
      return {
        isValid: false,
        reason: "Brand domain flagged for screenshots",
        domain: normalizedDomain,
        category: "brand-domain",
      };
    }

    const isFileSharing = FILE_SHARING_DOMAINS.some(
      (blocked) =>
        normalizedDomain === blocked ||
        normalizedDomain.endsWith(`.${blocked}`),
    );
    if (isFileSharing) {
      return {
        isValid: false,
        reason: "File sharing domain",
        domain: normalizedDomain,
        category: "file-sharing",
      };
    }

    const pathname = urlObj.pathname.toLowerCase();
    const problematicPaths = [
      "/login",
      "/signin",
      "/signup",
      "/register",
      "/checkout",
      "/cart",
      "/payment",
      "/api/",
      "/admin/",
      "/dashboard/",
      "/download/",
      "/file/",
      "/attachment/",
    ];

    const pathMatch = problematicPaths.some((path) => pathname.includes(path));
    if (pathMatch) {
      return {
        isValid: false,
        reason: "Problematic path for screenshot capture",
        domain: normalizedDomain,
        category: "invalid-url",
      };
    }

    if (/\.(pdf|docx?|xlsx?|pptx?|zip|rar|tar|gz)$/i.exec(pathname)) {
      return {
        isValid: false,
        reason: "Unsupported file format",
        domain: normalizedDomain,
        category: "invalid-url",
      };
    }

    return { isValid: true, domain: normalizedDomain };
  } catch (error) {
    logger.warn("screenshot:url_invalid", {
      url: url.substring(0, 100),
      error: error instanceof Error ? error.message : "unknown",
    });
    return {
      isValid: false,
      reason: "Invalid URL",
      category: "invalid-url",
    };
  }
}

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

async function captureSpecificScreenshots(
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
  });

  return {
    imageUrl: blob.url,
    alt: request.title ?? "screenshot",
    status: response.status,
  };
}

export { enhanceArticleWithScreenshots };
