export interface ResearchResponse {
  researchData: string;
  sources: Array<{
    url: string;
    title?: string;
  }>;
}

export interface WriteRequest {
  researchData: ResearchResponse;
  title: string;
  keywords: string[];
  author?: string;
  publicationName?: string;
  coverImage?: string;
  videos?: Array<{
    title: string;
    url: string;
  }>;
  screenshots?: Array<{
    url: string;
    alt?: string;
    sectionHeading?: string;
    placement?: "start" | "middle" | "end";
  }>;
  sources?: Array<{
    url: string;
    title?: string;
  }>;
  notes?: string;
  outlineMarkdown?: string;
  userId: string;
  projectId: number;
  relatedArticles?: string[];
  generationId?: number;
}

export interface WriteResponse {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  metaDescription: string;
  introParagraph: string;
  readingTime: string;
  content: string;
  author: string;
  date: string;
  coverImage?: string;
  imageCaption?: string;
  tags?: string[];
  relatedPosts?: string[];
  videos?: Array<{
    title: string;
    url: string;
    sectionHeading: string;
    contextMatch: string;
  }>;
  hasVideoIntegration?: boolean;
}
