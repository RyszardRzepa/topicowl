# Implementation Plan

Once the task is completed, update the checkbox.

- [x] 1. Create database schema for projects
  - Add projects table with name, website_url, and user_id fields
  - Include webhook configuration and project settings in projects table
  - Create database indexes for optimal query performance including unique constraint on website_url
  - _Requirements: 1.2, 2.1, 4.1_

- [x] 2. Update existing database schema
  - [x] 2.1 Add project_id column to articles table
    - Add foreign key reference to projects table
    - Create index on project_id for query performance
    - _Requirements: 2.1, 2.2_

  - [x] 2.2 Add project_id to generation_queue table
    - Add foreign key reference to projects table
    - Update existing queries to include project context
    - _Requirements: 2.1, 2.2_

  - [x] 2.3 Add project_id to article_generation table
    - Add foreign key reference to projects table
    - Ensure generation tracking is project-specific
    - _Requirements: 2.1, 2.2_

  - [x] 2.4 Update article_settings table structure
    - Replace user_id with project_id as primary reference
    - Add foreign key constraint to projects table
    - _Requirements: 2.1, 4.1_

  - [x] 2.5 Add project_id to webhook_deliveries table
    - Add foreign key reference to projects table
    - Ensure webhook tracking is project-specific
    - _Requirements: 2.1, 4.1_

- [x] 3. Create data migration script
  - [x] 3.1 Implement migration to create default projects
    - Create one project per existing user using their current domain
    - Migrate user-specific settings to project settings
    - _Requirements: 7.1, 7.2_

  - [x] 3.2 Migrate existing article data
    - Update all articles to reference the user's default project
    - Update generation_queue and article_generation records
    - _Requirements: 2.1, 2.2_

  - [x] 3.3 Migrate settings and webhook configurations
    - Move webhook settings from users table to projects table
    - Update article_settings to reference projects
    - _Requirements: 4.1, 4.2_

- [x] 4. Create project data models and types
  - Define Project TypeScript interface
  - Add project-related types to src/types.ts
  - Update existing Article and other model types to include projectId
  - _Requirements: 1.1, 2.1_

- [x] 5. Implement project CRUD API endpoints
  - [x] 5.1 Create project creation endpoint
    - POST /api/projects route for creating new projects
    - Validate website URL uniqueness and extract domain information
    - Automatically associate project with current user
    - _Requirements: 1.1, 1.2_

  - [x] 5.2 Create project listing endpoint
    - GET /api/projects route to fetch user's projects
    - Include project details and settings
    - _Requirements: 3.1, 3.2_

  - [x] 5.3 Create project update endpoint
    - PUT /api/projects/[id] route for updating project details
    - Validate user ownership for project updates
    - _Requirements: 4.1, 4.2_

  - [x] 5.4 Create project deletion endpoint
    - DELETE /api/projects/[id] route with cascade deletion
    - Implement confirmation and data cleanup logic
    - _Requirements: 6.1, 6.2, 6.3_
  - [x] 5.5 Prevent deletion of sole remaining project
    - Reject deletion when user has only one project (400 + message)
    - _Requirements: 6.4_

- [x] 6. Create project context management
  - [x] 6.1 Implement ProjectContext provider
    - Create React context for managing current project state
    - Implement project switching functionality
    - Handle project loading and error states
    - _Requirements: 3.2, 3.3, 5.1_

  - [x] 6.2 Create project selection persistence
    - Store current project selection in localStorage
    - Implement session-based project context restoration
    - _Requirements: 3.3, 3.4_
  - [x] 6.3 Implement server-side project selection persistence
    - Mirror active projectId in cookie for SSR hydration
    - Layout/middleware reads cookie to pre-hydrate context and avoid flash
    - Fallback to first project if cookie invalid / project deleted
    - _Requirements: 3.3, 3.4, 6.3_

- [x] 7. Update existing API routes for project context
  - [x] 7.1 Update articles API routes
    - Modify all article endpoints to filter by project_id
    - Update article creation to use current project context
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 7.2 Update settings API routes
    - Modify settings endpoints to work with project-specific data
    - Update webhook configuration endpoints for project context
    - _Requirements: 4.1, 4.2, 4.3_

  - [x] 7.3 Update generation and publishing API routes
    - Modify article generation endpoints to use project context
    - Update publishing and scheduling endpoints for project isolation
    - _Requirements: 2.2, 2.3_
  - [x] 7.4 Generation pipeline project injection audit
    - Ensure projectId propagated through idea generation, queue insertion, generation tracking, publishing
    - Add integration test matrix for two projects verifying isolation
    - _Requirements: 2.1, 2.2, 2.3_
  - [x] 7.5 API query audit for project scoping
    - Enumerate all endpoints touching articles, settings, generation, webhooks
    - Verify every DB query includes project_id filter (except user-scoped resources like credits)
    - Produce short checklist artifact / internal note
    - _Requirements: 2.1, 2.2_

- [x] 8. Create project switcher UI component
  - [x] 8.1 Sidebar project selector (replaces logo area)
    - Replace logo at sidebar top with Select showing current project (name + truncated domain)
    - Inline "+ New Project" option/button inside dropdown
    - Display global user credits balance adjacent (read-only)
    - _Requirements: 1.4, 3.1, 3.2, 5.1 (Shared Credits)_

  - [x] 8.2 Sidebar integration & responsive behavior
    - Ensure accessible focus order & keyboard navigation
    - Handle mobile / collapsed sidebar gracefully
    - Remove obsolete header placement of switcher
    - _Requirements: 5.1, 5.2_

  - [x] 8.3 Credits indicator UX
    - Tooltip clarifying credits are shared across all projects
    - No projectId partitioning of credits state
    - _Requirements: (Shared Credits)_

- [x] 9. Create project creation modal
  - [x] 9.1 Implement project creation form
    - Create project creation form with fields for name and website URL (similar to onboarding flow)
    - Add website URL validation and uniqueness checking
    - ✅ **COMPLETED**: Automatically switch to newly created project as the active project context
    - _Requirements: 1.1, 1.2_
    - _Note: Implemented as dedicated page instead of modal for better UX with full form_

  - [x] 9.2 Integrate modal with sidebar settings
    - Add "New Project" option to sidebar project switcher
    - Connect form trigger to project creation workflow
    - ✅ **COMPLETED**: Ensure smooth project switching after creation
    - _Requirements: 1.1, 1.3_
    - _Note: Integrated into project switcher dropdown + dedicated page_

- [x] 10. Update dashboard components for project context
  - [x] 10.1 Update kanban board component
    - Filter articles by current project in kanban board
    - Update article creation to use project context
    - _Requirements: 2.3, 2.4_

  - [x] 10.2 Update article management components
    - Modify article listing and editing to use project context (show only articles for current project)
    - Update article generation components for project isolation (generate articles only for current project's website)
    - Ensure all article operations are scoped to currently selected project
    - _Requirements: 2.2, 2.3, 5.3_

  - [x] 10.3 Update settings components
    - Modify settings forms to work with project-specific data
    - Update webhook configuration UI for project context
    - _Requirements: 4.1, 4.2, 4.3_
  - [x] 10.4 Update generation hooks/components
    - Ensure all generation & scheduling hooks append current projectId (all articles tied to currently selected project)
    - Disable actions until project context resolved to avoid race conditions
    - Article generation is website-specific within the context of the selected project
    - _Requirements: 2.2, 2.3_
  - [x] 10.5 SSR layout pre-hydration
    - Dashboard layout reads cookie-selected project to prefetch data
    - Prevent flash of default project then switching client-side
    - _Requirements: 3.3, 5.1_

- [x] 11. Update onboarding flow for project creation
  - [x] 11.1 Modify onboarding to create default project
    - ✅ **COMPLETED**: Add project creation form (project name + website URL) to initial user onboarding flow
    - ✅ **COMPLETED**: Update onboarding completion to create user's first project based on form data
    - ✅ **COMPLETED**: Set created project as active project context immediately after creation
    - _Requirements: 7.1, 7.2_

  - [x] 11.2 Handle existing users without projects
    - ✅ **COMPLETED**: Add redirect logic for existing users who don't have any projects
    - ✅ **COMPLETED**: Prompt project creation using onboarding-style form for users missing projects
    - ✅ **COMPLETED**: Ensure these users can't access dashboard until they have at least one project
    - _Requirements: 7.3_
  - [x] 11.3 Onboarding sets project cookie
    - ✅ **COMPLETED**: After creating default project during onboarding, set cookie for SSR persistence
    - ✅ **COMPLETED**: Ensure seamless transition from onboarding to dashboard with correct project context
    - _Requirements: 7.1, 7.2_

- [x] 12. Implement project access control middleware
  - ✅ **COMPLETED**: Create middleware to validate user ownership of requested project
  - ✅ **COMPLETED**: Add project ownership verification to protected routes
  - ✅ **COMPLETED**: Implement automatic fallback to user's first project
  - _Requirements: 2.1, 2.2, 6.3_
  - [x] 12.4 Credits neutrality verification
    - ✅ **COMPLETED**: Confirm credit deduction logic remains user-scoped (no projectId filtering added)
    - ✅ **COMPLETED**: Add unit test simulating usage across two projects sharing balance
    - _Requirements: (Shared Credits)_

- [x] 13. Add project context indicators throughout UI
  - [x] 13.1 Update page headers and breadcrumbs
    - ✅ **COMPLETED**: Display current project context in page headers (show which website/project user is working on)
    - ✅ **COMPLETED**: Update breadcrumb navigation to show project context
    - ✅ **COMPLETED**: Clear indication that all displayed data is project-specific
    - _Requirements: 5.1, 5.2_

  - [x] 13.2 Add project confirmation in critical actions
    - ✅ **COMPLETED**: Show project context when creating or scheduling articles (confirm which website articles are for)
    - ✅ **COMPLETED**: Add project confirmation in publishing workflows
    - ✅ **COMPLETED**: Display website context for all article generation actions
    - _Requirements: 5.3, 5.4, 5.5_
