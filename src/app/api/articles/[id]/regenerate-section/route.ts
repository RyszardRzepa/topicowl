import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import type { ApiResponse } from "@/types";

export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" } as ApiResponse,
      { status: 401 },
    );
  }

  return NextResponse.json(
    { success: false, error: "Not implemented" } as ApiResponse,
    { status: 501 },
  );
}
