# Requirements Document

## Introduction

This feature implements a simple credits system for Contentbot that provides new users with 3 free credits upon signup and deducts 1 credit for each successful article generation. This allows users to test the article generation service before committing to a paid plan.

## Requirements

### Requirement 1

**User Story:** As a new user, I want to receive 3 free credits when I sign up, so that I can test the article generation service without immediate payment.

#### Acceptance Criteria

1. WHEN a new user completes signup through Clerk THEN the system SHALL create a credits record with 3 credits for that user
2. WHEN the Clerk webhook receives a user.created event THEN the system SHALL insert a new record in the credits table with userId and amount set to 3
3. IF the credits record creation fails THEN the system SHALL log the error and continue processing the webhook

### Requirement 2

**User Story:** As a user, I want my credits to be deducted when I successfully generate an article, so that the system tracks my usage accurately.

#### Acceptance Criteria

1. WHEN an article generation completes successfully THEN the system SHALL deduct 1 credit from the user's account
2. WHEN a user's credits reach 0 THEN the system SHALL prevent further article generation attempts
3. IF a user has insufficient credits THEN the system SHALL return an appropriate error message before starting generation
4. WHEN credits are deducted THEN the system SHALL update the credits table atomically to prevent race conditions

### Requirement 3

**User Story:** As a user, I want to see my current credit balance, so that I know how many article generations I have remaining.

#### Acceptance Criteria

1. WHEN a user views their dashboard THEN the system SHALL display their current credit balance
2. WHEN a user's credit balance changes THEN the displayed balance SHALL update accordingly
3. IF a user has 0 credits THEN the system SHALL display a message indicating they need to purchase more credits

### Requirement 4

**User Story:** As a system administrator, I want the credits system to be simple and reliable, so that it doesn't interfere with core functionality.

#### Acceptance Criteria

1. WHEN the credits table is created THEN it SHALL contain only userId and amount fields plus standard timestamps
2. WHEN credit operations occur THEN they SHALL use database transactions to ensure data consistency
3. IF credit-related operations fail THEN they SHALL not prevent other system functions from working
4. WHEN querying credits THEN the system SHALL handle cases where no credits record exists for a user