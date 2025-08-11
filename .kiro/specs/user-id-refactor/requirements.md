# Requirements Document

## Introduction

This feature refactors the user system to use Clerk's user ID directly as the primary key in the users table, eliminating the need for a separate `clerk_user_id` column. This simplifies the data model and ensures direct synchronization between our user records and Clerk authentication.

## Requirements

### Requirement 1

**User Story:** As a developer, I want to use Clerk's user ID as the primary key in our users table, so that I can simplify database queries and eliminate the need for a separate clerk_user_id column.

#### Acceptance Criteria

1. WHEN the users table is updated THEN the id column SHALL use Clerk's user ID as the primary key
2. WHEN the clerk_user_id column is removed THEN all foreign key references SHALL be updated to use the new id structure
3. WHEN API routes query for users THEN they SHALL use the Clerk user ID directly without additional lookups
4. WHEN the Clerk webhook creates a user THEN it SHALL use the Clerk user ID as the primary key

### Requirement 2

**User Story:** As a developer, I want all foreign key relationships to reference the new user ID structure, so that data integrity is maintained across all tables.

#### Acceptance Criteria

1. WHEN articles table references users THEN it SHALL use the Clerk user ID in user_id column
2. WHEN userCredits table references users THEN it SHALL use the Clerk user ID in userId column
3. WHEN generationQueue table references users THEN it SHALL use the Clerk user ID in user_id column
4. WHEN articleGeneration table references users THEN it SHALL use the Clerk user ID in userId column
5. WHEN articleSettings table references users THEN it SHALL use the Clerk user ID in user_id column
6. WHEN webhookDeliveries table references users THEN it SHALL use the Clerk user ID in user_id column

### Requirement 3

**User Story:** As a developer, I want all API routes to be updated to use the new user ID structure, so that user data is fetched correctly without breaking existing functionality.

#### Acceptance Criteria

1. WHEN API routes need to find a user THEN they SHALL query directly by id using the Clerk user ID
2. WHEN API routes create user records THEN they SHALL use the Clerk user ID as the primary key
3. WHEN API routes update user records THEN they SHALL reference users by the Clerk user ID
4. WHEN API routes delete user records THEN they SHALL reference users by the Clerk user ID
5. WHEN the Clerk webhook processes user events THEN it SHALL use the Clerk user ID directly

### Requirement 4

**User Story:** As a developer, I want the database migration to be safe and preserve existing data, so that no user data is lost during the refactoring process.

#### Acceptance Criteria

1. WHEN the migration runs THEN existing user data SHALL be preserved
2. WHEN foreign key relationships are updated THEN existing article and credit data SHALL remain linked to the correct users
3. WHEN the migration completes THEN all data integrity constraints SHALL be maintained
4. WHEN the migration fails THEN it SHALL be rollback-safe without data corruption