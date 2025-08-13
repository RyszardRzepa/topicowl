# Multi-Organization Support Debugging Design Document

## Overview

This design addresses critical issues in the multi-organization support implementation by providing comprehensive debugging, testing, and fixing strategies. The main issues identified include improper project context management, infinite redirect loops, insufficient data filtering, and poor error handling.

## Architecture

### Current Issues Analysis

#### 1. Project Context Loading Issues
- **Problem**: ProjectRequiredChecker is too aggressive in redirecting users
- **Root Cause**: Race conditions between project loading and redirect logic
- **Impact**: Users with valid projects get redirected to project creation

#### 2. Data Filtering Issues  
- **Problem**: Some API endpoints may not properly filter by project_id
- **Root Cause**: Inconsistent implementation of project filtering across endpoints
- **Impact**: Potential data leakage between projects

#### 3. Project Switching Issues
- **Problem**: Project context may not update consistently across components
- **Root Cause**: State management issues in ProjectContext
- **Impact**: Users see stale data after switching projects

#### 4. Onboarding Flow Issues
- **Problem**: New users may not get proper project context after onboarding
- **Root Cause**: Timing issues between project creation and context setting
- **Impact**: New users get stuck in redirect loops

### Debugging Strategy

#### Phase 1: Diagnostic Tools
1. **Enhanced Logging System**
   - Add comprehensive logging to ProjectContext
   - Log all project loading, switching, and error states
   - Add performance timing logs for project operations

2. **Debug Dashboard**
   - Create internal debug page showing current project state
   - Display project loading status, errors, and context data
   - Show API call logs and response times

3. **Data Validation Tools**
   - Create scripts to validate data integrity
   - Check for orphaned records without proper project_id
   - Verify user-project relationships

#### Phase 2: Issue Identification
1. **Project Context Audit**
   - Review all components using project context
   - Identify components not properly handling loading states
   - Find race conditions in project switching

2. **API Endpoint Audit**
   - Review all API endpoints for proper project filtering
   - Verify user ownership checks
   - Test data isolation between projects

3. **User Flow Testing**
   - Test complete onboarding flow
   - Test project switching scenarios
   - Test edge cases (no projects, deleted projects, etc.)

#### Phase 3: Systematic Fixes
1. **Project Context Improvements**
   - Fix race conditions in project loading
   - Improve error handling and recovery
   - Add proper loading states throughout the app

2. **API Security Hardening**
   - Ensure all endpoints properly filter by project_id and user_id
   - Add comprehensive ownership validation
   - Implement consistent error responses

3. **User Experience Improvements**
   - Fix redirect loops
   - Improve loading states and error messages
   - Add better feedback for project operations

## Components and Interfaces

### Enhanced Project Context
```typescript
interface ProjectContextValue {
  // Existing properties
  projects: Project[];
  currentProject: Project | null;
  isLoading: boolean;
  error: string | null;
  
  // Enhanced debugging properties
  debugInfo: {
    loadingStartTime: number | null;
    lastError: Error | null;
    apiCallCount: number;
    cacheHits: number;
    contextSwitches: number;
  };
  
  // Enhanced methods
  switchProject: (projectId: number) => Promise<void>;
  refreshProjects: () => Promise<void>;
  clearError: () => void;
  retryLoad: () => Promise<void>;
}
```

### Debug Dashboard Component
```typescript
interface DebugInfo {
  projectContext: {
    currentProject: Project | null;
    projectCount: number;
    isLoading: boolean;
    error: string | null;
    loadTime: number;
  };
  apiCalls: {
    endpoint: string;
    method: string;
    status: number;
    duration: number;
    timestamp: Date;
  }[];
  userInfo: {
    userId: string;
    hasProjects: boolean;
    onboardingComplete: boolean;
  };
}
```

### API Response Validation
```typescript
interface ApiValidationResult {
  endpoint: string;
  hasProjectFilter: boolean;
  hasUserFilter: boolean;
  vulnerabilities: string[];
  recommendations: string[];
}
```

## Data Models

### Enhanced Project Model
```typescript
interface Project {
  // Existing fields
  id: number;
  name: string;
  websiteUrl: string;
  userId: string;
  // ... other fields
  
  // Debug fields
  _debug?: {
    loadedAt: Date;
    lastAccessed: Date;
    apiCallCount: number;
  };
}
```

### Debug Log Entry
```typescript
interface DebugLogEntry {
  timestamp: Date;
  level: 'info' | 'warn' | 'error' | 'debug';
  component: string;
  action: string;
  data: Record<string, unknown>;
  userId?: string;
  projectId?: number;
}
```

## Error Handling

### Project Context Error Recovery
1. **Automatic Retry Logic**
   - Implement exponential backoff for failed project loads
   - Cache last known good state for fallback
   - Provide manual retry options for users

2. **Graceful Degradation**
   - Show cached data when API calls fail
   - Allow basic operations even with partial project data
   - Clear error states when operations succeed

3. **User-Friendly Error Messages**
   - Replace technical errors with user-friendly messages
   - Provide actionable steps for error resolution
   - Include contact information for persistent issues

### API Error Standardization
```typescript
interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  retryable: boolean;
  userMessage: string;
}
```

## Testing Strategy

### Unit Tests
1. **Project Context Tests**
   - Test project loading scenarios
   - Test error handling and recovery
   - Test project switching logic
   - Test caching behavior

2. **API Endpoint Tests**
   - Test project filtering on all endpoints
   - Test user ownership validation
   - Test error responses
   - Test data isolation

3. **Component Tests**
   - Test components with various project states
   - Test loading and error states
   - Test project switching behavior

### Integration Tests
1. **User Flow Tests**
   - Complete onboarding flow
   - Project creation and switching
   - Article management across projects
   - Settings management per project

2. **Data Isolation Tests**
   - Create multiple users with multiple projects
   - Verify data isolation between users
   - Verify data isolation between projects
   - Test cross-project data access attempts

3. **Performance Tests**
   - Project loading performance
   - Project switching performance
   - API response times with project filtering
   - Memory usage with multiple projects

### End-to-End Tests
1. **Critical User Journeys**
   - New user onboarding
   - Existing user login and project access
   - Multi-project content management
   - Project deletion and recovery

2. **Edge Case Testing**
   - Users with no projects
   - Users with deleted projects
   - Network connectivity issues
   - API service disruptions

## Security Considerations

### Data Access Control
1. **Project Ownership Validation**
   - Verify user owns project before any operation
   - Implement consistent ownership checks across all endpoints
   - Log unauthorized access attempts

2. **Data Filtering Enforcement**
   - Ensure all queries include proper project_id filters
   - Implement database-level constraints where possible
   - Add query auditing for security compliance

3. **Session Management**
   - Validate project context matches user session
   - Handle project context in server-side rendering
   - Secure project selection persistence

## Performance Considerations

### Optimization Strategies
1. **Caching Improvements**
   - Cache project data in localStorage
   - Implement smart cache invalidation
   - Use React Query for API state management

2. **Loading Optimization**
   - Parallel loading of projects and user data
   - Preload project data during authentication
   - Implement progressive loading for large datasets

3. **Database Query Optimization**
   - Review and optimize all project-related queries
   - Add missing database indexes
   - Implement query result caching

## Implementation Phases

### Phase 1: Diagnostic Implementation (1-2 days)
- Add comprehensive logging to ProjectContext
- Create debug dashboard component
- Implement API endpoint auditing tools
- Add data validation scripts

### Phase 2: Issue Identification (1-2 days)
- Run comprehensive testing suite
- Audit all API endpoints for security issues
- Identify and document all bugs and issues
- Create prioritized fix list

### Phase 3: Critical Fixes (2-3 days)
- Fix project context loading issues
- Resolve redirect loop problems
- Implement proper error handling
- Fix data filtering issues

### Phase 4: Testing and Validation (1-2 days)
- Run comprehensive test suite
- Validate fixes with real user scenarios
- Performance testing and optimization
- Security validation

### Phase 5: Monitoring and Documentation (1 day)
- Implement production monitoring
- Create troubleshooting documentation
- Set up alerting for critical issues
- Document lessons learned