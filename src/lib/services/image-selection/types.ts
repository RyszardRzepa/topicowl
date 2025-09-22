export interface ImageSearchRequest {
  query: string;
  keywords?: string[];
  orientation?: "landscape" | "portrait" | "squarish";
  limit?: number;
  aiSelect?: boolean;
}

export interface UnsplashApiImage {
  id: string;
  description: string | null;
  alt_description: string | null;
  urls: {
    raw: string;
    full: string;
    regular: string;
    small: string;
    thumb: string;
  };
  width: number;
  height: number;
  color: string | null;
  blur_hash: string | null;
  likes?: number;
  downloads?: number;
  user: {
    id: string;
    username: string;
    name: string;
    portfolio_url: string | null;
    profile_image?: {
      small: string;
      medium: string;
      large: string;
    };
  };
  links: {
    self: string;
    html: string;
    download: string;
    download_location: string;
  };
}

export interface PexelsApiImage {
  id: number;
  alt?: string | null;
  url: string;
  photographer: string;
  photographer_url: string | null;
  photographer_id: number;
  avg_color?: string | null;
  width: number;
  height: number;
  src: {
    original: string;
    large2x?: string;
    large?: string;
    medium?: string;
    small?: string;
    portrait?: string;
    landscape?: string;
    tiny?: string;
  };
}

export interface ImageSummary {
  id: string;
  provider: "unsplash" | "pexels";
  url: string;
  previewUrl: string;
  alt: string;
  width: number;
  height: number;
  author: {
    name: string;
    profileUrl?: string;
  };
}

export interface ImageSearchResponse {
  success: boolean;
  images?: ImageSummary[];
  selected?: ImageSummary;
  error?: string;
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
  data?: {
    coverImageUrl: string;
    coverImageAlt: string;
    width: number;
    height: number;
    author: {
      name: string;
      profileUrl?: string;
    };
  };
  error?: string;
}
