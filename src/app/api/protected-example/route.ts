import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export async function GET() {
  const { userId } = await auth();
  
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  // Your protected API logic here
  return NextResponse.json({ 
    message: "This is a protected API route",
    userId: userId 
  });
}

export async function POST(request: Request) {
  const { userId } = await auth();
  
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  const body = await request.json() as Record<string, unknown>;
  
  // Your protected API logic here
  return NextResponse.json({ 
    message: "Data processed successfully",
    userId: userId,
    data: body
  });
}
