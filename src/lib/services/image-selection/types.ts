export interface ImageSearchRequest {
  query: string;
  keywords?: string[];
  orientation?: "landscape" | "portrait" | "squarish";
  color?:
    | "black_and_white"
    | "black"
    | "white"
    | "yellow"
    | "orange"
    | "red"
    | "purple"
    | "magenta"
    | "green"
    | "teal"
    | "blue";
  contentFilter?: "low" | "high";
  count?: number;
  excludeIds?: string[];
  aiEnhance?: boolean;
}

export interface UnsplashImage {
  id: string;
  description: string | null;
  altDescription: string | null;
  urls: {
    raw: string;
    full: string;
    regular: string;
    small: string;
    thumb: string;
  };
  width: number;
  height: number;
  color: string;
  blurHash: string;
  likes: number;
  downloads?: number;
  user: {
    id: string;
    username: string;
    name: string;
    portfolioUrl: string | null;
    profileImage: {
      small: string;
      medium: string;
      large: string;
    };
  };
  links: {
    self: string;
    html: string;
    download: string;
    downloadLocation: string;
  };
  relevanceScore: number;
  source: "unsplash";
}

export interface PexelsImage {
  id: number;
  description: string | null;
  altDescription: string | null;
  urls: {
    raw: string;
    full: string;
    regular: string;
    small: string;
    thumb: string;
  };
  width: number;
  height: number;
  color: string;
  blurHash?: string;
  likes?: number;
  downloads?: number;
  user: {
    id: number;
    username: string;
    name: string;
    portfolioUrl: string | null;
    profileImage: {
      small: string;
      medium: string;
      large: string;
    };
  };
  links: {
    self: string;
    html: string;
    download: string;
    downloadLocation: string;
  };
  relevanceScore: number;
  source: "pexels";
}

export type CombinedImage = UnsplashImage | PexelsImage;

export interface ImageSearchResponse {
  success: boolean;
  data: {
    images: CombinedImage[];
    selectedImage?: CombinedImage;
    totalResults: number;
    searchQuery: string;
    attribution?: {
      photographer: string;
      sourceUrl: string;
      downloadUrl: string;
    };
    aiQueries?: string[];
    aiUsed?: boolean;
  };
  metadata: {
    searchTerms: string[];
    processingTime: number;
    apiCallsUsed: number;
    ranking: "algorithm" | "hybrid-ai";
    sources: {
      unsplash: number;
      pexels: number;
    };
  };
}

export interface ArticleImageSelectionRequest {
  articleId: number;
  generationId: number;
  title: string;
  keywords: string[];
  orientation?: "landscape" | "portrait" | "squarish";
  userId: string;
  projectId: number;
}

export interface ArticleImageSelectionResponse {
  success: boolean;
  data: {
    coverImageUrl: string;
    coverImageAlt?: string;
    attribution: {
      photographer: string;
      unsplashUrl: string;
      downloadUrl: string;
    };
    unsplashImageId: string;
  };
}
