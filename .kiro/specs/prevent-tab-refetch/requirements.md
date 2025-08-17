# Requirements Document

## Introduction

The dashboard currently refetches data every time users switch browser tabs or return to the application tab, causing unnecessary API calls and poor user experience. This feature will eliminate automatic refetching on tab focus/visibility changes and only fetch data on initial page load or explicit user actions.

## Requirements

### Requirement 1

**User Story:** As a user, I want the dashboard to not refetch data when I switch browser tabs, so that I don't experience unnecessary loading states and API calls.

#### Acceptance Criteria

1. WHEN a user switches away from the dashboard tab and returns THEN the system SHALL NOT automatically refetch any data
2. WHEN a user opens the dashboard for the first time in a session THEN the system SHALL fetch all necessary data once
3. WHEN data fetching is in progress and user switches tabs THEN the system SHALL continue the fetch but not restart it on tab return
4. WHEN a user explicitly clicks refresh buttons or similar actions THEN the system SHALL fetch fresh data

### Requirement 2

**User Story:** As a user, I want my data to remain stable while I work across multiple tabs, so that my workflow is not interrupted by loading states.

#### Acceptance Criteria

1. WHEN a user has loaded dashboard data THEN the data SHALL persist in memory until explicitly refreshed
2. WHEN a user switches tabs multiple times THEN the same cached data SHALL be displayed without refetching
3. WHEN a user performs actions that modify data THEN only those specific changes SHALL trigger targeted updates
4. WHEN cached data exists THEN it SHALL be displayed immediately without loading states

### Requirement 3

**User Story:** As a developer, I want to remove tab visibility and focus event listeners that trigger data fetching, so that the application only fetches data when necessary.

#### Acceptance Criteria

1. WHEN the OnboardingChecker component mounts THEN it SHALL only check onboarding status once per session
2. WHEN the ProjectProvider initializes THEN it SHALL only load projects on first mount, not on subsequent mounts
3. WHEN the CreditProvider loads THEN it SHALL only fetch credits on initial load, not on tab focus
4. WHEN any component uses useEffect for data fetching THEN it SHALL NOT include dependencies that trigger on tab switches

### Requirement 4

**User Story:** As a user, I want explicit control over when data is refreshed, so that I can choose when to get fresh data.

#### Acceptance Criteria

1. WHEN a user wants fresh data THEN they SHALL use explicit refresh buttons or actions
2. WHEN a user performs data-modifying actions THEN the system SHALL update only the affected data
3. WHEN a user navigates to different pages THEN the system SHALL only fetch page-specific data if not already cached
4. WHEN a user logs out and back in THEN the system SHALL clear all cached data and fetch fresh data