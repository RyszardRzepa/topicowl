"use client";

import { useProjectData } from "./use-project-data";

interface Article {
  id: number;
  title: string;
  content: string;
  slug: string;
  status: string;
  projectId: number;
  createdAt: Date;
  updatedAt: Date;
  // Add other article fields as needed
}

export function useProjectArticles() {
  return useProjectData<Article[]>({
    endpoint: (projectId) => `/api/articles?projectId=${projectId}`,
    refetchOnProjectChange: true,
  });
}
