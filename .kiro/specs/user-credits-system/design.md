# Design Document

## Overview

The credits system is a simple usage tracking mechanism that provides new users with 3 free credits upon signup and deducts 1 credit for each successful article generation. This system uses a minimal database table and integrates with existing Clerk webhook and article generation workflows.

## Architecture

The credits system follows a simple architecture with three main integration points:

1. **Credit Allocation**: Clerk webhook handler creates credits when users sign up
2. **Credit Validation**: Article generation API checks credits before starting generation
3. **Credit Deduction**: Article generation API deducts credits upon successful completion
4. **Credit Display**: Dashboard components show current credit balance

## Components and Interfaces

### Database Schema

**Credits Table** (`contentbot.user_credits`)
```sql
CREATE TABLE contentbot.user_credits (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES contentbot.users(id),
  amount INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE UNIQUE INDEX idx_user_credits_user_id ON contentbot.user_credits(user_id);
```

### API Integration Points

**1. Clerk Webhook Handler** (`/api/webhooks/clerk`)
- Extends existing `user.created` case to create credits record
- Creates 3 credits for new users atomically with user creation

**2. Article Generation API** (`/api/articles/generate`)
- Adds credit validation before starting generation process
- Deducts 1 credit after successful completion (when status becomes "completed")
- Returns appropriate error if insufficient credits

**3. Credits Query Functions**
- `getUserCredits(userId: string): Promise<number>` - Get current credit balance
- `deductCredit(userId: string): Promise<boolean>` - Atomically deduct 1 credit
- `hasCredits(userId: string): Promise<boolean>` - Check if user has credits

### UI Components

**Credit Balance Display**
- Shows current credit count in dashboard header or sidebar
- Updates when credits change
- Shows "0 credits remaining" message when depleted

**Credit Validation Messages**
- Error message when attempting generation without credits
- Clear indication of credit requirement for article generation

## Data Models

### Credits Schema (Drizzle)
```typescript
export const userCredits = contentbotSchema.table("user_credits", {
  id: serial("id").primaryKey(),
  user_id: text("user_id")
    .references(() => users.id)
    .notNull(),
  amount: integer("amount").default(0).notNull(),
  created_at: timestamp("created_at", { withTimezone: true })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updated_at: timestamp("updated_at", { withTimezone: true })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull()
    .$onUpdate(() => new Date()),
});
```

### Credit Operations Interface
```typescript
interface CreditOperations {
  getUserCredits(userId: string): Promise<number>;
  deductCredit(userId: string): Promise<boolean>;
  hasCredits(userId: string): Promise<boolean>;
  addCredits(userId: string, amount: number): Promise<void>;
}
```

## Error Handling

### Credit Validation Errors
- **Insufficient Credits**: Return 402 Payment Required with clear message
- **Credit Check Failure**: Log error but allow generation to proceed (fail open)
- **Credit Deduction Failure**: Log error but don't fail the generation

### Database Transaction Safety
- Use database transactions for credit operations to prevent race conditions
- Implement optimistic locking for concurrent credit deductions
- Handle cases where credits record doesn't exist (create with 0 credits)

### Fallback Behavior
- If credits system fails, log error and allow generation (fail open approach)
- Ensure credits system never blocks core functionality
- Provide clear error messages to users when credits are exhausted

## Testing Strategy

### Unit Tests
- Credit allocation on user creation
- Credit deduction on successful generation
- Credit validation before generation
- Error handling for edge cases

### Integration Tests
- End-to-end user signup to credit allocation
- Article generation with credit deduction
- Credit exhaustion preventing generation
- Webhook failure scenarios

### Edge Cases
- Concurrent article generations by same user
- User deletion with existing credits
- Database connection failures during credit operations
- Race conditions in credit deduction

## Implementation Considerations

### Performance
- Single query to check credits before generation
- Atomic credit deduction using database constraints
- Minimal impact on existing generation workflow

### Security
- Credits tied to authenticated user sessions
- No client-side credit manipulation possible
- Server-side validation for all credit operations

### Scalability
- Simple integer operations scale well
- Single table with user_id index for fast lookups
- No complex credit calculations or history tracking needed

### Migration Strategy
- Add credits table via Drizzle migration
- Backfill existing users with 0 credits (they've already used the system)
- New users get 3 credits automatically via webhook