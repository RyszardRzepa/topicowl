export const MODELS = {
  GEMINI_FLASH_2_5: "gemini-2.0-flash-exp",
  GEMINI_2_5_FLASH: "gemini-2.5-flash",
  GEMINI_2_5_PRO: "gemini-2.5-pro",
  CLAUDE_SONET_4: "claude-sonnet-4-20250514",
  OPENAI_GPT_5: "gpt-5-2025-08-07",
} as const;

// API URL constant for internal API calls
export const API_BASE_URL =
  process.env.NODE_ENV === "development"
    ? "http://localhost:3000"
    : (process.env.NEXT_PUBLIC_BASE_URL ?? `https://${process.env.VERCEL_URL}`);

// Session Management Utilities
// These utilities help prevent duplicate fetches on tab focus/visibility changes

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
  if (typeof window === 'undefined') return generateSessionId();
  
  let sessionId = sessionStorage.getItem('contentbot-session-id');
  if (!sessionId) {
    sessionId = generateSessionId();
    sessionStorage.setItem('contentbot-session-id', sessionId);
  }
  return sessionId;
}

/**
 * Checks if a specific session key has been initialized
 */
export function isSessionInitialized(key: string): boolean {
  if (typeof window === 'undefined') return false;
  
  try {
    const data = sessionStorage.getItem(key);
    if (!data) return false;
    
    const sessionData = JSON.parse(data);
    const currentSessionId = getSessionId();
    
    // Check if the stored session matches current session and is initialized
    return sessionData.sessionId === currentSessionId && sessionData.initialized === true;
  } catch {
    return false;
  }
}

/**
 * Marks a session key as initialized
 */
export function markSessionInitialized(key: string, data?: unknown): void {
  if (typeof window === 'undefined') return;
  
  const sessionData = {
    sessionId: getSessionId(),
    timestamp: Date.now(),
    initialized: true,
    data
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
  if (typeof window === 'undefined') return null;
  
  try {
    const data = sessionStorage.getItem(key);
    if (!data) return null;
    
    const sessionData = JSON.parse(data);
    const currentSessionId = getSessionId();
    
    // Only return data if it's from the current session
    if (sessionData.sessionId === currentSessionId) {
      return sessionData.data ?? null;
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
  if (typeof window === 'undefined') return;
  
  const sessionData = {
    sessionId: getSessionId(),
    timestamp: Date.now(),
    initialized: true,
    data
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
  if (typeof window === 'undefined') return;
  
  try {
    // Clear all contentbot session keys
    const keys = [
      'contentbot-session-id',
      'contentbot-onboarding-session',
      'contentbot-projects-session',
      'contentbot-credits-session'
    ];
    
    keys.forEach(key => {
      sessionStorage.removeItem(key);
    });
  } catch {
    // Silently fail if sessionStorage is not available
  }
}
