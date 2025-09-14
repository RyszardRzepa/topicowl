/**
 * Centralized credit cost definitions for all platform operations
 * This ensures consistent pricing across the application and makes it easy to update costs
 * 
 * Usage Examples:
 * - Check if user has enough credits: hasEnoughCreditsForOperation(userCredits, "ARTICLE_GENERATION")
 * - Get cost for operation: getCreditCost("ARTICLE_IDEAS")  
 * - Get error message: getInsufficientCreditsMessage("REDDIT_TASKS")
 * - Use in UI: CREDIT_COSTS.ARTICLE_GENERATION
 * 
 * To add a new operation:
 * 1. Add the cost constant to CREDIT_COSTS
 * 2. Add the user-friendly name to operationNames in getInsufficientCreditsMessage
 * 3. Update any UI components that display pricing information
 */

export const CREDIT_COSTS = {
  /** Cost for generating a full article (10 credits) */
  ARTICLE_GENERATION: 10,
  /** Cost for generating article ideas (5 credits) */
  ARTICLE_IDEAS: 5,
  /** Cost for generating Reddit tasks (5 credits) */
  REDDIT_TASKS: 5,
} as const;

/**
 * Get the credit cost for a specific operation
 * @param operation - The operation type
 * @returns The number of credits required
 */
export function getCreditCost(operation: keyof typeof CREDIT_COSTS): number {
  return CREDIT_COSTS[operation];
}

/**
 * Get user-friendly error messages for insufficient credits
 * @param operation - The operation type
 * @returns Formatted error message
 */
export function getInsufficientCreditsMessage(
  operation: keyof typeof CREDIT_COSTS
): string {
  const required = CREDIT_COSTS[operation];
  
  const operationNames = {
    ARTICLE_GENERATION: "generate an article",
    ARTICLE_IDEAS: "generate article ideas", 
    REDDIT_TASKS: "generate Reddit tasks",
  } as const;
  
  return `Insufficient credits. You need at least ${required} credits to ${operationNames[operation]}.`;
}

/**
 * Check if user has enough credits for an operation
 * @param currentCredits - User's current credit balance
 * @param operation - The operation type
 * @returns True if user has enough credits
 */
export function hasEnoughCreditsForOperation(
  currentCredits: number,
  operation: keyof typeof CREDIT_COSTS
): boolean {
  return currentCredits >= CREDIT_COSTS[operation];
}