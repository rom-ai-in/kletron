// packages/agent-core/__tests__/categoryWorkflowRunner.test.ts
import { describe, it, expect, beforeAll } from "vitest";
import { CategoryWorkflowRunner } from "../src/categoryWorkflowRunner";

describe("CategoryWorkflowRunner", () => {
  let runner: CategoryWorkflowRunner;

  beforeAll(() => {
    runner = CategoryWorkflowRunner.getInstance();
  });

  describe("determineCategory", () => {
    it("should map bug-fix message to code", () => {
      const result = runner.determineCategory("How do I fix this bug in the code?");
      expect(result).toBe("code");
    });

    it("should map report writing to work", () => {
      const result = runner.determineCategory("Write a report about the project status");
      expect(result).toBe("work");
    });
  });

  describe("buildCategorySystemPrompt", () => {
    it("should build prompt for code mode", () => {
      const prompt = runner.buildCategorySystemPrompt("code", []);
      expect(prompt.length).toBeGreaterThan(0);
      expect(prompt.toLowerCase()).toMatch(/code|engineer|software/);
    });

    it("should build prompt for work mode", () => {
      const prompt = runner.buildCategorySystemPrompt("work", []);
      expect(prompt.length).toBeGreaterThan(0);
    });

    it("should accept legacy coding alias", () => {
      const prompt = runner.buildCategorySystemPrompt("coding", []);
      expect(prompt.length).toBeGreaterThan(0);
    });
  });
});
