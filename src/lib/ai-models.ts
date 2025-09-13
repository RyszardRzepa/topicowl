import { auth } from "@clerk/nextjs/server";
import { withTracing } from "@posthog/ai";
import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import { MODELS } from "../constants";
import getPostHogServer from "./posthog-server";

/**
 * Available AI model providers
 */
export type AIProvider = "anthropic" | "google" | "openai";

/**
 * Gets the current user ID for PostHog tracking
 */
async function getUserId(): Promise<string> {
  try {
    const { userId } = await auth();
    return userId ?? "anonymous";
  } catch {
    return "anonymous";
  }
}

/**
 * Gets an AI model with PostHog tracing
 * @param provider - The AI provider ("anthropic", "google", or "openai")
 * @param modelId - The specific model ID to use
 * @param service - The service name for tracking purposes
 */
export async function getModel(provider: AIProvider, modelId: string, service: string) {
  const userId = await getUserId();
  const phClient = getPostHogServer();
  
  let baseModel;
  switch (provider) {
    case "anthropic":
      baseModel = anthropic(modelId);
      break;
    case "google":
      baseModel = google(modelId);
      break;
    case "openai":
      baseModel = openai(modelId);
      break;
    default:
      throw new Error(`Unsupported provider: ${provider as string}`);
  }
  
  return withTracing(
    baseModel,
    phClient,
    {
      posthogDistinctId: userId,
      posthogProperties: { 
        provider,
        model: modelId,
        service
      },
      posthogPrivacyMode: false,
    }
  );
}