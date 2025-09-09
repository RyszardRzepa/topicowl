import Cloudflare from "cloudflare";
import { extractLinks } from "@/lib/utils/markdown";
import { put } from "@vercel/blob";
import crypto from "node:crypto";
import { env } from "@/env";
import { db } from "@/server/db";
import { projects } from "@/server/db/schema";
import { eq } from "drizzle-orm";

interface ScreenshotParams {
  articleId: number;
  generationId: number;
  markdown: string;
  projectId: number;
}

interface ScreenshotResult {
  updatedMarkdown: string;
  screenshots: Record<
    string,
    { imageUrl: string; alt: string; status: number }
  >;
}

export async function captureAndAttachScreenshots(
  params: ScreenshotParams,
): Promise<ScreenshotResult> {
  const { markdown, articleId, projectId } = params;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
  const client = new Cloudflare({
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    apiToken: env.CF_API_TOKEN,
  });

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const accountId = env.CF_ACCOUNT_ID;

  // Base URL for resolving internal links (if any)
  let baseOrigin: string | undefined;
  try {
    const [proj] = await db
      .select({ websiteUrl: projects.websiteUrl })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);
    if (proj?.websiteUrl) {
      const u = new URL(proj.websiteUrl);
      baseOrigin = `${u.protocol}//${u.host}`;
    }
  } catch {}

  const linksRaw = extractLinks(markdown);
  // Normalize URLs: for internal links, resolve against project base; skip unsupported schemes
  const links = linksRaw
    .map((l) => {
      try {
        if (!l.internal) {
          // Already absolute or protocol-relative
          const url = new URL(l.url.startsWith("//") ? `https:${l.url}` : l.url);
          if (url.protocol === "http:" || url.protocol === "https:") return { ...l, absUrl: url.toString() };
          return null;
        }
        // Internal: need base
        if (!baseOrigin) return null;
        const url = new URL(l.url.startsWith("/") ? l.url : `/${l.url}`, baseOrigin);
        if (url.protocol === "http:" || url.protocol === "https:") return { ...l, absUrl: url.toString() };
        return null;
      } catch {
        return null;
      }
    })
    .filter((link): link is ReturnType<typeof extractLinks>[number] & { absUrl: string } => link !== null);
  const screenshots: Record<
    string,
    { imageUrl: string; alt: string; status: number }
  > = {};
  let updated = markdown;

  // Choose up to 3 links spread across the article by line position
  const withLine = links.map((l) => {
    if (typeof l.line === "number") return l;
    // Try to approximate line by searching for ")]" + url in the text
    const idx = updated.indexOf(l.url);
    if (idx >= 0) {
      const upto = updated.slice(0, idx);
      const approxLine = (upto.match(/\n/g) ?? []).length + 1;
      return { ...l, line: approxLine };
    }
    return { ...l, line: Number.MAX_SAFE_INTEGER };
  });

  withLine.sort((a, b) => (a.line! - b.line!));

  let candidates: typeof withLine = withLine;
  if (withLine.length > 3) {
    const n = withLine.length;
    const picks = Array.from(new Set([0, Math.floor(n / 2), n - 1]));
    if (picks.length < 3 && n >= 3) {
      // Alternative spread
      const alt = [0, Math.floor(n / 3), Math.floor((2 * n) / 3), n - 1];
      for (const i of alt) if (!picks.includes(i) && picks.length < 3) picks.push(i);
    }
    candidates = picks.map((i) => withLine[i]).filter((item): item is typeof withLine[number] => item !== undefined);
  }

  let lastInsertedLine = -10;
  for (const link of candidates) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const res = await client.browserRendering.screenshot.create({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        account_id: accountId,
        url: link.absUrl,
        screenshotOptions: { omitBackground: true },
      });

      // According to Cloudflare documentation, the screenshot response should contain the binary data
      // The response might be a direct binary response or a JSON with base64 data
      const screenshot = res as unknown as ArrayBuffer | { result?: { screenshot?: string } } | string;
      
      let buffer: Buffer | null = null;
      let status = 200;

      if (screenshot instanceof ArrayBuffer) {
        // Direct binary response
        buffer = Buffer.from(screenshot);
      } else if (typeof screenshot === "string") {
        // Base64 string response
        if (screenshot.startsWith("data:")) {
          const base64 = screenshot.substring(screenshot.indexOf(",") + 1);
          buffer = Buffer.from(base64, "base64");
        } else if (/^[A-Za-z0-9+/=]+$/.test(screenshot)) {
          // Heuristic: looks like base64
          try {
            buffer = Buffer.from(screenshot, "base64");
          } catch {
            buffer = null;
          }
        }
      } else if (typeof screenshot === "object" && screenshot !== null) {
        // JSON response with nested result
        const resultData = screenshot as { result?: { screenshot?: string }; status?: number };
        const raw = resultData.result?.screenshot;
        status = resultData.status ?? 200;
        
        if (raw) {
          if (raw.startsWith("data:")) {
            const base64 = raw.substring(raw.indexOf(",") + 1);
            buffer = Buffer.from(base64, "base64");
          } else if (/^[A-Za-z0-9+/=]+$/.test(raw)) {
            // Heuristic: looks like base64
            try {
              buffer = Buffer.from(raw, "base64");
            } catch {
              buffer = null;
            }
          }
        }
      }

      if (!buffer) {
        screenshots[link.url] = {
          imageUrl: "",
          alt: link.text ?? "screenshot",
          status: 500,
        };
        continue;
      }

      // Upload to Vercel Blob (public access)
      const hash = crypto
        .createHash("sha256")
        .update(link.url)
        .digest("hex")
        .slice(0, 16);
      const key = `article_screenshots/${projectId}/${articleId}/${hash}.png`;
      
      let blob: { url: string };
      try {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
        blob = await put(key, buffer, {
          access: "public",
          contentType: "image/png",
        });
      } catch {
        screenshots[link.url] = {
          imageUrl: "",
          alt: link.text ?? "screenshot", 
          status: 500,
        };
        continue;
      }

      const imageUrl = blob.url;
      screenshots[link.url] = {
        imageUrl,
        alt: link.text ?? "screenshot",
        status,
      };

      // Insert image markdown below the paragraph containing the link when possible
      if (typeof link.line === "number" && link.line > 0) {
        const lns = updated.split(/\r?\n/);
        const idx = Math.min(link.line, lns.length) - 1;
        const screenshotData = screenshots[link.url];
        const alt = screenshotData?.alt ?? "screenshot";
        const imgMd = `![${alt}](${imageUrl})`;

        // Find end of the paragraph block starting at or after the link line
        let insertAt = idx + 1;
        while (insertAt < lns.length && (lns[insertAt]?.trim().length ?? 0) > 0) insertAt++;

        // Ensure images are not back-to-back: if too close to previous image, push down a bit
        if (insertAt <= lastInsertedLine + 2) {
          let k = insertAt;
          while (k < lns.length && (lns[k]?.trim().length ?? 0) > 0) k++;
          insertAt = Math.min(k + 1, lns.length);
        }

        // Insert a blank line then image
        lns.splice(insertAt, 0, "", imgMd, "");
        updated = lns.join("\n");
        lastInsertedLine = insertAt + 1; // image line index
      }
    } catch {
      screenshots[link.url] = {
        imageUrl: "",
        alt: link.text ?? "screenshot",
        status: 500,
      };
    }
  }

  return { updatedMarkdown: updated, screenshots };
}
