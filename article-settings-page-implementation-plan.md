# Article Settings Page Implementation Plan

## Overview

This document outlines the implementation plan for creating a user-facing article settings page that allows users to configure global article generation settings. These settings will be stored in the database and automatically used by all article generation APIs.

## Current State Analysis

### Existing Article Generation APIs
Based on my analysis, the following APIs are involved in article generation:

1. **Article Management APIs** (`/src/app/api/articles/`)
   - `[id]/generate/route.ts` - Triggers article generation for a specific article
   - `[id]/generation-status/route.ts` - Checks generation status
   - `[id]/schedule/route.ts` - Schedules article publishing
   - `schedule-generation/route.ts` - Bulk scheduling

2. **AI SEO Writer APIs** (`/src/app/api/ai-seo-writer/`)
   - `research/route.ts` - Conducts research for articles
   - `write/route.ts` - Writes article content using AI
   - `validate/route.ts` - Validates article content
   - `update/route.ts` - Updates articles with corrections
   - `schedule/route.ts` - Schedules content generation

### Current Article Settings Integration

The system already has an `articleSettings` table in the database schema with the following fields:
- `id` (serial, primary key)
- `toneOfVoice` (text) - Controls writing style
- `articleStructure` (text) - Defines article format/structure
- `maxWords` (integer, default: 800) - Word count limit
- `createdAt` / `updatedAt` timestamps

The `writingService` already fetches these settings and uses them in content generation:
```typescript
// From writing-service.ts line 45
const settings = await db.select().from(articleSettings).limit(1);
```

## Implementation Plan

### Phase 1: Backend API Development

#### 1.1 Create Article Settings API Endpoints

**File: `/src/app/api/settings/route.ts`**
- `GET` - Retrieve current article settings
- `POST` - Create/update article settings (upsert pattern)

**File: `/src/app/api/settings/[id]/route.ts`**
- `PUT` - Update specific settings
- `DELETE` - Reset to default settings

#### 1.2 Enhance Database Schema (if needed)

**Current schema is sufficient but consider adding:**
- `userId` field to support per-user settings (if multi-tenant)
- Additional fields like `seoFocus`, `targetAudience`, `contentFormat`
- Default settings seeding in migrations

### Phase 2: Frontend Page Development

#### 2.1 Create Article Settings Page

**File: `/src/app/settings/page.tsx`**
- Main settings page with form components
- Real-time form validation
- Settings preview functionality

#### 2.2 Create Settings Components

**File: `/src/components/settings/article-settings-form.tsx`**
- Form components for each setting type
- Input validation and error handling
- Save/reset functionality

**File: `/src/components/settings/settings-preview.tsx`**
- Preview component showing how settings affect content
- Sample article generation with current settings

#### 2.3 Create Settings Service

**File: `/src/lib/services/settings-service.ts`**
- Client-side service for settings API calls
- Caching and state management
- Settings validation logic

### Phase 3: Integration Updates

#### 3.1 Update Existing Services

**Update `/src/lib/services/writing-service.ts`:**
- Enhance settings fetching with error handling
- Add more granular settings usage
- Cache settings to reduce DB queries

**Update `/src/lib/services/article-generation-service.ts`:**
- Integrate settings into generation pipeline
- Pass settings to all sub-services
- Add settings validation before generation

#### 3.2 Update Article Generation APIs

**Update all generation endpoints to:**
- Validate settings before processing
- Log settings usage for debugging
- Handle settings errors gracefully

### Phase 4: UI/UX Enhancements

#### 4.1 Navigation Integration

**Update main navigation:**
- Add "Settings" link to main menu
- Add settings icon to header/sidebar
- Breadcrumb navigation for settings page

#### 4.2 Settings Access from Kanban Board

**Update `/src/components/kanban/kanban-board.tsx`:**
- Add "Settings" button to kanban header
- Quick access to article settings
- Settings indicator showing current configuration

### Phase 5: Advanced Features

#### 5.1 Settings Templates

- Predefined settings templates (Blog, News, Technical, etc.)
- Template import/export functionality
- Custom template creation

#### 5.2 Settings History and Versioning

- Track settings changes over time
- Ability to revert to previous settings
- Settings change impact on existing articles

## Detailed Implementation

### Database Schema Enhancements

```sql
-- Optional: Add user-specific settings
ALTER TABLE "content-machine"."article_settings" 
ADD COLUMN user_id TEXT,
ADD COLUMN is_default BOOLEAN DEFAULT false,
ADD COLUMN template_name TEXT,
ADD COLUMN seo_focus TEXT,
ADD COLUMN target_audience TEXT,
ADD COLUMN content_format TEXT;

-- Create index for performance
CREATE INDEX idx_article_settings_user_id ON "content-machine"."article_settings"(user_id);
```

### API Endpoints Specification

#### GET /api/settings
**Response:**
```json
{
  "id": 1,
  "toneOfVoice": "professional",
  "articleStructure": "introduction-body-conclusion",
  "maxWords": 800,
  "seoFocus": "keyword-density",
  "targetAudience": "general",
  "contentFormat": "blog-post"
}
```

#### POST /api/settings
**Request Body:**
```json
{
  "toneOfVoice": "professional",
  "articleStructure": "introduction-body-conclusion",
  "maxWords": 1200,
  "seoFocus": "semantic-seo",
  "targetAudience": "technical",
  "contentFormat": "how-to-guide"
}
```

### Frontend Form Structure

```typescript
interface ArticleSettingsForm {
  toneOfVoice: 'casual' | 'professional' | 'authoritative' | 'friendly';
  articleStructure: 'introduction-body-conclusion' | 'problem-solution' | 'how-to' | 'listicle';
  maxWords: number; // 400-3000 range
  seoFocus: 'keyword-density' | 'semantic-seo' | 'user-intent' | 'readability';
  targetAudience: 'general' | 'technical' | 'beginner' | 'expert';
  contentFormat: 'blog-post' | 'news-article' | 'how-to-guide' | 'review';
}
```

### Integration Points with Existing Services

#### Research Service Integration
```typescript
// Update research-service.ts to use settings
const settings = await getArticleSettings();
const researchDepth = settings.seoFocus === 'semantic-seo' ? 'deep' : 'standard';
```

#### Writing Service Integration
```typescript
// Enhanced writing-service.ts integration
const prompt = generatePrompt({
  ...request,
  settings: {
    tone: settings.toneOfVoice,
    structure: settings.articleStructure,
    maxWords: settings.maxWords,
    audience: settings.targetAudience
  }
});
```

## File Structure

```
src/
├── app/
│   ├── settings/
│   │   ├── page.tsx              # Main settings page
│   │   └── loading.tsx           # Loading state
│   └── api/
│       └── settings/
│           ├── route.ts          # GET/POST settings
│           └── [id]/
│               └── route.ts      # PUT/DELETE specific setting
├── components/
│   └── settings/
│       ├── article-settings-form.tsx
│       ├── settings-preview.tsx
│       ├── settings-templates.tsx
│       └── settings-navigation.tsx
└── lib/
    └── services/
        └── settings-service.ts   # Settings API client
```

## Testing Strategy

### Unit Tests
- Settings form validation
- API endpoint testing
- Settings service functionality

### Integration Tests
- Settings impact on article generation
- End-to-end settings flow
- Database operations

### User Testing
- Settings page usability
- Article quality with different settings
- Performance impact assessment

## Deployment Considerations

### Database Migration
- Run migration to add new fields
- Seed default settings for existing users
- Backup current settings before deployment

### Feature Flags
- Gradual rollout of settings page
- A/B testing for settings impact
- Rollback capability

### Monitoring
- Track settings usage analytics
- Monitor article generation performance
- Alert on settings-related errors

## Success Metrics

### User Engagement
- Settings page usage frequency
- Time spent configuring settings
- Settings change frequency

### Content Quality
- Article generation success rate with custom settings
- User satisfaction with generated content
- SEO performance improvement

### Technical Performance
- API response times
- Database query performance
- Article generation speed

## Timeline

### Week 1: Backend Development
- Create settings API endpoints
- Update database schema
- Test API functionality

### Week 2: Frontend Development
- Build settings page UI
- Create form components
- Implement client-side validation

### Week 3: Integration
- Update existing services
- Test end-to-end functionality
- Performance optimization

### Week 4: Testing & Deployment
- Comprehensive testing
- Documentation updates
- Production deployment

## Risk Mitigation

### Technical Risks
- **Database performance**: Index optimization, query caching
- **API reliability**: Error handling, fallback to defaults
- **Settings conflicts**: Validation, clear error messages

### User Experience Risks
- **Complexity**: Progressive disclosure, sensible defaults
- **Performance impact**: Background processing, caching
- **Learning curve**: Documentation, tooltips, examples

## Conclusion

This implementation plan provides a comprehensive approach to adding article settings functionality to the content machine. The plan leverages existing infrastructure while adding powerful customization capabilities for users. The phased approach ensures reliable delivery while maintaining system stability.

The key success factors are:
1. Seamless integration with existing article generation workflow
2. Intuitive user interface with clear impact preview
3. Robust error handling and fallback mechanisms
4. Performance optimization to maintain generation speed
5. Comprehensive testing across all integration points
