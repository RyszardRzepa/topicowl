# Implementation Plan

- [ ] 1. Create database schema for projects
  - Add projects table with name, website_url, and user_id fields
  - Include webhook configuration and project settings in projects table
  - Create database indexes for optimal query performance including unique constraint on website_url
  - _Requirements: 1.2, 2.1, 4.1_

- [ ] 2. Update existing database schema
  - [ ] 2.1 Add project_id column to articles table
    - Add foreign key reference to projects table
    - Create index on project_id for query performance
    - _Requirements: 2.1, 2.2_

  - [ ] 2.2 Add project_id to generation_queue table
    - Add foreign key reference to projects table
    - Update existing queries to include project context
    - _Requirements: 2.1, 2.2_

  - [ ] 2.3 Add project_id to article_generation table
    - Add foreign key reference to projects table
    - Ensure generation tracking is project-specific
    - _Requirements: 2.1, 2.2_

  - [ ] 2.4 Update article_settings table structure
    - Replace user_id with project_id as primary reference
    - Add foreign key constraint to projects table
    - _Requirements: 2.1, 4.1_

  - [ ] 2.5 Add project_id to webhook_deliveries table
    - Add foreign key reference to projects table
    - Ensure webhook tracking is project-specific
    - _Requirements: 2.1, 4.1_

- [ ] 3. Create data migration script
  - [ ] 3.1 Implement migration to create default projects
    - Create one project per existing user using their current domain
    - Migrate user-specific settings to project settings
    - _Requirements: 7.1, 7.2_

  - [ ] 3.2 Migrate existing article data
    - Update all articles to reference the user's default project
    - Update generation_queue and article_generation records
    - _Requirements: 2.1, 2.2_

  - [ ] 3.3 Migrate settings and webhook configurations
    - Move webhook settings from users table to projects table
    - Update article_settings to reference projects
    - _Requirements: 4.1, 4.2_

- [ ] 4. Create project data models and types
  - Define Project TypeScript interface
  - Add project-related types to src/types.ts
  - Update existing Article and other model types to include projectId
  - _Requirements: 1.1, 2.1_

- [ ] 5. Implement project CRUD API endpoints
  - [ ] 5.1 Create project creation endpoint
    - POST /api/projects route for creating new projects
    - Validate website URL uniqueness and extract domain information
    - Automatically associate project with current user
    - _Requirements: 1.1, 1.2_

  - [ ] 5.2 Create project listing endpoint
    - GET /api/projects route to fetch user's projects
    - Include project details and settings
    - _Requirements: 3.1, 3.2_

  - [ ] 5.3 Create project update endpoint
    - PUT /api/projects/[id] route for updating project details
    - Validate user ownership for project updates
    - _Requirements: 4.1, 4.2_

  - [ ] 5.4 Create project deletion endpoint
    - DELETE /api/projects/[id] route with cascade deletion
    - Implement confirmation and data cleanup logic
    - _Requirements: 6.1, 6.2, 6.3_

- [ ] 6. Create project context management
  - [ ] 6.1 Implement ProjectContext provider
    - Create React context for managing current project state
    - Implement project switching functionality
    - Handle project loading and error states
    - _Requirements: 3.2, 3.3, 5.1_

  - [ ] 6.2 Create project selection persistence
    - Store current project selection in localStorage
    - Implement session-based project context restoration
    - _Requirements: 3.3, 3.4_

- [ ] 7. Update existing API routes for project context
  - [ ] 7.1 Update articles API routes
    - Modify all article endpoints to filter by project_id
    - Update article creation to use current project context
    - _Requirements: 2.1, 2.2, 2.3_

  - [ ] 7.2 Update settings API routes
    - Modify settings endpoints to work with project-specific data
    - Update webhook configuration endpoints for project context
    - _Requirements: 4.1, 4.2, 4.3_

  - [ ] 7.3 Update generation and publishing API routes
    - Modify article generation endpoints to use project context
    - Update publishing and scheduling endpoints for project isolation
    - _Requirements: 2.2, 2.3_

- [ ] 8. Create project switcher UI component
  - [ ] 8.1 Implement project dropdown component
    - Create dropdown showing current project and available options
    - Add "Create New Project" option in dropdown
    - _Requirements: 3.1, 3.2, 1.1_

  - [ ] 8.2 Integrate project switcher in dashboard header
    - Add project switcher to main navigation
    - Display current project name and website URL
    - _Requirements: 1.4, 5.1, 5.2_

- [ ] 9. Create project creation modal
  - [ ] 9.1 Implement project creation form
    - Create modal with form fields for name and website URL
    - Add website URL validation and uniqueness checking
    - _Requirements: 1.1, 1.2_

  - [ ] 9.2 Integrate modal with sidebar settings
    - Add "New Project" option to sidebar settings
    - Connect modal trigger to project creation workflow
    - _Requirements: 1.1, 1.3_

- [ ] 10. Update dashboard components for project context
  - [ ] 10.1 Update kanban board component
    - Filter articles by current project in kanban board
    - Update article creation to use project context
    - _Requirements: 2.3, 2.4_

  - [ ] 10.2 Update article management components
    - Modify article listing and editing to use project context
    - Update article generation components for project isolation
    - _Requirements: 2.2, 2.3, 5.3_

  - [ ] 10.3 Update settings components
    - Modify settings forms to work with project-specific data
    - Update webhook configuration UI for project context
    - _Requirements: 4.1, 4.2, 4.3_

- [ ] 11. Update onboarding flow for project creation
  - [ ] 11.1 Modify onboarding to create default project
    - Update onboarding completion to create user's first project
    - Set created project as active project context
    - _Requirements: 7.1, 7.2_

  - [ ] 11.2 Handle existing users without projects
    - Add redirect logic for users without projects
    - Prompt project creation for users missing projects
    - _Requirements: 7.3_

- [ ] 12. Implement project access control middleware
  - Create middleware to validate user ownership of requested project
  - Add project ownership verification to protected routes
  - Implement automatic fallback to user's first project
  - _Requirements: 2.1, 2.2, 6.3_

- [ ] 13. Add project context indicators throughout UI
  - [ ] 13.1 Update page headers and breadcrumbs
    - Display current project context in page headers
    - Update breadcrumb navigation to show project context
    - _Requirements: 5.1, 5.2_

  - [ ] 13.2 Add project confirmation in critical actions
    - Show project context when creating or scheduling articles
    - Add project confirmation in publishing workflows
    - _Requirements: 5.3, 5.4, 5.5_

- [ ] 14. Create comprehensive test suite
  - [ ] 14.1 Write unit tests for project CRUD operations
    - Test project creation, updating, and deletion logic
    - Test project ownership and access control
    - _Requirements: 1.1, 1.2, 6.1, 6.2_

  - [ ] 14.2 Write integration tests for project context
    - Test project switching functionality
    - Test data isolation between projects
    - _Requirements: 2.1, 2.2, 3.2, 3.3_

  - [ ] 14.3 Write tests for migration scripts
    - Test data migration from users to projects
    - Verify data integrity after migration completion
    - _Requirements: 7.1, 7.2_
