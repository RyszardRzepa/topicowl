"use client";

import { usePathname } from "next/navigation";
import { useMemo, useState, useEffect } from "react";

interface BreadcrumbItem {
  label: string;
  href?: string;
  current?: boolean;
}

interface ArticleResponse {
  data?: {
    title?: string;
  };
}

export function useBreadcrumbs(): BreadcrumbItem[] {
  const pathname = usePathname();
  const [articleTitle, setArticleTitle] = useState<string | null>(null);

  // Extract article ID from path if present
  const articleId = useMemo(() => {
    const segments = pathname.split("/").filter(Boolean);
    if (
      segments.length === 3 &&
      segments[0] === "dashboard" &&
      segments[1] === "articles"
    ) {
      return segments[2];
    }
    return null;
  }, [pathname]);

  // Fetch article title when on article detail page
  useEffect(() => {
    if (articleId) {
      const fetchArticleTitle = async () => {
        try {
          const response = await fetch(`/api/articles/${articleId}`);
          if (response.ok) {
            const data = (await response.json()) as ArticleResponse;
            const title = data.data?.title;
            setArticleTitle(
              typeof title === "string" ? title : `Article ${articleId}`,
            );
          } else {
            setArticleTitle(`Article ${articleId}`);
          }
        } catch (error) {
          console.error("Failed to fetch article title:", error);
          setArticleTitle(`Article ${articleId}`);
        }
      };

      void fetchArticleTitle();
    } else {
      setArticleTitle(null);
    }
  }, [articleId]);

  return useMemo(() => {
    const segments = pathname.split("/").filter(Boolean);
    const breadcrumbs: BreadcrumbItem[] = [];

    // Only show breadcrumbs for dashboard sub-routes, not the dashboard root
    if (segments.length > 1 && segments[0] === "dashboard") {
      const section = segments[1];

      if (section) {
        switch (section) {
          case "articles":
            breadcrumbs.push({
              label: "Articles",
              href: "/dashboard/articles",
              current: segments.length === 2,
            });

            // Handle article detail page
            if (segments.length === 3) {
              breadcrumbs.push({
                label: articleTitle ?? `Article ${segments[2] ?? ""}`,
                current: true,
              });
            }
            break;

          case "reddit":
            breadcrumbs.push({
              label: "Reddit",
              href: "/dashboard/reddit",
              current: true,
            });
            break;

          default:
            // For any other sections, use the segment name
            const formattedLabel =
              section.charAt(0).toUpperCase() + section.slice(1);
            breadcrumbs.push({
              label: formattedLabel,
              current: true,
            });
        }
      }
    }

    return breadcrumbs;
  }, [pathname, articleTitle]);
}
