// AI Model Constants
export const MODELS = {
  GEMINI_2_5_FLASH: 'gemini-2.0-flash-exp',
  CLAUDE_SONET_4: 'claude-3-5-sonnet-20241022',
} as const;

export type ModelType = typeof MODELS[keyof typeof MODELS];