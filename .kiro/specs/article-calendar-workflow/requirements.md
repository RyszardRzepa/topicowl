# Requirements Document

## Introduction

This feature will transform the current article workflow from a tab-based interface to a unified calendar-based interface similar to the existing Reddit tasks calendar. The calendar will provide a visual, time-based approach to managing article creation, generation scheduling, and publishing, making it easier for users to plan and coordinate their content strategy across time.

## Requirements

### Requirement 1

**User Story:** As a content manager, I want to view all my articles in a calendar format, so that I can visualize my content pipeline across time and better plan my publishing schedule.

#### Acceptance Criteria

1. WHEN I navigate to the articles dashboard THEN the system SHALL display a weekly calendar view as the primary interface
2. WHEN I view the calendar THEN the system SHALL show articles positioned at their scheduled times (generation or publishing dates)
3. WHEN I view the calendar THEN the system SHALL display different visual indicators for articles in different workflow phases (planning, generating, publishing)
4. WHEN I view the calendar THEN the system SHALL show time slots from 12 AM to 11:59 PM for each day of the week
5. WHEN I view the calendar THEN the system SHALL display the current week by default with navigation controls to move between weeks

### Requirement 2

**User Story:** As a content creator, I want to click on any time slot in the calendar to create a new article idea, so that I can quickly plan content for specific dates and times.

#### Acceptance Criteria

1. WHEN I click on an empty time slot THEN the system SHALL open a new article creation form
2. WHEN I create an article from a time slot THEN the system SHALL pre-populate the scheduled date and time based on the clicked slot
3. WHEN I create an article THEN the system SHALL allow me to specify the article title, keywords, notes, and target audience
4. WHEN I create an article THEN the system SHALL save it with "idea" status and the selected scheduled time
5. WHEN I create an article THEN the system SHALL immediately display it in the calendar at the selected time slot

### Requirement 3

**User Story:** As a content manager, I want to drag and drop articles between different time slots, so that I can easily reschedule content generation or publishing times.

#### Acceptance Criteria

1. WHEN I drag an article from one time slot to another THEN the system SHALL update the article's scheduled time accordingly
2. WHEN I drag an article THEN the system SHALL provide visual feedback showing the target time slot
3. WHEN I drop an article in a new time slot THEN the system SHALL save the new schedule to the database
4. WHEN I drag an article THEN the system SHALL prevent dropping on invalid time slots (e.g., past dates for future scheduling)
5. WHEN I complete a drag operation THEN the system SHALL show a success confirmation

### Requirement 4

**User Story:** As a content creator, I want to see different visual representations for articles in different workflow phases, so that I can quickly understand the status of each piece of content.

#### Acceptance Criteria

1. WHEN I view articles in the calendar THEN the system SHALL display "idea" status articles with a distinct color and icon
2. WHEN I view articles in the calendar THEN the system SHALL display "generating" status articles with a progress indicator and distinct color
3. WHEN I view articles in the calendar THEN the system SHALL display "wait_for_publish" status articles with a distinct color indicating readiness
4. WHEN I view articles in the calendar THEN the system SHALL display "published" status articles with a distinct color and published indicator
5. WHEN I view articles in the calendar THEN the system SHALL display scheduled articles with a clock icon and scheduled time

### Requirement 5

**User Story:** As a content manager, I want to click on any article in the calendar to view its details and perform actions, so that I can manage individual articles without leaving the calendar view.

#### Acceptance Criteria

1. WHEN I click on an article in the calendar THEN the system SHALL open a detailed modal with article information
2. WHEN I view an article modal THEN the system SHALL display the article title, content, status, and metadata
3. WHEN I view an article modal THEN the system SHALL provide action buttons appropriate to the article's current status
4. WHEN an article is in "idea" status THEN the system SHALL provide "Generate Now" and "Schedule Generation" actions
5. WHEN an article is in "wait_for_publish" status THEN the system SHALL provide "Publish Now" and "Schedule Publishing" actions
6. WHEN I perform actions in the modal THEN the system SHALL update the calendar view immediately

### Requirement 6

**User Story:** As a content creator, I want to schedule article generation for specific times, so that I can plan when AI will create content and manage my credit usage efficiently.

#### Acceptance Criteria

1. WHEN I schedule article generation THEN the system SHALL allow me to select a specific date and time
2. WHEN I schedule generation THEN the system SHALL update the article's generationScheduledAt field
3. WHEN I schedule generation THEN the system SHALL move the article to the scheduled time slot in the calendar
4. WHEN generation time arrives THEN the system SHALL automatically start the generation process
5. WHEN generation completes THEN the system SHALL move the article to the appropriate status and time slot

### Requirement 7

**User Story:** As a content manager, I want to schedule article publishing for specific times, so that I can coordinate content releases with my marketing strategy.

#### Acceptance Criteria

1. WHEN I schedule article publishing THEN the system SHALL allow me to select a specific date and time
2. WHEN I schedule publishing THEN the system SHALL update the article's publishScheduledAt field
3. WHEN I schedule publishing THEN the system SHALL move the article to the scheduled time slot in the calendar
4. WHEN publishing time arrives THEN the system SHALL automatically publish the article
5. WHEN publishing completes THEN the system SHALL move the article to the published status

### Requirement 8

**User Story:** As a content creator, I want to generate multiple article ideas for a week, so that I can quickly populate my content calendar with AI-suggested topics.

#### Acceptance Criteria

1. WHEN I click "Generate Ideas for Week" THEN the system SHALL create multiple article ideas based on my project settings
2. WHEN ideas are generated THEN the system SHALL distribute them across available time slots in the current week
3. WHEN ideas are generated THEN the system SHALL use my project's keywords and target audience for relevant suggestions
4. WHEN ideas are generated THEN the system SHALL create articles with "idea" status that I can further customize
5. WHEN ideas are generated THEN the system SHALL display them immediately in the calendar view

### Requirement 9

**User Story:** As a content manager, I want to navigate between different weeks in the calendar, so that I can plan content for future periods and review past content performance.

#### Acceptance Criteria

1. WHEN I click the "Previous Week" button THEN the system SHALL navigate to the previous week and load relevant articles
2. WHEN I click the "Next Week" button THEN the system SHALL navigate to the next week and load relevant articles
3. WHEN I click the "Today" button THEN the system SHALL navigate to the current week
4. WHEN I navigate between weeks THEN the system SHALL maintain the calendar view and load articles for the selected week
5. WHEN I navigate between weeks THEN the system SHALL update the week display header to show the current week range

### Requirement 10

**User Story:** As a content creator, I want to see overlapping articles in the same time slot handled gracefully, so that I can manage multiple pieces of content scheduled for similar times.

#### Acceptance Criteria

1. WHEN multiple articles are scheduled for the same time slot THEN the system SHALL display them in a stacked/overlapped layout
2. WHEN articles overlap THEN the system SHALL ensure all articles remain clickable and accessible
3. WHEN articles overlap THEN the system SHALL provide visual indicators showing the number of articles in that slot
4. WHEN I hover over overlapped articles THEN the system SHALL highlight the specific article being targeted
5. WHEN articles overlap THEN the system SHALL maintain proper z-index ordering for interaction