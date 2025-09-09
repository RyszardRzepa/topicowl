import type { articles } from "@/server/db/schema";

function extractFaq(markdown: string): Array<{ q: string; a: string }> {
  const lines = markdown.split(/\r?\n/);
  const idx = lines.findIndex((l) => /^\s*##\s*(FAQ|Frequently Asked Questions)\s*$/i.test(l));
  if (idx === -1) return [];
  const end = (() => {
    for (let i = idx + 1; i < lines.length; i++) {
      if (/^\s*##\s+/.test(lines[i])) return i;
    }
    return lines.length;
  })();
  const block = lines.slice(idx + 1, end);
  const qas: Array<{ q: string; a: string }> = [];
  let currentQ = "";
  let currentA: string[] = [];
  for (const l of block) {
    const qm = /^\s*####\s+(.+)$/.exec(l);
    if (qm) {
      if (currentQ) qas.push({ q: currentQ, a: currentA.join("\n").trim() });
      currentQ = qm[1].trim();
      currentA = [];
      continue;
    }
    if (currentQ) currentA.push(l);
  }
  if (currentQ) qas.push({ q: currentQ, a: currentA.join("\n").trim() });
  return qas.filter((qa) => qa.q.length > 0 && qa.a.length > 0);
}

interface Params {
  article: typeof articles.$inferSelect;
  markdown: string;
}

export async function generateJsonLd({
  article,
  markdown,
}: Params): Promise<{ blogPosting: object; faqPage?: object; raw: string }> {
  const blogPosting = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: article.title,
    description: article.metaDescription || article.description || "",
    datePublished: article.publishedAt || new Date().toISOString(),
    wordCount: markdown.split(/\s+/).length,
  };

  const qas = extractFaq(markdown);
  let faqPage: object | undefined = undefined;
  if (qas.length > 0) {
    faqPage = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: qas.map((qa) => ({
        "@type": "Question",
        name: qa.q,
        acceptedAnswer: {
          "@type": "Answer",
          text: qa.a,
        },
      })),
    };
  }

  const raw = JSON.stringify(faqPage ? [blogPosting, faqPage] : [blogPosting], null, 2);
  return { blogPosting, faqPage, raw };
}
