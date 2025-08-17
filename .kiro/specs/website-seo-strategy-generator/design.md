# Design Document

## Overview

The SEO Cluster Map is a lead generation tool that converts user-provided website URLs into comprehensive topic cluster SEO content strategies. The tool leverages Google Gemini's URL context capabilities through the Vercel AI SDK to analyze website content directly, then generates actionable SEO recommendations based on the proven pillar-cluster methodology.

**What is Topic Cluster Strategy?**
Topic clusters are a content marketing approach where you create one comprehensive "pillar" article covering a broad topic, supported by multiple "cluster" articles that dive deep into specific subtopics. All cluster articles link back to the pillar, creating a content hub that dominates search results for that topic area.

**Example: Oslo Travel Site**

- **Pillar**: "The Complete Guide to Things to Do in Oslo (2025 Edition)"
- **Clusters**: "Best coffee shops in Oslo", "Must-see museums in Oslo", "Best hikes near Oslo"
- **Result**: Dominates "Oslo travel" keyword space through breadth + depth

This approach works for both traditional Google SEO and AI-powered search tools like Perplexity and ChatGPT, positioning your site as the authoritative source.

## Architecture

### High-Level Flow

1. **URL Input** → User provides website URL through simple form interface
2. **Content Analysis** → Gemini 2.5 Flash with URL context tool analyzes the website content
3. **Strategy Generation** → AI generates topic pillar and cluster recommendations
4. **Report Display** → User receives formatted SEO strategy report

### Technology Stack

- **Frontend**: Next.js 15 with React 19 (existing app structure)
- **AI Processing**: Vercel AI SDK with Google Gemini 2.5 Flash
- **URL Analysis**: Google's `urlContext` tool (no traditional scraping needed)
- **Authentication**: None required (public tool)
- **Rate Limiting**: IP-based throttling for abuse prevention
- **Database**: Optional analytics tracking only
- **Styling**: Existing Tailwind CSS setup

## Components and Interfaces

### 1. API Route Structure

```
src/app/api/tools/seo-cluster-map/
├── analyze/route.ts          # Main analysis endpoint
└── generate/route.ts         # Strategy generation endpoint
```

### 2. Frontend Components

```
src/components/tools/seo-cluster-map/
├── url-input-form.tsx        # URL input and validation
├── analysis-progress.tsx     # Processing status display
├── strategy-report.tsx       # Generated strategy display
├── signup-cta.tsx           # Call-to-action for Topicowl signup
└── strategy-export.tsx       # Copy functionality (no download)
```

### 3. Page Structure

```
src/app/tools/seo-cluster-map/
└── page.tsx                  # Main SEO cluster map tool page
```

### 4. Core Implementation

#### API Route Implementation (`/api/tools/seo-cluster-map/analyze/route.ts`)

```typescript
import { google } from "@ai-sdk/google";
import { generateText } from "ai";
import { checkRateLimit } from "@vercel/firewall";
import { MODELS } from "@/src/constants";

export async function POST(request: Request) {
  // Check rate limit using Vercel's built-in firewall
  const { rateLimited } = await checkRateLimit('seo-cluster-map-public');
  if (rateLimited) {
    return Response.json(
      { 
        error: 'Rate limit exceeded. You can analyze 3 websites per hour. Sign up for unlimited access!',
        rateLimited: true 
      },
      { status: 429 }
    );
  }

  const { url } = await request.json();

  const { text, sources, providerMetadata } = await generateText({
    model: google(MODELS.GEMINI_2_5_FLASH),
    tools: {
      url_context: google.tools.urlContext({}),
    },
    system: `You are an SEO strategy expert specializing in topic cluster methodology. Analyze the provided website content and generate a comprehensive topic pillar SEO strategy following these specific principles:

TOPIC CLUSTER METHODOLOGY:
1. PILLAR TOPIC (The Hub): Identify ONE main pillar keyword that is:
   - High search volume (broad intent keyword)
   - Covers multiple subtopics naturally
   - Business-relevant to the website's core offering
   - Example: "things to do in Oslo" for a travel site

2. CLUSTER ARTICLES (Supporting Posts): Create 8-12 cluster topics that:
   - Go deep on specific slices of the pillar topic
   - Each targets a more specific long-tail keyword
   - Categories like: Food & Drink, Culture & Attractions, Nature & Outdoors, Local Life & Hidden Gems, Practical Guides
   - Example clusters for Oslo: "Best coffee shops in Oslo", "Must-see museums in Oslo", "Best hikes near Oslo"

3. LINKING STRUCTURE:
   - Pillar links OUT to each cluster article
   - Each cluster links BACK to pillar with anchor text like "For the complete guide, see our [pillar topic]"
   - Clusters link sideways to related clusters
   - Creates a content hub that dominates the topic space

4. WHY THIS WORKS:
   - Google SEO: Shows breadth + depth, dominates keyword space
   - AI SEO: Becomes authority hub for AI overviews and citations
   - User flow: Visitors explore between pillar and clusters, increasing time on site

FORMAT: Structure as a detailed strategy report with pillar recommendation, categorized clusters, and linking strategy.`,
    prompt: `Analyze this website: ${url}
    
    Based on the website content, create a topic cluster SEO strategy following this structure:

    🎯 PILLAR TOPIC (The Hub):
    - Identify the ONE main keyword that meets: high search volume + broad intent + business relevance
    - Suggest pillar article title (e.g., "The Complete Guide to [Topic] (2025 Edition)")
    - Explain why this keyword dominates the topic space
    
    🗂 CLUSTER ARTICLES (Supporting Posts):
    Organize 8-12 cluster topics by categories such as:
    - [Category 1]: 2-3 specific cluster topics
    - [Category 2]: 2-3 specific cluster topics  
    - [Category 3]: 2-3 specific cluster topics
    - [Category 4]: 2-3 specific cluster topics
    
    Each cluster should:
    - Target a specific long-tail keyword
    - Go deep on one slice of the pillar
    - Be linkable back to the main pillar
    
    🔗 LINKING STRUCTURE:
    - How pillar links out to clusters
    - How clusters link back to pillar (with anchor text examples)
    - Cross-cluster linking opportunities
    
    📈 STRATEGIC VALUE:
    - Why this approach dominates Google SEO
    - How it positions for AI search citations
    - Expected user flow and engagement benefits`,
  });

  return Response.json({
    strategy: text,
    sources,
    metadata: providerMetadata?.google,
  });
}
```

#### URL Input Form Component

```typescript
'use client';

import { useState } from 'react';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';

export function UrlInputForm({ onAnalyze }: { onAnalyze: (url: string) => void }) {
  const [url, setUrl] = useState('');
  const [isValidUrl, setIsValidUrl] = useState(false);

  const validateUrl = (input: string) => {
    try {
      new URL(input);
      setIsValidUrl(true);
    } catch {
      setIsValidUrl(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isValidUrl) {
      onAnalyze(url);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Input
          type="url"
          placeholder="https://example.com"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            validateUrl(e.target.value);
          }}
          className="w-full"
        />
      </div>
      <Button
        type="submit"
        disabled={!isValidUrl}
        className="w-full"
      >
        Generate SEO Strategy
      </Button>
    </form>
  );
}
```

## Data Models

### SEO Strategy Response Type

```typescript
interface SEOStrategyResponse {
  strategy: string;
  sources?: Array<{
    id: string;
    url: string;
    title?: string;
  }>;
  metadata?: {
    groundingMetadata?: any;
    urlContextMetadata?: any;
  };
}

interface PillarStrategy {
  pillarTopic: {
    keyword: string;
    title: string;
    description: string;
    targetAudience: string;
  };
  clusterTopics: Array<{
    category: string;
    title: string;
    keyword: string;
    contentType: "guide" | "comparison" | "how-to" | "listicle" | "case-study";
    priority: "high" | "medium" | "low";
  }>;
  linkingStrategy: {
    pillarToCluster: string[];
    clusterToPillar: string[];
    crossCluster: string[];
  };
  seasonalOpportunities: Array<{
    season: string;
    topics: string[];
  }>;
}
```

### Database Schema Extension

```sql
-- Add to existing schema if we want to store strategies
CREATE TABLE IF NOT EXISTS contentbot.seo_strategies (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  project_id INTEGER REFERENCES contentbot.projects(id),
  website_url TEXT NOT NULL,
  pillar_keyword VARCHAR(255),
  strategy_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Error Handling

### URL Validation

- Client-side URL format validation
- Server-side URL accessibility checks
- Graceful handling of inaccessible websites

### AI Processing Errors

- Retry logic for API failures (up to 3 attempts)
- Timeout handling for long-running requests
- Fallback error messages for users

### Rate Limiting

- Integrate with existing credit system
- Prevent abuse with request throttling
- Clear error messages for quota exceeded

## Testing Strategy

### Unit Tests

- URL validation logic
- Strategy parsing and formatting
- Error handling scenarios

### Integration Tests

- API route functionality
- Gemini URL context tool integration
- Database operations (if storing strategies)

### User Acceptance Tests

- End-to-end workflow testing
- Strategy quality validation
- Performance under various website types

## Implementation Phases

### Phase 1: Core Functionality

- Basic URL input form
- Gemini integration with URL context
- Simple strategy display
- Error handling

### Phase 2: Enhanced Features

- Strategy export/download
- Integration with existing dashboard
- Credit system integration
- Progress indicators

### Phase 3: Optimization

- Strategy storage and history
- Advanced formatting options
- Performance optimizations
- Analytics tracking

## Security Considerations

### Input Validation

- Strict URL format validation
- Prevent malicious URL injection
- Rate limiting per user/IP

### API Security

- Existing authentication integration
- Secure API key management
- Request sanitization

### Data Privacy

- No storage of website content
- Optional strategy storage with user consent
- Compliance with existing privacy policies

## Performance Considerations

### Response Times

- Target: < 30 seconds for strategy generation
- Progress indicators for user feedback
- Timeout handling after 60 seconds

### Scalability

- Leverage existing infrastructure
- Queue-based processing for high load
- Caching for repeated URL analyses

### Resource Usage

- Efficient prompt engineering to minimize tokens
- Optimal model selection (Gemini 2.5 Flash for speed)
- Credit-based usage tracking

## Integration Points

### Existing Systems

- **Authentication**: Clerk user management
- **Database**: PostgreSQL with Drizzle ORM
- **UI Components**: Existing component library
- **Navigation**: Dashboard integration
- **Credits**: Existing credit system

### External Dependencies

- **Vercel AI SDK**: Core AI functionality
- **Google Gemini**: URL analysis and strategy generation
- **Existing API patterns**: Follow established conventions
