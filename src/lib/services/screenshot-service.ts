import Cloudflare from "cloudflare";
import { extractLinks } from "@/lib/utils/markdown";

interface ScreenshotParams {
  articleId: number;
  generationId: number;
  markdown: string;
  projectId: number;
}

interface ScreenshotResult {
  updatedMarkdown: string;
  screenshots: Record<string, { imageUrl: string; alt: string; status: number }>;
}

export async function captureAndAttachScreenshots(
  params: ScreenshotParams,
): Promise<ScreenshotResult> {
  const { markdown } = params;
  const client = new Cloudflare({
    apiToken: process.env["CLOUDFLARE_API_TOKEN"],
  });
  const accountId = process.env["CLOUDFLARE_ACCOUNT_ID"];

  const links = extractLinks(markdown).filter((l) => !l.internal);
  const screenshots: Record<string, { imageUrl: string; alt: string; status: number }> = {};
  let updated = markdown;

  for (const link of links) {
    try {
      const res: any = await client.browserRendering.screenshot.create({
        account_id: accountId!,
        url: link.url,
        screenshotOptions: { omitBackground: true },
      } as any);
      const imageUrl = res?.result?.screenshot || "";
      screenshots[link.url] = {
        imageUrl,
        alt: link.text || "screenshot",
        status: res?.result?.status || 200,
      };
    } catch (err) {
      screenshots[link.url] = {
        imageUrl: "",
        alt: link.text || "screenshot",
        status: 500,
      };
    }
  }

  return { updatedMarkdown: updated, screenshots };
}
