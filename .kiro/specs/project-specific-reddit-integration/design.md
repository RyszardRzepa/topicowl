# Design Document

## Overview

This design refactors the Reddit integration from user-level to project-level, allowing users to connect different Reddit accounts to different projects. The current implementation stores Reddit refresh tokens in Clerk's private metadata at the user level. The new design will move this data to the database with project-specific associations while maintaining security and proper token management.

## Architecture

### Current Architecture Issues
- Reddit tokens stored in Clerk user metadata (user-level)
- All Reddit API calls use the same Reddit account across all projects
- No project context in Reddit authentication flow
- Single Reddit connection per user regardless of project count

### New Architecture
- Reddit tokens stored in Clerk private metadata with project associations
- Project-specific Reddit authentication and API calls
- Project context maintained throughout OAuth flow
- Multiple Reddit connections per user (one per project) using keyed object structure

## Components and Interfaces

### 1. Clerk Private Metadata Structure

#### Reddit Tokens Storage Format
```typescript
// Clerk private metadata structure
interface ClerkPrivateMetadata {
  redditTokens?: {
    [projectId: string]: {
      refreshToken: string;
      redditUsername: string;
      redditUserId: string;
      connectedAt: string;
      lastUsedAt?: string;
      scopes: string[];
    };
  };
  // Other existing metadata...
}

// Example usage
const metadata = {
  redditTokens: {
    "123": {
      refreshToken: "refresh_token_here",
      redditUsername: "user123",
      redditUserId: "reddit_user_id",
      connectedAt: "2025-01-14T10:00:00Z",
      lastUsedAt: "2025-01-14T12:00:00Z",
      scopes: ["identity", "mysubreddits", "read", "submit"]
    },
    "456": {
      refreshToken: "another_refresh_token",
      redditUsername: "user456",
      redditUserId: "another_reddit_user_id",
      connectedAt: "2025-01-13T15:30:00Z",
      scopes: ["identity", "read"]
    }
  }
};
```

### 2. Reddit Token Operations

#### Inline Token Management
Reddit token operations will be implemented directly in each API route where needed:
- Token storage: Inline Clerk metadata updates in OAuth callback
- Token retrieval: Inline Clerk metadata reads in API endpoints
- Token refresh: Inline Reddit API calls when tokens expire
- Connection status: Inline metadata checks in status endpoint

interface RedditTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

interface RedditUserInfo {
  username: string;
  userId: string;
}

interface RedditConnectionStatus {
  connected: boolean;
  username?: string;
  connectedAt?: string;
  lastUsedAt?: string;
}
```

### 3. API Route Updates

#### Authentication Flow (`/api/reddit/auth`)
- Accept project ID as query parameter
- Store project ID in OAuth state for callback validation
- Maintain CSRF protection with project context

#### OAuth Callback (`/api/reddit/callback`)
- Extract project ID from OAuth state
- Store tokens in Clerk private metadata keyed by project ID
- Update existing Clerk metadata structure to support multiple projects

#### Connection Management
- `/api/reddit/status` - Check project-specific connection status
- `/api/reddit/disconnect` - Disconnect project-specific Reddit account
- All Reddit API endpoints use project-specific tokens

### 4. Project Context Integration

#### Middleware Enhancement
- Ensure project context is available in Reddit API routes
- Validate project ownership before Reddit operations
- Handle missing project context gracefully

#### Frontend Integration
- Reddit settings page shows project-specific connection status
- Project switcher updates Reddit connection display
- Clear indication of which Reddit account is connected per project

## Data Models

### Clerk Metadata Types

```typescript
// Clerk private metadata structure
interface ClerkPrivateMetadata {
  redditTokens?: {
    [projectId: string]: ProjectRedditConnection;
  };
  // Other existing metadata fields...
}

interface ProjectRedditConnection {
  refreshToken: string;
  redditUsername: string;
  redditUserId: string;
  connectedAt: string;
  lastUsedAt?: string;
  scopes: string[];
}
```

### TypeScript Types

```typescript
// API Response Types
export interface ProjectRedditConnection {
  projectId: number;
  redditUsername: string;
  connectedAt: string;
  lastUsedAt?: string;
  scopes: string[];
}

export interface RedditConnectionStatus {
  connected: boolean;
  connection?: ProjectRedditConnection;
}

// Internal Service Types
export interface RedditTokenData {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  scope: string;
}

export interface RedditUserData {
  name: string;
  id: string;
}

// Clerk metadata types
export interface ClerkRedditTokens {
  [projectId: string]: {
    refreshToken: string;
    redditUsername: string;
    redditUserId: string;
    connectedAt: string;
    lastUsedAt?: string;
    scopes: string[];
  };
}
```

## Error Handling

### Token Refresh Failures
- Automatic retry with exponential backoff
- Mark connection as expired after max retries
- Clear error messages for re-authentication

### Project Context Errors
- Validate project ownership before Reddit operations
- Return 403 for unauthorized project access
- Handle missing project context gracefully

### Clerk Metadata Updates
- Handle concurrent metadata updates safely
- Proper error messages for connection replacement scenarios
- Atomic updates to prevent data corruption

### OAuth Flow Errors
- Comprehensive error handling for state validation
- Clear error messages for OAuth failures
- Proper cleanup of failed authentication attempts

## Testing Strategy

### Unit Tests
- Reddit token manager service methods
- Clerk metadata operations for Reddit connections
- Project context validation logic

### Integration Tests
- Complete OAuth flow with project context
- Token refresh and expiration handling
- API route behavior with project-specific tokens
- Database migration and data integrity

### End-to-End Tests
- User connects Reddit account to specific project
- Project switching shows correct Reddit status
- Reddit API calls use correct project tokens
- Disconnection removes only project-specific data

### Migration Testing
- Existing user Reddit connections handled properly
- Data integrity maintained during metadata structure changes
- Rollback procedures for failed migrations
- Clerk API rate limiting considerations

## Security Considerations

### Token Storage
- Secure storage in Clerk private metadata (server-only)
- No tokens in application logs or client-side code
- Proper token cleanup on disconnection

### Access Control
- Project ownership validation for all Reddit operations
- User authentication required for all endpoints
- Rate limiting on Reddit API calls
- CSRF protection in OAuth flow

### Data Privacy
- Minimal Reddit user data storage
- Proper data cleanup on disconnection
- Compliance with Reddit API terms
- User consent for data collection

## Migration Strategy

### Phase 1: Infrastructure Setup
1. Create Reddit token manager service for Clerk metadata
2. Define TypeScript types for new metadata structure
3. Add utility functions for metadata operations

### Phase 2: API Route Updates
1. Update authentication flow with project context
2. Modify callback handling for project-specific storage
3. Update all Reddit API routes to use project tokens
4. Implement new connection status endpoints

### Phase 3: Data Migration
1. Migrate existing user-level Reddit connections to project-keyed structure
2. Associate existing connections with user's primary project
3. Update Clerk private metadata structure
4. Validate data integrity and cleanup old format

### Phase 4: Frontend Updates
1. Update Reddit settings to show project-specific status
2. Modify project switcher behavior
3. Update error handling and user messaging
4. Test complete user workflows

### Rollback Plan
- Clerk metadata rollback procedures
- Temporary dual-format support during transition
- Feature flag for old vs new implementation
- Monitoring and alerting for Clerk API issues