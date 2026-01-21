/**
 * Example Usage of MCP Connectors
 *
 * Demonstrates how to use Google Places and Playwright connectors together
 * in a "Find → Verify → Act" loop.
 */
/**
 * Example: Find top-rated coffee shop and book a meeting
 *
 * This demonstrates the orchestration flow:
 * 1. Google Places finds candidates
 * 2. Planner chooses top result
 * 3. Playwright opens site and finds booking form
 * 4. Human approves before submission
 */
export declare function findAndBookCoffeeShop(): Promise<void>;
/**
 * Example: Simple Google Places search
 */
export declare function simplePlacesSearch(): Promise<void>;
/**
 * Example: Read-only Playwright operations
 */
export declare function readOnlyBrowserOps(): Promise<void>;
//# sourceMappingURL=examples.d.ts.map