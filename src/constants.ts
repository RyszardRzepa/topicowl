export const MODELS = {
  GEMINI_2_5_FLASH: "gemini-2.5-flash",
  GEMINI_2_5_PRO: "gemini-2.5-pro",
  CLAUDE_SONET_4: "claude-sonnet-4-20250514",
  OPENAI_GPT_5: "gpt-5-2025-08-07",
} as const;

// SEO & Quality thresholds
export const SEO_MIN_SCORE =75
export const SEO_MAX_REMEDIATION_PASSES = 3

// Pricing plans for credit purchases
export const PRICING_PLANS = {
  STARTER: {
    name: "Starter",
    price: 16,
    priceInCents: 1600, // $16.00
    credits: 50,
    description: "Perfect for trying out content creation.",
    pricePerCredit: 0.32,
    discount: 0,
  },
  WRITER: {
    name: "Writer",
    price: 39,
    priceInCents: 3900, // $39.00
    credits: 150,
    description: "Great for regular content creators.",
    pricePerCredit: 0.26,
    discount: 19, // 19% discount
  },
  PRO: {
    name: "Pro",
    price: 89,
    priceInCents: 8900, // $89.00
    credits: 500,
    description: "Perfect for content agencies.",
    pricePerCredit: 0.18,
    discount: 44, // 44% discount
  },
} as const;

// API URL constant for internal API calls
export const API_BASE_URL =
  process.env.NODE_ENV === "development"
    ? "http://localhost:3000"
    : `https://www.topicowl.com`;

// Session Management Utilities
// These utilities help prevent duplicate fetches on tab focus/visibility changes

interface SessionData<T = unknown> {
  sessionId: string;
  timestamp: number;
  initialized: boolean;
  data?: T;
}

/**
 * Type guard to check if parsed JSON is a valid SessionData object
 */
function isValidSessionData(obj: unknown): obj is SessionData {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "sessionId" in obj &&
    "timestamp" in obj &&
    "initialized" in obj &&
    typeof (obj as SessionData).sessionId === "string" &&
    typeof (obj as SessionData).timestamp === "number" &&
    typeof (obj as SessionData).initialized === "boolean"
  );
}

/**
 * Generates a unique session ID for the current browser session
 */
export function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Gets the current session ID, creating one if it doesn't exist
 */
export function getSessionId(): string {
  if (typeof window === "undefined") return generateSessionId();

  let sessionId = sessionStorage.getItem("contentbot-session-id");
  if (!sessionId) {
    sessionId = generateSessionId();
    sessionStorage.setItem("contentbot-session-id", sessionId);
  }
  return sessionId;
}

/**
 * Checks if a specific session key has been initialized
 */
export function isSessionInitialized(key: string): boolean {
  if (typeof window === "undefined") return false;

  try {
    const data = sessionStorage.getItem(key);
    if (!data) return false;

    const parsed: unknown = JSON.parse(data);
    if (!isValidSessionData(parsed)) return false;

    const currentSessionId = getSessionId();

    // Check if the stored session matches current session and is initialized
    return parsed.sessionId === currentSessionId && parsed.initialized === true;
  } catch {
    return false;
  }
}

/**
 * Marks a session key as initialized
 */
export function markSessionInitialized(key: string, data?: unknown): void {
  if (typeof window === "undefined") return;

  const sessionData = {
    sessionId: getSessionId(),
    timestamp: Date.now(),
    initialized: true,
    data,
  };

  try {
    sessionStorage.setItem(key, JSON.stringify(sessionData));
  } catch {
    // Silently fail if sessionStorage is not available
  }
}

/**
 * Gets session data for a specific key
 */
export function getSessionData<T = unknown>(key: string): T | null {
  if (typeof window === "undefined") return null;

  try {
    const data = sessionStorage.getItem(key);
    if (!data) return null;

    const parsed: unknown = JSON.parse(data);
    if (!isValidSessionData(parsed)) return null;

    const currentSessionId = getSessionId();

    // Only return data if it's from the current session
    if (parsed.sessionId === currentSessionId) {
      return (parsed.data as T) ?? null;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Stores session data for a specific key
 */
export function setSessionData<T = unknown>(key: string, data: T): void {
  if (typeof window === "undefined") return;

  const sessionData = {
    sessionId: getSessionId(),
    timestamp: Date.now(),
    initialized: true,
    data,
  };

  try {
    sessionStorage.setItem(key, JSON.stringify(sessionData));
  } catch {
    // Silently fail if sessionStorage is not available
  }
}

/**
 * Clears all session data (useful on logout)
 */
export function clearSession(): void {
  if (typeof window === "undefined") return;

  try {
    // Clear all contentbot session keys
    const keys = [
      "contentbot-session-id",
      "contentbot-onboarding-session",
      "contentbot-projects-session",
      "contentbot-credits-session",
    ];

    keys.forEach((key) => {
      sessionStorage.removeItem(key);
    });
  } catch {
    // Silently fail if sessionStorage is not available
  }
}
