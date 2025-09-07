/**
 * Minimal logger helper for generation flow. Debug logs are disabled by default.
 * Enable by setting `DEBUG_GENERATION=1` in env when needed.
 */
const DEBUG = process.env.DEBUG_GENERATION === "1";

export const logger = {
  debug: (...args: unknown[]) => {
    if (DEBUG) console.debug("[GEN]", ...args);
  },
  info: (...args: unknown[]) => {
    if (DEBUG) console.info("[GEN]", ...args);
  },
  warn: (...args: unknown[]) => console.warn("[GEN]", ...args),
  error: (...args: unknown[]) => console.error("[GEN]", ...args),
};

