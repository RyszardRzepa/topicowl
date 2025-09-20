import { selectImageForArticle } from "@/lib/services/image-selection";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      articleId: number;
      generationId: number;
      title: string;
      keywords: string[];
      orientation?: "landscape" | "portrait" | "squarish";
      userId?: string;
      projectId?: number;
    };

    console.log("[API] Received image selection request:", {
      articleId: body.articleId,
      title: body.title,
    });

    if (
      !body.articleId ||
      !body.generationId ||
      !body.title ||
      !body.projectId
    ) {
      return new Response(
        JSON.stringify({
          success: false,
          error:
            "Missing required fields: articleId, generationId, title, projectId",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const result = await selectImageForArticle({
      ...body,
      userId: body.userId ?? "unknown", // Service needs userId but this route doesn't always have it
      projectId: body.projectId,
    });

    if (result.success) {
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    // This path may not be reachable if the service throws errors, but for type safety:
    return new Response(
      JSON.stringify({ success: false, error: "An unknown error occurred" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[API] Error in image selection:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
