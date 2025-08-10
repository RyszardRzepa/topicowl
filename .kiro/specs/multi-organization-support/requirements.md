# Requirements Document

## Introduction

This feature introduces multi-project support to Contentbot, allowing users to manage multiple websites and content projects from a single account. Each project will have its own unique website URL, settings, articles, and content generation workflows, providing complete isolation between different projects while maintaining a unified user experience.

## Requirements

### Requirement 1

**User Story:** As a content manager, I want to create multiple projects so that I can manage content for different websites or clients from one account.

#### Acceptance Criteria

1. WHEN a user clicks "New Project" in the sidebar settings THEN the system SHALL display a modal form for creating a new project
2. WHEN a user submits the project creation form with a valid website URL THEN the system SHALL create a new project record and associate it with the current user
3. WHEN a user creates a new project THEN the system SHALL automatically switch the user's context to the new project
4. WHEN a user has multiple projects THEN the system SHALL display a project selector in the dashboard header

### Requirement 2

**User Story:** As a user with multiple websites, I want each project to have its own isolated data so that content and settings don't mix between different projects.

#### Acceptance Criteria

1. WHEN a user switches between projects THEN the system SHALL display only articles, settings, and data belonging to the selected project
2. WHEN a user generates content THEN the system SHALL associate all generated articles with the currently selected project
3. WHEN a user modifies settings THEN the system SHALL update only the settings for the currently selected project
4. WHEN a user views the kanban board THEN the system SHALL show only articles from the currently selected project

### Requirement 3

**User Story:** As a user, I want to easily switch between my projects so that I can quickly manage content for different websites.

#### Acceptance Criteria

1. WHEN a user has multiple projects THEN the system SHALL display a project switcher in the main navigation
2. WHEN a user selects a different project from the switcher THEN the system SHALL update the entire dashboard context without requiring a page reload
3. WHEN a user switches projects THEN the system SHALL remember their selection for future sessions
4. WHEN a user switches projects THEN the system SHALL update the browser URL to reflect the current project context

### Requirement 4

**User Story:** As a user, I want to manage project settings independently so that each website can have its own configuration and branding.

#### Acceptance Criteria

1. WHEN a user accesses settings THEN the system SHALL display settings specific to the currently selected project
2. WHEN a user updates webhook settings THEN the system SHALL apply changes only to the current project
3. WHEN a user configures article generation settings THEN the system SHALL store settings per project
4. WHEN a user sets up excluded domains THEN the system SHALL maintain separate blacklists for each project

### Requirement 5

**User Story:** As a user, I want to see which project I'm currently working with so that I don't accidentally create content for the wrong website.

#### Acceptance Criteria

1. WHEN a user is in any dashboard view THEN the system SHALL clearly display the current project name and website URL
2. WHEN a user creates or edits articles THEN the system SHALL show the target project context
3. WHEN a user generates article ideas THEN the system SHALL indicate which project the ideas are being generated for
4. WHEN a user schedules content THEN the system SHALL confirm the target project before scheduling

### Requirement 6

**User Story:** As a user, I want to delete projects I no longer need so that I can keep my account organized.

#### Acceptance Criteria

1. WHEN a user attempts to delete a project THEN the system SHALL display a confirmation dialog warning about data loss
2. WHEN a user confirms project deletion THEN the system SHALL permanently remove all associated articles, settings, and data
3. WHEN a user deletes their currently selected project THEN the system SHALL automatically switch to another project or prompt to create a new one
4. WHEN a user has only one project THEN the system SHALL prevent deletion and display an appropriate message

### Requirement 7

**User Story:** As a new user, I want the onboarding process to create my first project automatically so that I can start using the platform immediately.

#### Acceptance Criteria

1. WHEN a new user completes onboarding THEN the system SHALL create a default project using their provided website URL
2. WHEN a new user's first project is created THEN the system SHALL set it as their active project
3. WHEN an existing user without projects logs in THEN the system SHALL redirect them to create their first project
4. WHEN a user completes the website analysis during onboarding THEN the system SHALL associate the analysis results with their default project