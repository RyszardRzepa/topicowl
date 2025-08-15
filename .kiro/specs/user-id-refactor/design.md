# Design Document

## Overview

This design outlines the refactoring of the user system to use Clerk's user ID directly as the primary key in the users table. This change eliminates the need for a separate `clerk_user_id` column and simplifies all user-related database operations by ensuring direct synchronization with Clerk authentication.

## Architecture

### Current State
- Users table has an auto-generated `id` (text) as primary key
- Separate `clerk_user_id` column stores Clerk's user ID
- All foreign key relationships reference the auto-generated `id`
- API routes perform lookups using `clerk_user_id` to find the internal `id`

### Target State
- Users table uses Clerk's user ID directly as the primary key (`id`)
- No separate `clerk_user_id` column needed
- All foreign key relationships reference Clerk's user ID directly
- API routes query users directly by Clerk user ID without additional lookups

## Components and Interfaces

### Database Schema Changes

#### Users Table
```typescript
// Before
export const users = contentbotSchema.table("users", {
  id: text("id").primaryKey().default(generatePublicId()),
  clerk_user_id: text("clerk_user_id").unique().notNull(),
  // ... other fields
});

// After
export const users = contentbotSchema.table("users", {
  id: text("id").primaryKey(), // No default, will use Clerk user ID
  // clerk_user_id removed
  // ... other fields
});
```

#### Foreign Key Tables
All tables with foreign key references to users will be updated:
- `articles.user_id` - references Clerk user ID
- `userCredits.userId` - references Clerk user ID  
- `generationQueue.user_id` - references Clerk user ID
- `articleGeneration.userId` - references Clerk user ID
- `articleSettings.user_id` - references Clerk user ID
- `webhookDeliveries.user_id` - references Clerk user ID

### API Route Changes

#### User Lookup Pattern
```typescript
// Before
const user = await db
  .select({ id: users.id })
  .from(users)
  .where(eq(users.clerk_user_id, clerkUserId))
  .limit(1);

// After
const user = await db
  .select({ id: users.id })
  .from(users)
  .where(eq(users.id, clerkUserId))
  .limit(1);
```

#### Clerk Webhook Changes
```typescript
// Before
await db.insert(users).values({
  clerk_user_id: userData.id,
  email: userData.email,
  // ... other fields
});

// After
await db.insert(users).values({
  id: userData.id, // Use Clerk user ID as primary key
  email: userData.email,
  // ... other fields
});
```

## Data Models

### Migration Strategy

The migration will follow this sequence:

1. **Add new id column** (temporary) to store Clerk user IDs
2. **Populate new column** with Clerk user IDs from existing records
3. **Update foreign key tables** to reference new IDs
4. **Drop old constraints** and rename columns
5. **Update primary key** to use Clerk user ID
6. **Remove clerk_user_id column**

### Data Integrity Considerations

- All existing user records must have valid Clerk user IDs
- Foreign key relationships must be preserved during migration
- Migration must be atomic to prevent data corruption
- Rollback strategy needed in case of migration failure

## Error Handling

### Migration Errors
- **Missing Clerk user IDs**: Migration will fail if any user record lacks a valid clerk_user_id
- **Foreign key violations**: Migration will validate all relationships before making changes
- **Constraint violations**: New primary key constraints will be validated before applying

### Runtime Errors
- **User not found**: API routes will return 404 when Clerk user ID doesn't exist in database
- **Authentication mismatch**: Ensure Clerk user ID from auth matches database records
- **Webhook failures**: Enhanced error handling for user creation/update/deletion events

## Testing Strategy

### Unit Tests
- Test database schema changes with sample data
- Test API route user lookup functionality
- Test Clerk webhook user operations
- Test foreign key relationship integrity

### Integration Tests
- Test complete user creation flow from Clerk webhook to database
- Test user data retrieval across all API endpoints
- Test user deletion cascade behavior
- Test migration rollback scenarios

### Data Migration Tests
- Test migration with existing production-like data
- Test foreign key preservation during migration
- Test rollback scenarios
- Validate data integrity before and after migration

### Performance Considerations
- Direct user lookups by Clerk ID will be faster (no join needed)
- Reduced storage overhead (one less column per user)
- Simplified query patterns across all API routes
- Better indexing strategy with single user identifier