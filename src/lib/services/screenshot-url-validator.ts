/**
 * URL Validation Service for Screenshot Capture
 * 
 * This service determines which URLs are suitable for screenshot capture by filtering out:
 * - Social media platforms (Facebook, Twitter, Instagram, LinkedIn, etc.)
 * - Video platforms (YouTube, Vimeo, TikTok, etc.) 
 * - Known brand domains that may have anti-scraping measures
 * - Invalid or problematic URLs
 * 
 * The goal is to capture screenshots of legitimate websites that we reference in articles,
 * not social media posts or branded content that may have usage restrictions.
 */

import { normalizeDomain } from "@/lib/utils/domain";
import { logger } from "@/lib/utils/logger";

// Social media platforms that should never be screenshotted
const SOCIAL_MEDIA_DOMAINS = [
  // Facebook/Meta platforms
  "facebook.com",
  "fb.com", 
  "instagram.com",
  "threads.net",
  "whatsapp.com",

  // Twitter/X
  "twitter.com",
  "x.com",
  "t.co",

  // LinkedIn
  "linkedin.com",
  "lnkd.in",

  // Video platforms
  "youtube.com",
  "youtu.be",
  "vimeo.com",
  "tiktok.com",
  "snapchat.com",
  "twitch.tv",
  "dailymotion.com",

  // Other social platforms
  "reddit.com", 
  "pinterest.com",
  "tumblr.com",
  "discord.com",
  "telegram.org",
  "signal.org",
  "clubhouse.com",
  "mastodon.social",
  "mastodon.world",

  // Professional/networking
  "slack.com",
  "zoom.us",
  "teams.microsoft.com",
  "meet.google.com",
  
  // Forums and discussion
  "discord.gg",
  "quora.com",
  "stackoverflow.com", // Usually not good for screenshots due to dynamic content
] as const;

// Video/streaming platforms that we should never screenshot
const VIDEO_PLATFORMS = [
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
] as const;

// Major tech/brand domains that often have anti-scraping measures or are not suitable for screenshots
const PROBLEMATIC_BRAND_DOMAINS = [
  // Major tech platforms
  "google.com",
  "apple.com",
  "microsoft.com", 
  "amazon.com",
  "netflix.com",

  // E-commerce that may be problematic
  "shopify.com",
  "etsy.com",
  "ebay.com",
  "alibaba.com",

  // Cloud/SaaS platforms (usually not good screenshot subjects)
  "salesforce.com",
  "hubspot.com",
  "zendesk.com",
  "intercom.com",
  "atlassian.com",
  "github.com", // Code repos usually not good for screenshots
  "gitlab.com",
  "bitbucket.org",

  // Financial/banking (usually have anti-scraping)
  "paypal.com",
  "stripe.com",
  "square.com",
  "venmo.com",

  // News aggregators (often dynamic, not good for screenshots)
  "news.google.com",
  "flipboard.com",
] as const;

// File sharing and cloud storage (not suitable for screenshots)
const FILE_SHARING_DOMAINS = [
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
] as const;

// All blocked domains combined (for reference)
// const ALL_BLOCKED_DOMAINS = [
//   ...SOCIAL_MEDIA_DOMAINS,
//   ...VIDEO_PLATFORMS, 
//   ...PROBLEMATIC_BRAND_DOMAINS,
//   ...FILE_SHARING_DOMAINS,
// ] as const;

export interface ScreenshotUrlValidationResult {
  isValid: boolean;
  reason?: string;
  domain?: string;
  category?: 'social-media' | 'video-platform' | 'brand-domain' | 'file-sharing' | 'invalid-url' | 'excluded-domain';
}

/**
 * Validates if a URL is suitable for screenshot capture
 */
export function validateUrlForScreenshot(
  url: string, 
  excludedDomains: string[] = []
): ScreenshotUrlValidationResult {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    const normalizedDomain = normalizeDomain(hostname);

    logger.debug("[SCREENSHOT_URL_VALIDATOR] Validating URL for screenshot", {
      url: url.substring(0, 100),
      hostname,
      normalizedDomain
    });

    // Check if domain is in project's excluded domains
    if (excludedDomains.length > 0) {
      const isExcluded = excludedDomains.some(excluded => 
        normalizedDomain === normalizeDomain(excluded) ||
        normalizedDomain.endsWith('.' + normalizeDomain(excluded))
      );
      
      if (isExcluded) {
        return {
          isValid: false,
          reason: "Domain is in project's excluded domains list",
          domain: normalizedDomain,
          category: 'excluded-domain'
        };
      }
    }

    // Check if it's a social media platform
    if (SOCIAL_MEDIA_DOMAINS.some(blocked => 
        normalizedDomain === blocked || 
        normalizedDomain.endsWith('.' + blocked)
    )) {
      return {
        isValid: false,
        reason: "Social media platforms are not suitable for screenshots", 
        domain: normalizedDomain,
        category: 'social-media'
      };
    }

    // Check if it's a video platform
    if (VIDEO_PLATFORMS.some(blocked => 
        normalizedDomain === blocked || 
        normalizedDomain.endsWith('.' + blocked)
    )) {
      return {
        isValid: false,
        reason: "Video platforms are not suitable for screenshots",
        domain: normalizedDomain, 
        category: 'video-platform'
      };
    }

    // Check if it's a problematic brand domain
    if (PROBLEMATIC_BRAND_DOMAINS.some(blocked => 
        normalizedDomain === blocked || 
        normalizedDomain.endsWith('.' + blocked)
    )) {
      return {
        isValid: false,
        reason: "Major brand domains often have anti-scraping measures",
        domain: normalizedDomain,
        category: 'brand-domain' 
      };
    }

    // Check if it's a file sharing service
    if (FILE_SHARING_DOMAINS.some(blocked => 
        normalizedDomain === blocked || 
        normalizedDomain.endsWith('.' + blocked)
    )) {
      return {
        isValid: false,
        reason: "File sharing services are not suitable for screenshots",
        domain: normalizedDomain,
        category: 'file-sharing'
      };
    }

    // Additional checks for screenshot suitability
    
    // Check for specific paths that are usually not good for screenshots
    const problematicPaths = [
      '/login', '/signin', '/signup', '/register',
      '/checkout', '/cart', '/payment',
      '/api/', '/admin/', '/dashboard/',
      '/download/', '/file/', '/attachment/'
    ];
    
    const pathname = urlObj.pathname.toLowerCase();
    if (problematicPaths.some(path => pathname.includes(path))) {
      return {
        isValid: false,
        reason: "URL appears to be a login, payment, or administrative page",
        domain: normalizedDomain,
        category: 'invalid-url'
      };
    }

    // Check for PDFs or other file formats (not suitable for web screenshots)
    const fileExtensionRegex = /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|zip|rar|tar|gz)$/i;
    if (fileExtensionRegex.exec(pathname)) {
      return {
        isValid: false,
        reason: "Document files are not suitable for web screenshots",
        domain: normalizedDomain,
        category: 'invalid-url'
      };
    }

    logger.debug("[SCREENSHOT_URL_VALIDATOR] URL is valid for screenshot", {
      url: url.substring(0, 100),
      domain: normalizedDomain
    });

    return {
      isValid: true,
      domain: normalizedDomain
    };

  } catch (error) {
    logger.warn("[SCREENSHOT_URL_VALIDATOR] Invalid URL format", {
      url: url.substring(0, 100),
      error: error instanceof Error ? error.message : "Unknown error"
    });
    
    return {
      isValid: false,
      reason: "Invalid URL format",
      category: 'invalid-url'
    };
  }
}

/**
 * Filters a list of URLs to only include those suitable for screenshots
 */
export function filterUrlsForScreenshots(
  urls: Array<{ url: string; title?: string }>,
  excludedDomains: string[] = []
): Array<{ url: string; title?: string }> {
  const validUrls: Array<{ url: string; title?: string }> = [];
  let filteredCount = 0;

  for (const item of urls) {
    const validation = validateUrlForScreenshot(item.url, excludedDomains);
    
    if (validation.isValid) {
      validUrls.push(item);
    } else {
      filteredCount++;
      logger.debug("[SCREENSHOT_URL_VALIDATOR] Filtered URL", {
        url: item.url.substring(0, 100),
        reason: validation.reason,
        category: validation.category
      });
    }
  }

  if (filteredCount > 0) {
    logger.info("[SCREENSHOT_URL_VALIDATOR] Filtering summary", {
      totalUrls: urls.length,
      validUrls: validUrls.length,
      filteredUrls: filteredCount
    });
  }

  return validUrls;
}

/**
 * Validates and returns the best URLs for screenshots from a source list
 * Prioritizes news sites, blogs, and informational websites over other types
 */
export function selectBestScreenshotUrls(
  sources: Array<{ url: string; title?: string }>,
  excludedDomains: string[] = [],
  maxUrls = 3
): Array<{ url: string; title?: string; reason: string }> {
  // First filter to only valid URLs
  const validSources = filterUrlsForScreenshots(sources, excludedDomains);

  if (validSources.length === 0) {
    return [];
  }

  // Score URLs based on likelihood of being good screenshot subjects
  const scoredUrls = validSources.map(source => {
    let score = 1;
    const domain = normalizeDomain(source.url);

    // Prefer news sites and educational content
    if (domain.includes('news') || 
        domain.includes('edu') || 
        domain.includes('org') ||
        domain.endsWith('.gov')) {
      score += 3;
    }

    // Prefer sites that likely have good visual content
    if (domain.includes('blog') ||
        domain.includes('guide') ||
        domain.includes('tutorial')) {
      score += 2; 
    }

    // Slightly prefer HTTPS
    if (source.url.startsWith('https://')) {
      score += 0.5;
    }

    // Prefer sources with descriptive titles
    if (source.title && source.title.length > 20) {
      score += 1;
    }

    return {
      ...source,
      reason: "Primary source referenced in article", 
      score
    };
  });

  // Sort by score and take the best ones
  const bestUrls = scoredUrls
    .sort((a, b) => b.score - a.score)
    .slice(0, maxUrls)
    .map(({ score: _score, ...rest }) => rest); // Remove score from final result

  logger.debug("[SCREENSHOT_URL_VALIDATOR] Selected best URLs", {
    originalCount: sources.length,
    validCount: validSources.length,
    selectedCount: bestUrls.length,
    selectedDomains: bestUrls.map(u => normalizeDomain(u.url))
  });

  return bestUrls;
}