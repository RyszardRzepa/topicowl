/**
 * Blog sitemap utilities for managing internal linking and related posts
 */

// Mock blog slugs for now - in a real implementation, this would fetch from the database
const MOCK_BLOG_SLUGS = [
  'getting-started-with-seo',
  'content-marketing-best-practices',
  'keyword-research-strategies',
  'on-page-optimization-guide',
  'link-building-techniques',
  'technical-seo-basics',
  'local-seo-optimization',
  'mobile-seo-checklist',
  'seo-analytics-tracking',
  'content-optimization-tips'
];

/**
 * Get all available blog slugs
 * In a real implementation, this would query the database
 */
export async function getBlogSlugs(): Promise<string[]> {
  // Simulate async database call
  return Promise.resolve(MOCK_BLOG_SLUGS);
}

/**
 * Get related posts based on keywords and content similarity
 */
export function getRelatedPosts(
  availableSlugs: string[],
  keywords: string[],
  currentSlug?: string,
  maxResults: number = 3
): string[] {
  if (!availableSlugs.length || !keywords.length) {
    return [];
  }

  // Filter out current slug if provided
  const filteredSlugs = currentSlug 
    ? availableSlugs.filter(slug => slug !== currentSlug)
    : availableSlugs;

  // Simple keyword matching algorithm
  const scoredSlugs = filteredSlugs.map(slug => {
    let score = 0;
    const slugWords = slug.toLowerCase().split('-');
    
    keywords.forEach(keyword => {
      const keywordWords = keyword.toLowerCase().split(' ');
      keywordWords.forEach(word => {
        if (slugWords.some(slugWord => slugWord.includes(word) || word.includes(slugWord))) {
          score += 1;
        }
      });
    });
    
    return { slug, score };
  });

  // Sort by score and return top results
  return scoredSlugs
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults)
    .map(item => item.slug);
}

/**
 * Generate internal link suggestions for article content
 */
export function generateInternalLinkSuggestions(
  content: string,
  availableSlugs: string[],
  maxSuggestions: number = 5
): Array<{ anchor: string; slug: string; context: string }> {
  const suggestions: Array<{ anchor: string; slug: string; context: string }> = [];
  
  availableSlugs.forEach(slug => {
    const slugWords = slug.split('-');
    
    // Look for potential anchor text in the content
    slugWords.forEach(word => {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      const matches = content.match(regex);
      
      if (matches && matches.length > 0) {
        // Find context around the match
        const wordIndex = content.toLowerCase().indexOf(word.toLowerCase());
        if (wordIndex !== -1) {
          const contextStart = Math.max(0, wordIndex - 50);
          const contextEnd = Math.min(content.length, wordIndex + word.length + 50);
          const context = content.substring(contextStart, contextEnd).trim();
          
          suggestions.push({
            anchor: word,
            slug,
            context: `...${context}...`
          });
        }
      }
    });
  });

  // Return unique suggestions, prioritizing by relevance
  const uniqueSuggestions = suggestions.filter((suggestion, index, array) => 
    array.findIndex(s => s.slug === suggestion.slug) === index
  );

  return uniqueSuggestions.slice(0, maxSuggestions);
}

/**
 * Build sitemap structure for navigation and SEO
 */
export interface SitemapEntry {
  slug: string;
  title: string;
  lastModified: Date;
  priority: number;
  changeFreq: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
}

export async function buildSitemap(): Promise<SitemapEntry[]> {
  const slugs = await getBlogSlugs();
  
  return slugs.map(slug => ({
    slug,
    title: slug.split('-').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' '),
    lastModified: new Date(),
    priority: 0.8,
    changeFreq: 'weekly' as const
  }));
}