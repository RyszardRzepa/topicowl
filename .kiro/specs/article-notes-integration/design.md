# Design Document

## Overview

The article notes integration feature will add a notes field to the article creation process and integrate these notes throughout the AI generation pipeline. The design focuses on minimal UI changes while maximizing the impact on content quality by providing contextual guidance to the AI at each generation phase.

## Architecture

### Data Flow
```
User Input (Notes) → Database Storage → Research API → Outline API → Writing API → Final Article
```

### Component Integration
- **Frontend**: Planning Hub form enhancement with notes textarea
- **Database**: Schema extension to store notes with articles
- **API Layer**: Prompt enhancement across research, outline, and writing endpoints
- **AI Pipeline**: Context injection at each generation phase

## Components and Interfaces

### 1. Database Schema Changes

**Articles Table Extension:**
```sql
ALTER TABLE contentbot.articles 
ADD COLUMN notes TEXT;
```

**TypeScript Interface Update:**
```typescript
// In src/types.ts
export interface Article {
  // ... existing fields
  notes?: string; // New optional field for user-provided context
}
```

### 2. Frontend Components

**Planning Hub Form Enhancement:**
- Location: `src/components/workflow/planning-hub.tsx`
- Add notes textarea after keywords field
- Maintain existing form validation and submission flow
- Include notes in `onCreateArticle` callback

**Form State Management:**
```typescript
const [newArticleData, setNewArticleData] = useState({
  title: "",
  keywords: "",
  notes: "", // New field
});
```

**UI Layout:**
```jsx
<div>
  <label>Article Notes (optional)</label>
  <Textarea
    value={newArticleData.notes}
    onChange={(e) => setNewArticleData({...newArticleData, notes: e.target.value})}
    placeholder="Add specific requirements, context, or information you want the AI to consider..."
    rows={4}
  />
  <p className="text-xs text-muted-foreground">
    These notes will guide the AI throughout research, outlining, and writing phases.
  </p>
</div>
```

### 3. API Integration Points

**Research API Enhancement:**
- File: `src/app/api/articles/research/route.ts`
- Include notes in research prompt context
- Pass notes to `prompts.research()` function

**Outline API Enhancement:**
- File: `src/app/api/articles/outline/route.ts`
- Include notes in outline generation
- Pass notes to `prompts.outline()` function

**Writing API Enhancement:**
- File: `src/app/api/articles/write/route.ts`
- Include notes in writing prompt
- Pass notes to `prompts.writing()` function

### 4. Prompt Engineering

**Research Prompt Enhancement:**
```typescript
// In src/constants.ts prompts.research
const researchPrompt = `
${existingPrompt}

${notes ? `
<user_context>
<article_notes>
The user has provided the following specific context and requirements for this article:
${notes}

Please prioritize research that addresses these specific points and requirements.
</article_notes>
</user_context>
` : ''}
`;
```

**Outline Prompt Enhancement:**
```typescript
// In src/constants.ts prompts.outline
const outlinePrompt = `
${existingPrompt}

${notes ? `
<user_requirements>
The user has provided specific requirements for this article:
${notes}

Ensure the outline structure and key points address these requirements and incorporate this context.
</user_requirements>
` : ''}
`;
```

**Writing Prompt Enhancement:**
```typescript
// In src/constants.ts prompts.writing
const writingPrompt = `
${existingPrompt}

${notes ? `
<user_guidance>
The user has provided specific guidance for this article:
${notes}

Incorporate this information and context throughout the article while maintaining quality and flow.
</user_guidance>
` : ''}
`;
```

## Data Models

### Article Model Extension
```typescript
interface Article {
  // Existing fields...
  notes?: string; // User-provided context and requirements
}
```

### API Request/Response Updates

**Article Creation Request:**
```typescript
interface CreateArticleRequest {
  title: string;
  keywords?: string[];
  description?: string;
  targetAudience?: string;
  notes?: string; // New field
}
```

**Generation API Requests:**
All generation APIs (research, outline, writing) will receive notes as part of their request payload when available.

## Error Handling

### Input Validation
- Notes field is optional - no validation required
- Maximum length limit of 5000 characters to prevent prompt overflow
- Sanitize input to prevent injection attacks

### API Error Handling
- If notes are malformed, log warning but continue generation
- If notes cause prompt length issues, truncate gracefully
- Maintain backward compatibility with articles without notes

### User Feedback
- Clear indication when notes are being used in generation
- Graceful handling of empty or missing notes
- No error states for optional notes field

## Testing Strategy

### Unit Tests
- Form component with notes field
- API request/response handling with notes
- Prompt generation with and without notes
- Database operations with notes field

### Integration Tests
- End-to-end article creation with notes
- Generation pipeline with notes integration
- Backward compatibility with existing articles

### User Acceptance Testing
- Article creation flow with notes
- Generated content quality with notes guidance
- UI/UX validation for notes field placement

## Performance Considerations

### Database Impact
- Notes field is TEXT type - minimal storage impact
- No indexing required for notes field
- Existing queries unaffected

### API Performance
- Notes add minimal payload size to requests
- Prompt length increase is manageable
- No additional API calls required

### Frontend Performance
- Single additional form field - negligible impact
- No complex state management required
- Maintains existing form performance

## Security Considerations

### Input Sanitization
- Sanitize notes input to prevent XSS
- Validate notes length to prevent DoS
- No special characters restrictions needed

### Data Privacy
- Notes stored with same security as other article data
- No additional encryption required
- Standard user data access controls apply

### Prompt Injection Prevention
- Sanitize notes before including in AI prompts
- Use structured prompt templates to prevent injection
- Monitor for malicious prompt patterns

## Migration Strategy

### Database Migration
```sql
-- Add notes column to existing articles table
ALTER TABLE contentbot.articles 
ADD COLUMN notes TEXT;

-- No data migration needed - field is optional
```

### Code Deployment
1. Deploy database schema changes
2. Deploy backend API changes
3. Deploy frontend form changes
4. Monitor for any issues with existing functionality

### Rollback Plan
- Database column can remain if rollback needed
- Frontend changes can be reverted independently
- API changes are backward compatible