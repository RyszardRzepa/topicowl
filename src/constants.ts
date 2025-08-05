export const MODELS = {
  GEMINI_FLASH_2_5: "gemini-2.0-flash-exp",
  GEMINI_2_5_FLASH: "gemini-2.5-flash",
  GEMINI_2_5_PRO: "gemini-2.5-pro",
  CLAUDE_SONET_4: "claude-sonnet-4-20250514",
} as const;

// API URL constant for internal API calls
export const API_BASE_URL =
  process.env.NODE_ENV === "development"
    ? "http://localhost:3000"
    : (process.env.NEXT_PUBLIC_BASE_URL ?? `https://${process.env.VERCEL_URL}`);
