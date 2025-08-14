# Requirements Document

## Introduction

The current Reddit integration is user-level, meaning one Reddit account is connected per user across all their projects. This creates limitations when users want to manage multiple projects with different Reddit accounts or when they want to research content from different Reddit perspectives for different brands/projects. This feature will refactor the Reddit integration to be project-specific, allowing users to connect different Reddit accounts to different projects and maintain separate Reddit contexts for each project.

## Requirements

### Requirement 1

**User Story:** As a user with multiple projects, I want to connect different Reddit accounts to different projects, so that I can research content and manage Reddit integrations separately for each brand/project.

#### Acceptance Criteria

1. WHEN a user navigates to Reddit settings for a specific project THEN the system SHALL display the Reddit connection status for that project only
2. WHEN a user connects a Reddit account THEN the system SHALL associate that Reddit account with the currently selected project
3. WHEN a user switches projects THEN the system SHALL display the Reddit connection status specific to the selected project
4. IF a user has connected Reddit to Project A but not Project B THEN switching to Project B SHALL show Reddit as disconnected

### Requirement 2

**User Story:** As a user, I want to authenticate with Reddit on a per-project basis, so that each project can have its own Reddit account and access permissions.

#### Acceptance Criteria

1. WHEN a user initiates Reddit authentication THEN the system SHALL include the current project ID in the authentication flow
2. WHEN Reddit OAuth callback is received THEN the system SHALL store the access token and refresh token associated with the specific project
3. WHEN storing Reddit tokens THEN the system SHALL encrypt and securely store the refresh token in the database linked to the project
4. IF a project already has a Reddit connection THEN connecting a new Reddit account SHALL replace the existing connection for that project only

### Requirement 3

**User Story:** As a user, I want to disconnect Reddit from a specific project, so that I can manage Reddit connections independently per project without affecting other projects.

#### Acceptance Criteria

1. WHEN a user disconnects Reddit from a project THEN the system SHALL remove only the Reddit connection for that specific project
2. WHEN disconnecting Reddit THEN the system SHALL revoke the Reddit access token for that project
3. WHEN disconnecting Reddit THEN the system SHALL remove all stored Reddit tokens and user data for that project
4. IF other projects have Reddit connections THEN disconnecting from one project SHALL NOT affect other projects' Reddit connections

### Requirement 4

**User Story:** As a user, I want to fetch Reddit data (posts, subreddits, user info) specific to each project's connected Reddit account, so that content research and Reddit features work with the appropriate Reddit context for each project.

#### Acceptance Criteria

1. WHEN fetching Reddit posts for a project THEN the system SHALL use the Reddit access token associated with that specific project
2. WHEN Reddit API calls are made THEN the system SHALL automatically refresh expired tokens using the project-specific refresh token
3. WHEN a project has no Reddit connection THEN Reddit API endpoints SHALL return appropriate error responses indicating no connection
4. WHEN Reddit token refresh fails THEN the system SHALL mark the project's Reddit connection as expired and require re-authentication

### Requirement 5

**User Story:** As a developer, I want the database schema to support project-specific Reddit connections, so that Reddit authentication data is properly isolated per project.

#### Acceptance Criteria

1. WHEN the database schema is updated THEN there SHALL be a new table or fields to store Reddit connection data per project
2. WHEN storing Reddit tokens THEN the system SHALL associate access tokens, refresh tokens, and Reddit user data with specific project IDs
3. WHEN querying Reddit data THEN the system SHALL use project ID as a filter to ensure data isolation
4. IF existing user-level Reddit connections exist THEN the migration SHALL handle the transition appropriately

### Requirement 6

**User Story:** As a user, I want existing Reddit API endpoints to work seamlessly with project-specific connections, so that all current Reddit features continue to function with the new project-based approach.

#### Acceptance Criteria

1. WHEN calling existing Reddit API endpoints THEN the system SHALL automatically use the current project's Reddit connection
2. WHEN Reddit API responses are returned THEN they SHALL contain data specific to the project's connected Reddit account
3. WHEN project context is missing from Reddit API calls THEN the system SHALL return appropriate error responses
4. IF a Reddit API call is made for a project without Reddit connection THEN the system SHALL return a clear error indicating authentication is required