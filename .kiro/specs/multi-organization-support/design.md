# Multi-Project Support Design Document

## Overview

This design implements a multi-tenant architecture that allows users to manage multiple projects (websites) from a single account. Each project will have complete data isolation while maintaining a unified user experience. The architecture introduces a `projects` table as the central tenant identifier and updates all existing tables to reference projects instead of users directly.

## Architecture

### Database Schema Changes

#### New Projects Table
```sql
CREATE TABLE contentbot.projects (
  id TEXT PRIMARY KEY DEFAULT generate_public_id(),
  name VARCHAR(255) NOT NULL,
  website_url TEXT NOT NULL UNIQUE,
  
  -- Owner relationship
  user_id TEXT NOT NULL REFERENCES contentbot.users(id),
  
  -- Project settings (moved from users table)
  domain TEXT,
  product_description TEXT,
  keywords JSONB DEFAULT '[]',
  
  -- Webhook configuration (moved from users table)
  webhook_url TEXT,
  webhook_secret TEXT,
  webhook_enabled BOOLEAN DEFAULT false NOT NULL,
  webhook_events JSONB DEFAULT '["article.published"]' NOT NULL,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);
```

#### Updated Users Table
The users table will be simplified to contain only user-specific data:
```sql
-- Remove project-specific fields:
-- domain, product_description, keywords, webhook_*, onboarding_completed
-- Keep: id, clerk_user_id, email, firstName, lastName, company_name
```

#### Updated Existing Tables
All existing tables will be updated to reference `project_id` instead of `user_id`:

- `articles`: Add `project_id`, keep `user_id` for author tracking
- `generation_queue`: Add `project_id`
- `article_generation`: Add `project_id`
- `article_settings`: Replace `user_id` with `project_id`
- `webhook_deliveries`: Add `project_id`

### Data Migration Strategy

1. **Create new table**: projects
2. **Migrate existing data**:
   - Create default project for each user using their current domain
   - Move project-specific settings from users to projects
   - Update all related tables with project_id
3. **Update foreign key constraints**
4. **Remove deprecated columns from users table**

## Components and Interfaces

### Project Context Provider
```typescript
interface ProjectContextType {
  currentProject: Project | null;
  projects: Project[];
  switchProject: (projectId: string) => Promise<void>;
  createProject: (data: CreateProjectData) => Promise<Project>;
  deleteProject: (projectId: string) => Promise<void>;
  isLoading: boolean;
}
```

### Project Switcher Component
- Dropdown in dashboard header
- Shows current project name and website
- Lists all user's projects
- "Create New Project" option

### Project Creation Modal
- Form fields: name, website URL
- Website URL validation and uniqueness check
- Automatic domain extraction and analysis
- Integration with existing onboarding flow

### Updated Navigation
- Project context indicator in sidebar
- Project-specific settings section
- Breadcrumb updates to show project context

## Data Models

### Project Model
```typescript
interface Project {
  id: string;
  name: string;
  websiteUrl: string;
  userId: string;
  domain?: string;
  productDescription?: string;
  keywords: string[];
  webhookUrl?: string;
  webhookSecret?: string;
  webhookEnabled: boolean;
  webhookEvents: string[];
  createdAt: Date;
  updatedAt: Date;
}
```

### Updated Article Model
```typescript
interface Article {
  // ... existing fields
  projectId: string; // NEW
  userId: string; // Keep for author tracking
  // ... rest unchanged
}
```

## Error Handling

### Project Access Control
- Middleware to verify user owns the requested project
- Automatic fallback to user's first project if invalid project selected
- Graceful handling of deleted projects

### Data Isolation
- All database queries must include project_id filter
- API routes must validate project ownership
- Frontend components must use project context

### Migration Error Handling
- Rollback strategy for failed migrations
- Data validation before and after migration
- Backup creation before schema changes

## Testing Strategy

### Unit Tests
- Project context provider functionality
- Project CRUD operations
- Data access layer with project filtering
- Migration scripts validation

### Integration Tests
- Project switching workflow
- Article creation in different projects
- Settings isolation between projects
- Webhook delivery per project

### End-to-End Tests
- Complete project creation flow
- Multi-project article management
- Project deletion with data cleanup
- User onboarding with project creation

### Migration Testing
- Test migration with sample data
- Verify data integrity after migration
- Test rollback procedures
- Performance testing with large datasets

## Security Considerations

### Access Control
- Users can only access projects they own
- API endpoints must validate project ownership
- Simple ownership model (no shared projects)

### Data Isolation
- Strict project_id filtering in all queries
- No cross-project data leakage
- Audit logging for project access

### Migration Security
- Backup all data before migration
- Validate data integrity at each step
- Secure handling of webhook secrets during migration

## Performance Considerations

### Database Indexing
```sql
-- Critical indexes for performance
CREATE INDEX idx_articles_project_id ON contentbot.articles(project_id);
CREATE INDEX idx_projects_user_id ON contentbot.projects(user_id);
CREATE UNIQUE INDEX idx_projects_website_url ON contentbot.projects(website_url);
```

### Query Optimization
- Always include project_id in WHERE clauses
- Use project context to limit data fetching
- Implement pagination for project lists

### Caching Strategy
- Cache user's projects
- Cache current project context
- Invalidate cache on project changes

## Implementation Phases

### Phase 1: Database Schema
- Create new projects table
- Add project_id columns to existing tables
- Create necessary indexes

### Phase 2: Data Migration
- Migrate existing user data to projects
- Update all existing records with project_id
- Validate data integrity

### Phase 3: Backend Updates
- Update all API routes to use project context
- Implement project CRUD operations
- Add project access middleware

### Phase 4: Frontend Implementation
- Create project context provider
- Implement project switcher
- Update all components to use project context
- Create project management UI

### Phase 5: Testing & Deployment
- Comprehensive testing of all workflows
- Performance optimization
- Production deployment with monitoring