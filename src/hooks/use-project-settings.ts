"use client";

import { useProjectData } from "./use-project-data";

interface ProjectSettings {
  id: number;
  name: string;
  description?: string;
  companyName?: string;
  domain?: string;
  productDescription?: string;
  keywords?: unknown;
  webhookUrl?: string;
  webhookSecret?: string;
  // Add other settings fields
}

export function useProjectSettings() {
  return useProjectData<ProjectSettings>({
    endpoint: (projectId) => `/api/projects/${projectId}/settings`,
    refetchOnProjectChange: true,
  });
}
