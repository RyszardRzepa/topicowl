# Data Migration: User-Centric to Project-Centric Architecture

This directory contains data migration scripts that transform the existing user-centric architecture to a project-centric one.

## Migration Scripts

### 1. Main Migration Script (`migrate-to-projects.ts`)
- Uses the existing application database configuration
- Requires full environment setup
- Integrated with the app's schema and environment validation

### 2. Standalone Migration Script (`migrate-to-projects-standalone.ts`)
- Self-contained with inline schema definitions
- Only requires DATABASE_URL environment variable
- Can be run independently without full app setup

## Migration Overview

Both migration scripts perform the following operations:

### 1. Create Default Projects (Task 3.1)
- Creates one project per existing user using their current domain
- Migrates user-specific settings to project settings
- Uses company name or user's full name as project name
- Extracts domain from user's domain field for website URL

### 2. Migrate Article Data (Task 3.2)
- Updates all articles to reference the user's default project
- Updates generation_queue records with project references
- Updates article_generation records with project references

### 3. Migrate Settings and Webhooks (Task 3.3)
- Moves webhook settings from users table to projects table
- Updates article_settings to reference projects (if any exist)
- Migrates webhook_deliveries to reference projects

## Running the Migration

### Prerequisites
1. Ensure all schema migrations are applied: `npm run db:migrate`
2. Backup your database before running the migration
3. Ensure the application is not running during migration

### Option 1: Full Environment Migration
```bash
npm run db:migrate-data
```

### Option 2: Standalone Migration (Recommended)
```bash
DATABASE_URL="your_database_url_here" npm run db:migrate-data-standalone
```

### Verification
Both scripts include built-in validation that checks:
- All articles have project_id references
- All generation queue items have project_id references
- All article generations have project_id references
- All webhook deliveries have project_id references
- Project count matches user count

## Migration Safety

The scripts are designed to be:
- **Idempotent**: Can be run multiple times safely
- **Transactional**: Uses database transactions where possible
- **Validated**: Includes comprehensive validation checks
- **Logged**: Provides detailed progress and error logging

## Rollback

If you need to rollback:
1. Restore from your database backup
2. Or manually remove the created projects and reset project_id fields to NULL

## Project Structure After Migration

Each user will have:
- One default project with their company/personal name
- All existing articles linked to this project
- All webhook configurations moved to the project level
- All generation history linked to the project
