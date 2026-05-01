// packages/server/__tests__/categoryIntegration.test.ts
import { describe, it, expect } from "vitest";
import { CategoryWorkflowRunner } from "@kletron/agent-core/categoryWorkflowRunner";
import { BUILT_IN_CATEGORIES } from "@kletron/shared/types";

describe("Category Integration", () => {
  it("should correctly route messages to appropriate categories", async () => {
    const runner = CategoryWorkflowRunner.getInstance();
    
    // Test various message types
    const testCases = [
      {
        message: "How do I implement authentication in React?",
        expectedCategory: "coding"
      },
      {
        message: "Write a user manual for this software",
        expectedCategory: "drafting"
      },
      {
        message: "Create an automation to send daily reports",
        expectedCategory: "automation"
      },
      {
        message: "What is the weather today?",
        expectedCategory: "coding" // Default fallback
      }
    ];
    
    const categories = Object.entries(BUILT_IN_CATEGORIES).map(([id, config]) => ({
      id,
      ...config
    }));
    
    for (const testCase of testCases) {
      const result = await runner.determineCategory(testCase.message, categories);
      expect(result.id).toBe(testCase.expectedCategory);
    }
  });

  it("should handle empty message gracefully", async () => {
    const runner = CategoryWorkflowRunner.getInstance();
    
    const categories = Object.entries(BUILT_IN_CATEGORIES).map(([id, config]) => ({
      id,
      ...config
    }));
    
    const result = await runner.determineCategory("", categories);
    expect(result.id).toBeDefined(); // Should return some default category
  });
});