import type { articles } from "@/server/db/schema";

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

  const raw = JSON.stringify(blogPosting, null, 2);
  return { blogPosting, raw };
}
