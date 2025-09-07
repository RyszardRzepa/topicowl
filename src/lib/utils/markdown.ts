/**
 * Markdown analysis helpers used by SEO audit and quality gates.
 * Lightweight regex-based parsing to avoid extra runtime deps.
 */

export interface MarkdownHeading {
  level: 1 | 2 | 3 | 4 | 5 | 6;
  text: string;
  line: number; // 1-based
}

export interface MarkdownLink {
  url: string;
  text?: string;
  title?: string;
  line?: number; // best-effort when detected from classic [text](url)
  internal: boolean; // true when not http(s)/mailto
}

/**
 * Extract ATX (#, ##) and Setext (===, ---) headings from Markdown.
 */
export function extractHeadings(markdown: string): MarkdownHeading[] {
  const lines = markdown.split(/\r?\n/);
  const headings: MarkdownHeading[] = [];

  let previousLine = "";
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) {
      previousLine = "";
      continue;
    }

    // ATX headings: # to ######
    const atx = /^(#{1,6})\s+([^#].*?)\s*#*\s*$/.exec(line);
    if (atx?.[1] && atx?.[2]) {
      const level = atx[1].length as 1 | 2 | 3 | 4 | 5 | 6;
      const text = atx[2].trim();
      headings.push({ level, text, line: i + 1 });
      previousLine = line;
      continue;
    }

    // Setext headings: underlined with === (h1) or --- (h2)
    const setext = /^\s*(=+|-{2,})\s*$/.exec(line);
    if (setext?.[1] && previousLine.trim().length > 0) {
      const underline = setext[1];
      const level = underline.startsWith("=") ? 1 : 2;
      const text = previousLine.trim();
      // Heading line is the previous line
      headings.push({ level, text, line: i });
    }
    previousLine = line;
  }

  return headings;
}

/**
 * Extract links from Markdown content (excludes images by default).
 * Captures classic [text](url "title") and bare http(s) links.
 */
export function extractLinks(markdown: string): MarkdownLink[] {
  const links: MarkdownLink[] = [];
  const seen = new Set<string>();

  const lines = markdown.split(/\r?\n/);

  // 1) [text](url "title") — ignore images ![alt](url)
  const bracketRe = /!?\[([^\]]+)\]\(([^\s)]+)(?:\s+"([^"]*)")?\)/g;
  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    if (!line) continue;
    
    let m: RegExpExecArray | null;
    bracketRe.lastIndex = 0;
    while ((m = bracketRe.exec(line))) {
      const isImage = m[0]?.startsWith("!");
      if (isImage) continue;
      const text = m[1]?.trim();
      const url = m[2]?.trim();
      const title = m[3]?.trim();
      if (!url || seen.has(`b:${url}:${li}`)) continue;
      seen.add(`b:${url}:${li}`);
      links.push({ url, text, title, line: li + 1, internal: isInternal(url) });
    }
  }

  // 2) Bare/auto links <https://...>
  const angleRe = /<((?:https?:)?\/\/[\w\-._~:/?#\[\]@!$&'()*+,;=%]+)>/gi;
  let am: RegExpExecArray | null;
  angleRe.lastIndex = 0;
  while ((am = angleRe.exec(markdown))) {
    const url = am[1];
    if (url && !seen.has(`a:${url}`)) {
      seen.add(`a:${url}`);
      links.push({ url, internal: isInternal(url) });
    }
  }

  // 3) Plain http(s)://... words not already captured
  const bareRe = /\bhttps?:\/\/[\w\-._~:/?#\[\]@!$&'()*+,;=%]+/gi;
  let bm: RegExpExecArray | null;
  bareRe.lastIndex = 0;
  while ((bm = bareRe.exec(markdown))) {
    const url = bm[0];
    if (!seen.has(`p:${url}`)) {
      seen.add(`p:${url}`);
      links.push({ url, internal: isInternal(url) });
    }
  }

  return links;
}

/** Count words in Markdown, ignoring code blocks and markup as much as possible. */
export function countWords(markdown: string): number {
  const text = toPlainText(markdown);
  // Unicode letters/numbers, keep words like "don't" as 2 words
  const matches = text.match(/[\p{L}\p{N}]+/gu);
  return matches ? matches.length : 0;
}

/** Estimate Flesch Reading Ease score (0–100+, higher is easier). */
export function estimateReadingEase(markdown: string): number {
  const text = toPlainText(markdown);
  const words = getWords(text);
  const wordCount = words.length || 1;
  const sentenceCount = Math.max(1, countSentences(text));
  const syllableCount = words.reduce((sum, w) => sum + countSyllables(w), 0) || 1;

  // Flesch Reading Ease formula
  const score = 206.835 - 1.015 * (wordCount / sentenceCount) - 84.6 * (syllableCount / wordCount);
  // Clamp to a sensible range
  return Number.isFinite(score) ? Math.max(-100, Math.min(130, Number(score.toFixed(2)))) : 0;
}

// -----------------------------
// Internal helpers
// -----------------------------

function isInternal(url: string): boolean {
  const lower = url.trim().toLowerCase();
  return !(
    lower.startsWith("http://") ||
    lower.startsWith("https://") ||
    lower.startsWith("//") ||
    lower.startsWith("mailto:")
  );
}

function toPlainText(markdown: string): string {
  let txt = markdown;
  // Strip code fences
  txt = txt.replace(/```[\s\S]*?```/g, " ");
  // Strip inline code
  txt = txt.replace(/`[^`]*`/g, " ");
  // Replace links [text](url) -> text
  txt = txt.replace(/!?\[([^\]]+)\]\([^)]*\)/g, "$1");
  // Remove images that may have no alt text leftover
  txt = txt.replace(/!\[[^\]]*\]\([^)]*\)/g, " ");
  // Strip HTML tags
  txt = txt.replace(/<[^>]+>/g, " ");
  // Strip emphasis, strong, headings markers
  txt = txt.replace(/[#>*_~`]+/g, " ");
  // Normalize whitespace
  txt = txt.replace(/\s+/g, " ").trim();
  return txt;
}

function getWords(text: string): string[] {
  const m = text.match(/[\p{L}\p{N}]+/gu);
  return m ?? [];
}

function countSentences(text: string): number {
  // Count sentence enders . ! ? ; and newlines as weak separators
  const matches = text.match(/[.!?]+(?=\s|$)|\n{2,}/g);
  return matches ? matches.length : text.trim().length > 0 ? 1 : 0;
}

function countSyllables(wordRaw: string): number {
  const word = wordRaw.toLowerCase().replace(/[^a-z]/g, "");
  if (!word) return 0;

  // Very short words
  if (word.length <= 3) return 1;

  // Remove trailing silent 'e'
  const processed = word.replace(/e$/i, "");

  // Count vowel groups (aeiouy)
  const groups = processed.match(/[aeiouy]+/g);
  let count = groups ? groups.length : 0;

  // Add back syllable for words ending with 'le' (e.g., table, little)
  if (/[^aeiou]le$/.test(word)) count += 1;

  // Ensure at least one syllable
  return Math.max(1, count);
}

