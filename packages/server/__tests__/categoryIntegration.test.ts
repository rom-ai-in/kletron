// packages/server/__tests__/categoryIntegration.test.ts
import { describe, it, expect } from "vitest";
import { CategoryWorkflowRunner } from "@kletron/agent-core/categoryWorkflowRunner";

describe("Category Integration", () => {
  it("should route messages to code vs work", () => {
    const runner = CategoryWorkflowRunner.getInstance();

    const cases = [
      { message: "How do I implement authentication in React?", expected: "code" as const },
      { message: "Write a user manual for this software", expected: "work" as const },
      { message: "Create an automation to send daily reports", expected: "work" as const },
      { message: "What is the weather today?", expected: "work" as const },
    ];

    for (const c of cases) {
      expect(runner.determineCategory(c.message)).toBe(c.expected);
    }
  });

  it("should handle empty message gracefully", () => {
    const runner = CategoryWorkflowRunner.getInstance();
    const result = runner.determineCategory("");
    expect(result === "code" || result === "work").toBe(true);
  });
});
