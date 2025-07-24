# User Account Functionality Implementation Plan

## Overview

This plan outlines the implementation of user account functionality for the AI SEO Content Machine, integrating Clerk authentication with onboarding flow and AI-powered website analysis to automatically populate article settings.

## Current State Analysis

### Existing Infrastructure
- ✅ Clerk authentication already configured in environment variables
- ✅ Users table exists in database schema with onboarding fields
- ✅ PostgreSQL database with Drizzle ORM
- ✅ Next.js 14 App Router architecture
- ✅ Article settings system partially implemented

### Database Schema Review
Current `users` table includes:
```typescript
export const users = contentMachineSchema.table("users", {
  id: text("id").primaryKey().default(generatePublicId()),
  email: text("email").notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  company_name: text("company_name"),
  domain: text("domain"),
  product_description: text("product_description"),
  keywords: jsonb("keywords"),
  onboarding_completed: boolean("onboarding_completed").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
});
```

## Implementation Plan

### Phase 1: Clerk Integration & User Management

#### 1.1 Configure Clerk Authentication
- **Files to modify**: `src/lib/auth.ts`, `src/app/layout.tsx`
- **Dependencies**: `@clerk/nextjs`
- **Tasks**:
  - Set up ClerkProvider in root layout
  - Configure Clerk middleware for protected routes
  - Create authentication utilities

#### 1.2 User Data Synchronization
- **Files to create**: `src/app/api/webhooks/clerk/route.ts`
- **Files to modify**: `src/server/db/schema.ts`
- **Tasks**:
  - Set up Clerk webhook to sync user data
  - Update users table to include `clerk_user_id`
  - Create user creation/update logic
  - Handle user deletion scenarios

#### 1.3 Protected Route Setup
- **Files to modify**: `src/middleware.ts`
- **Tasks**:
  - Configure route protection using Clerk middleware
  - Redirect unauthenticated users to sign-in
  - Set up public routes (landing page, sign-in/up)

### Phase 2: Onboarding Flow Implementation

#### 2.1 Onboarding Page Structure
- **Files to create**:
  - `src/app/onboarding/page.tsx`
  - `src/app/onboarding/layout.tsx`
  - `src/components/onboarding/website-url-form.tsx`
  - `src/components/onboarding/onboarding-progress.tsx`
  - `src/components/onboarding/ai-analysis-preview.tsx`

#### 2.2 Multi-Step Onboarding Flow
**Step 1: Website URL Collection**
- URL input with validation
- Domain extraction and verification
- Basic website accessibility check

**Step 2: AI Website Analysis**
- Automated website scraping
- Content analysis for tone detection
- Keyword extraction
- Business/product description generation
- Loading states and progress indicators

**Step 3: Settings Review & Confirmation**
- Display AI-generated settings
- Allow manual adjustments
- Preview of how settings will be applied
- Final confirmation and account setup completion

#### 2.3 Onboarding API Endpoints
- **Files to create**:
  - `src/app/api/onboarding/analyze-website/route.ts`
  - `src/app/api/onboarding/complete/route.ts`
  - `src/app/api/onboarding/status/route.ts`

### Phase 3: AI Website Analysis System

#### 3.1 Website Scraping & Analysis
- **Files to create**:
  - `src/app/api/ai-analysis/scrape-website/route.ts`
  - `src/app/api/ai-analysis/extract-content/route.ts`
  - `src/app/api/ai-analysis/analyze-brand/route.ts`

#### 3.2 AI Analysis Components
**Content Extraction**:
- Homepage content scraping
- Key pages identification (about, services, products)
- Meta data extraction (title, description, keywords)

**Brand Analysis**:
- Tone of voice detection from website copy
- Industry/niche identification
- Target audience analysis
- Competitive landscape assessment

**SEO Foundation**:
- Existing keyword analysis
- Content gaps identification
- Internal linking opportunities
- Technical SEO baseline

#### 3.3 Settings Population Logic
- **Files to modify**: `src/server/db/schema.ts`
- **Files to create**: `src/app/api/settings/auto-populate/route.ts`
- **Tasks**:
  - Map AI analysis results to article settings
  - Create default article templates based on industry
  - Set up keyword prioritization system
  - Configure tone and style preferences

### Phase 4: User Context Integration

#### 4.1 User-Scoped Data Access
- **Files to modify**: All existing API routes
- **Tasks**:
  - Add user authentication checks to all endpoints
  - Implement user-scoped data filtering
  - Update articles table to include user_id foreign key
  - Modify kanban board to show user-specific articles

#### 4.2 User Settings Management
- **Files to create**:
  - `src/app/api/users/settings/route.ts`
  - `src/app/api/users/profile/route.ts`
  - `src/components/settings/user-profile-form.tsx`
- **Tasks**:
  - User profile management interface
  - Website URL update functionality
  - Re-analysis trigger for updated websites
  - Settings export/import capabilities

#### 4.3 Navigation & User Experience
- **Files to modify**:
  - `src/app/layout.tsx`
  - `src/components/ui/layout.tsx`
- **Files to create**:
  - `src/components/navigation/user-menu.tsx`
  - `src/components/navigation/main-nav.tsx`
- **Tasks**:
  - Add user menu with profile access
  - Implement sign-out functionality
  - Add onboarding completion checks
  - Create dashboard redirect logic

### Phase 5: Database Migrations & Schema Updates

#### 5.1 Schema Modifications
- **Files to modify**: `src/server/db/schema.ts`
- **Tasks**:
  - Add `clerk_user_id` to users table
  - Add `user_id` foreign key to articles table
  - Add `user_id` foreign key to article_settings table
  - Create indexes for performance optimization

#### 5.2 Migration Scripts
- **Files to create**: 
  - Migration files in `drizzle/` directory
  - Data migration scripts if needed
- **Tasks**:
  - Create database migration for new columns
  - Set up foreign key constraints
  - Update existing data if necessary

## Technical Implementation Details

### API Route Patterns (Following Architecture Guidelines)

#### Onboarding Website Analysis Route
```typescript
// src/app/api/onboarding/analyze-website/route.ts
export interface AnalyzeWebsiteRequest {
  websiteUrl: string;
  userId: string;
}

export interface AnalyzeWebsiteResponse {
  success: boolean;
  data: {
    domain: string;
    companyName: string;
    productDescription: string;
    toneOfVoice: string;
    suggestedKeywords: string[];
    industryCategory: string;
    targetAudience: string;
    contentStrategy: {
      articleStructure: string;
      maxWords: number;
      publishingFrequency: string;
    };
  };
  error?: string;
}

export async function POST(request: NextRequest) {
  // Authentication check
  const { userId } = auth();
  if (!userId) {
    return new Response('Unauthorized', { status: 401 });
  }

  const body: AnalyzeWebsiteRequest = await request.json();
  
  // Website scraping logic inline
  const websiteContent = await scrapeWebsite(body.websiteUrl);
  
  // AI analysis using Gemini for research + Claude for content analysis
  const aiAnalysis = await analyzeWebsiteContent(websiteContent);
  
  // Update user record directly
  await db.update(users)
    .set({
      domain: aiAnalysis.domain,
      company_name: aiAnalysis.companyName,
      product_description: aiAnalysis.productDescription,
      keywords: aiAnalysis.suggestedKeywords,
      updatedAt: new Date(),
    })
    .where(eq(users.clerk_user_id, userId));
  
  return Response.json({ success: true, data: aiAnalysis });
}
```

#### User Sync Webhook Route
```typescript
// src/app/api/webhooks/clerk/route.ts
export async function POST(request: NextRequest) {
  const payload = await request.json();
  const { type, data } = payload;

  switch (type) {
    case 'user.created':
      // Create user record inline
      await db.insert(users).values({
        clerk_user_id: data.id,
        email: data.email_addresses[0]?.email_address,
        firstName: data.first_name,
        lastName: data.last_name,
        onboarding_completed: false,
      });
      break;
      
    case 'user.updated':
      // Update user record inline
      await db.update(users)
        .set({
          email: data.email_addresses[0]?.email_address,
          firstName: data.first_name,
          lastName: data.last_name,
          updatedAt: new Date(),
        })
        .where(eq(users.clerk_user_id, data.id));
      break;
  }

  return Response.json({ success: true });
}
```

### Component Structure

#### Onboarding Flow Components
```typescript
// src/components/onboarding/website-url-form.tsx
interface WebsiteUrlFormProps {
  onSubmit: (url: string) => Promise<void>;
  isLoading: boolean;
}

// src/components/onboarding/ai-analysis-preview.tsx
interface AIAnalysisPreviewProps {
  analysisData: AnalyzeWebsiteResponse['data'];
  onConfirm: () => Promise<void>;
  onEdit: (field: string, value: any) => void;
}
```

### Authentication Flow

1. **User visits protected route** → Redirected to Clerk sign-in
2. **User completes sign-in** → Clerk creates user session
3. **Webhook triggers** → User record created in database
4. **User redirected to app** → Check onboarding status
5. **If not onboarded** → Redirect to `/onboarding`
6. **Complete onboarding** → Mark as complete, redirect to dashboard

### AI Analysis Pipeline

1. **URL Validation** → Verify website accessibility
2. **Content Scraping** → Extract homepage and key pages
3. **Content Analysis** → AI processes content for insights
4. **Settings Generation** → Map insights to article settings
5. **User Review** → Present findings for confirmation
6. **Database Update** → Save settings and mark onboarding complete

## Testing Strategy

### Unit Tests
- Authentication utilities
- Website scraping functions
- AI analysis logic
- Database operations

### Integration Tests
- Clerk webhook handling
- Complete onboarding flow
- User-scoped data access
- API endpoint authentication

### E2E Tests
- Full user registration and onboarding flow
- Settings population from website analysis
- User context switching

## Security Considerations

### Authentication
- All API routes require valid Clerk session
- User-scoped data access enforced at database level
- Webhook signature verification for Clerk events

### Data Protection
- User data encrypted at rest
- Website scraping respects robots.txt
- AI analysis data anonymized before external API calls
- PII handling compliance

### Rate Limiting
- Website analysis limited per user per day
- API endpoints rate limited by user
- Webhook endpoints protected against abuse

## Performance Considerations

### Database Optimization
- Indexes on user_id foreign keys
- Efficient queries for user-scoped data
- Connection pooling for concurrent users

### Caching Strategy
- Website analysis results cached for 24 hours
- User settings cached in session
- Static content CDN delivery

### Scalability
- Background job processing for AI analysis
- Horizontal scaling for API routes
- Database partitioning by user if needed

## Timeline Estimate

- **Phase 1 (Clerk Integration)**: 3-4 days
- **Phase 2 (Onboarding Flow)**: 5-6 days  
- **Phase 3 (AI Analysis System)**: 7-8 days
- **Phase 4 (User Context Integration)**: 4-5 days
- **Phase 5 (Database Migrations)**: 2-3 days

**Total Estimated Time**: 21-26 days

## Success Metrics

### User Experience
- Onboarding completion rate > 85%
- Time to complete onboarding < 5 minutes
- AI settings accuracy rated > 4/5 by users

### Technical Performance  
- Website analysis completion < 30 seconds
- API response times < 500ms
- Zero authentication-related security incidents

### Business Impact
- User activation rate improvement
- Reduced time to first article generation
- Increased user retention after onboarding

## Dependencies & Prerequisites

### External Services
- Clerk authentication service (already configured)
- AI services (Gemini, Claude) for website analysis
- Web scraping service or library

### Internal Dependencies
- Existing database schema and migrations system
- Current article generation pipeline
- Kanban board system

### Environment Variables to Add
```bash
# Additional Clerk configuration
CLERK_WEBHOOK_SECRET="your_webhook_secret_here"

# AI services for website analysis
WEBSITE_ANALYSIS_AI_API_KEY="your_ai_api_key_here"
```

## Risk Mitigation

### Technical Risks
- **Website scraping failures**: Implement fallback manual input options
- **AI analysis inaccuracy**: Allow full manual override of all settings
- **Performance issues**: Implement background processing and caching

### User Experience Risks
- **Complex onboarding**: Provide skip options and progressive disclosure
- **AI suggestions rejection**: Make all suggestions editable
- **Technical barriers**: Provide clear error messages and support

### Business Risks
- **User drop-off**: A/B test onboarding flow variations
- **Scalability concerns**: Monitor usage patterns and optimize accordingly
- **Security vulnerabilities**: Regular security audits and penetration testing

This plan provides a comprehensive roadmap for implementing user account functionality while maintaining the existing architecture principles and ensuring a smooth user experience from sign-up through productive use of the AI SEO Content Machine.
