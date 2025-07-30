import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Generic fetcher function with response time logging and 5-minute timeout
export async function fetcher<T = unknown>(
  url: string,
  options: {
    method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
    body?: unknown;
    headers?: Record<string, string>;
    responseType?: "json" | "text" | "blob";
    timeout?: number;
  } = {},
): Promise<T> {
  const {
    method = "GET",
    body,
    headers = {},
    responseType = "json",
    timeout = 5 * 60 * 1000,
  } = options; // 5 minutes default

  const startTime = Date.now();

  console.log(`Making ${method} request to ${url}`, {
    responseType,
    hasBody: !!body,
    timeout: `${timeout}ms`,
  });

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const responseTime = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text();
      const error = new Error(
        `API call failed: ${response.status} ${errorText}`,
      );
      console.log(`API call failed: ${method} ${url}`, {
        status: response.status,
        errorText,
        responseTime: `${responseTime}ms`,
      });
      throw error;
    }

    let result: T;

    switch (responseType) {
      case "text":
        result = (await response.text()) as T;
        break;
      case "blob":
        result = (await response.blob()) as T;
        break;
      case "json":
      default:
        result = (await response.json()) as T;
        break;
    }

    console.log(`API call successful: ${method} ${url}`, {
      responseTime: `${responseTime}ms`,
    });

    return result;
  } catch (error) {
    const responseTime = Date.now() - startTime;

    if (error instanceof Error && error.name === "AbortError") {
      console.log(`API call timeout: ${method} ${url}`, {
        timeout: `${timeout}ms`,
        responseTime: `${responseTime}ms`,
      });
      throw new Error(`Request timeout after ${timeout}ms`);
    }

    // Handle Node.js/undici timeout errors
    if (error instanceof Error && 
        (error.message.includes('HeadersTimeoutError') || 
         error.message.includes('UND_ERR_HEADERS_TIMEOUT') ||
         (error.cause && typeof error.cause === 'object' && 'code' in error.cause && error.cause.code === 'UND_ERR_HEADERS_TIMEOUT'))) {
      console.log(`API call headers timeout: ${method} ${url}`, {
        timeout: `${timeout}ms`,
        responseTime: `${responseTime}ms`,
      });
      throw new Error(`Request headers timeout after ${responseTime}ms`);
    }

    console.log(`API call error: ${method} ${url}`, {
      error: error instanceof Error ? error.message : "Unknown error",
      responseTime: `${responseTime}ms`,
    });
    throw error;
  }
}
