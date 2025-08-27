import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

const validateUrlSchema = z.object({
  url: z.string().url("Invalid URL format"),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as unknown;
    const { url } = validateUrlSchema.parse(body);

    // Try to fetch the URL to see if it exists
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    const response = await fetch(url, {
      method: "HEAD", // Use HEAD to avoid downloading the full response
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      return NextResponse.json({ 
        valid: true, 
        status: response.status,
        contentType: response.headers.get("content-type") 
      });
    } else {
      return NextResponse.json({ 
        valid: false, 
        status: response.status 
      }, { status: 400 });
    }
  } catch (error) {
    console.error("URL validation error:", error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: "Invalid input data", 
        details: error.errors 
      }, { status: 400 });
    }
    
    return NextResponse.json({ 
      valid: false, 
      error: "Failed to validate URL" 
    }, { status: 500 });
  }
}
