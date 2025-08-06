# Design Document

## Overview

The competitor domain blacklist feature allows users to specify website domains that should be excluded from article generation linking. This feature integrates into the existing onboarding flow and settings page, with backend support for filtering domains during article outline and writing processes.

## Architecture

### High-Level Flow
1. **User Input**: Users configure blacklisted domains during onboarding or in settings
2. **Storage**: Domains are stored in the user's profile with validation and normalization
3. **Integration**: Article generation APIs retrieve and apply blacklist filtering
4. **AI Guidance**: Prompts are enhanced to instruct AI to avoid blacklisted domains

### System Components
- **Frontend**: Onboarding step and settings UI components
- **Backend**: API endpoints for CRUD operations on blacklisted domains
- **Database**: Extended user schema to store blacklisted domains
- **Article Generation**: Enhanced outline and writing APIs with domain filtering
- **AI Prompts**: Updated prompts to include blacklist instructions

## Components and Interfaces

### Database Schema Extensions

```typescript
// Extend existing user schema
interface User {
  // ... existing fields
  blacklistedDomains: string[]; // Array of normalized domain strings
}
```

### Frontend Components

#### 1. Onboarding Competitor Blacklist Step
```typescript
interface CompetitorBlacklistStepProps {
  onNext: (domains: string[]) => void;
  onSkip: () => void;
}

// Component: CompetitorBlacklistStep
// Location: src/components/onboarding/competitor-blacklist-step.tsx
```

#### 2. Settings Blacklist Management
```typescript
interface BlacklistManagementProps {
  initialDomains: string[];
  onUpdate: (domains: string[]) => void;
}

// Component: BlacklistManagement  
// Location: src/components/settings/blacklist-management.tsx
```

### API Endpoints

#### 1. Blacklist Management API
```typescript
// GET /api/settings/blacklist
interface GetBlacklistResponse {
  success: boolean;
  domains: string[];
}

// POST /api/settings/blacklist
interface UpdateBlacklistRequest {
  domains: string[];
}

interface UpdateBlacklistResponse {
  success: boolean;
  domains: string[];
  error?: string;
}
```

#### 2. Enhanced Onboarding API
```typescript
// Extend existing onboarding complete endpoint
interface CompleteOnboardingRequest {
  skipWebsiteAnalysis?: boolean;
  blacklistedDomains?: string[]; // New field
}
```

### Domain Validation and Normalization

#### Domain Validation Rules
- Must be valid domain format (e.g., example.com, subdomain.example.com)
- No protocols (http/https) allowed
- No paths or query parameters
- Maximum length: 253 characters
- Minimum length: 4 characters

#### Normalization Process
```typescript
function normalizeDomain(domain: string): string {
  // Remove protocols
  domain = domain.replace(/^https?:\/\//, '');
  
  // Remove trailing slashes and paths
  domain = domain.split('/')[0];
  
  // Convert to lowercase
  domain = domain.toLowerCase();
  
  // Remove www. prefix for consistency (optional - configurable)
  domain = domain.replace(/^www\./, '');
  
  return domain;
}
```

## Data Models

### Blacklisted Domain Storage
```typescript
interface BlacklistedDomain {
  userId: string;
  domain: string; // Normalized domain
  createdAt: Date;
  updatedAt: Date;
}

// Alternative: Store as JSON array in user table
interface UserSettings {
  blacklistedDomains: string[];
}
```

### Domain Filtering Context
```typescript
interface ArticleGenerationContext {
  userId: string;
  blacklistedDomains: string[];
  // ... other context
}
```

## Error Handling

### Validation Errors
- **Invalid Domain Format**: "Please enter a valid domain (e.g., example.com)"
- **Duplicate Domain**: "This domain is already in your blacklist"
- **Empty Domain**: "Domain cannot be empty"
- **Domain Too Long**: "Domain must be less than 253 characters"

### API Error Responses
```typescript
interface ErrorResponse {
  success: false;
  error: string;
  code: 'INVALID_DOMAIN' | 'DUPLICATE_DOMAIN' | 'DATABASE_ERROR' | 'UNAUTHORIZED';
}
```

### Graceful Degradation
- If blacklist retrieval fails, proceed with article generation without filtering
- Log errors for monitoring but don't block user workflows
- Provide fallback UI states for loading and error conditions

## Testing Strategy

### Unit Tests
- Domain validation and normalization functions
- Blacklist management API endpoints
- Frontend component interactions
- Domain filtering logic

### Integration Tests
- End-to-end onboarding flow with blacklist configuration
- Settings page blacklist management
- Article generation with blacklist filtering
- Database operations for blacklist CRUD

### Test Cases
1. **Valid Domain Addition**: User adds "competitor.com" → stored as "competitor.com"
2. **Domain Normalization**: User adds "https://www.competitor.com/" → stored as "competitor.com"
3. **Duplicate Prevention**: User adds same domain twice → shows error message
4. **Article Filtering**: Generate article with blacklisted domain in sources → domain excluded
5. **Empty Blacklist**: User with no blacklisted domains → normal article generation
6. **Invalid Domain**: User adds "invalid..domain" → shows validation error

### Performance Tests
- Blacklist retrieval performance with large domain lists (100+ domains)
- Article generation performance impact with blacklist filtering
- Database query optimization for blacklist lookups

## Implementation Phases

### Phase 1: Database and Backend API
- Extend user schema for blacklisted domains
- Create blacklist management API endpoints
- Implement domain validation and normalization
- Add blacklist retrieval to article generation context

### Phase 2: Frontend Components
- Create onboarding blacklist step component
- Build settings blacklist management interface
- Integrate components into existing flows
- Add form validation and user feedback

### Phase 3: Article Generation Integration
- Update outline API to filter blacklisted domains
- Update writing API to exclude blacklisted sources
- Enhance AI prompts with blacklist instructions
- Add logging for blacklist filtering actions

### Phase 4: Testing and Polish
- Comprehensive testing across all components
- Performance optimization
- Error handling improvements
- User experience refinements

## Security Considerations

### Input Validation
- Sanitize domain inputs to prevent injection attacks
- Validate domain format server-side regardless of client validation
- Limit maximum number of blacklisted domains per user (e.g., 100)

### Access Control
- Ensure users can only manage their own blacklisted domains
- Validate user authentication for all blacklist operations
- Rate limiting for blacklist update operations

### Data Privacy
- Blacklisted domains are user-specific and private
- No sharing of blacklist data between users
- Secure storage of domain data with proper encryption