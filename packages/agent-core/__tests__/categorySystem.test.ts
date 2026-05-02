// packages/agent-core/__tests__/categorySystem.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { CategoryAwareRouter } from "../src/categoryRouter";
import { CategoryPromptEngine } from "../src/categoryPromptEngine";
import { CategoryAwareErrorHandler } from "../src/categoryErrorHandler";
import { CategoryPerformanceOptimizer } from "../src/categoryPerformanceOptimizer";
import { CategorySpecificToolSelector } from "../src/categoryToolSelector";
import { DEFAULT_WORK_CATEGORIES } from "@kletron/shared/workspaceCategories";

describe("Category System (Code vs Work)", () => {
  let router: CategoryAwareRouter;
  let promptEngine: CategoryPromptEngine;
  let errorHandler: CategoryAwareErrorHandler;
  let performanceOptimizer: CategoryPerformanceOptimizer;
  let toolSelector: CategorySpecificToolSelector;

  beforeEach(() => {
    router = CategoryAwareRouter.getInstance();
    promptEngine = CategoryPromptEngine.getInstance();
    errorHandler = new CategoryAwareErrorHandler();
    performanceOptimizer = new CategoryPerformanceOptimizer();
    toolSelector = CategorySpecificToolSelector.getInstance();
  });

  describe("CategoryAwareRouter", () => {
    it("should set context", () => {
      router.setContext("test-workspace", "code");
      expect(router).toBeDefined();
    });

    it("should infer code from implementation-style content", () => {
      router.setContext("test-workspace");
      const result = router.determineCategory("Implement authentication with JWT");
      expect(result.category).toBe("code");
    });

    it("should infer work from document-style content", () => {
      router.setContext("test-workspace");
      const result = router.determineCategory("Write a technical document about APIs");
      expect(result.category).toBe("work");
    });
  });

  describe("CategoryPromptEngine", () => {
    it("should build prompt for code mode", () => {
      const prompt = promptEngine.buildPromptForCategory({
        category: "code",
        userInput: "hello",
      });
      expect(prompt.systemMessage.length).toBeGreaterThan(0);
      expect(prompt.constraints.length).toBeGreaterThan(0);
    });

    it("should build prompt for work mode", () => {
      const prompt = promptEngine.buildPromptForCategory({
        category: "work",
        userInput: "hello",
      });
      expect(prompt.systemMessage.length).toBeGreaterThan(0);
    });
  });

  describe("CategoryAwareErrorHandler", () => {
    it("should handle file access errors in code mode", async () => {
      const error = {
        message: "File not found: /path/to/file.ts",
        code: "FILE_ACCESS_ERROR",
      };
      const result = await errorHandler.handleExecutionError(error, "code");
      expect(result.recoveryAttempted).toBe(true);
    });
  });

  describe("CategoryPerformanceOptimizer", () => {
    it("should optimize for code mode", async () => {
      const config = await performanceOptimizer.optimizeForCategory("code");
      expect(config.maxTokens).toBe(4096);
    });

    it("should optimize for work mode", async () => {
      const config = await performanceOptimizer.optimizeForCategory("work");
      expect(config.maxTokens).toBe(8192);
    });
  });

  describe("CategorySpecificToolSelector", () => {
    it("should get tools for code mode", () => {
      const tools = toolSelector.getToolsForCategory("code");
      expect(tools.length).toBeGreaterThan(0);
    });

    it("should get tools for work mode", () => {
      const tools = toolSelector.getToolsForCategory("work");
      expect(tools.length).toBeGreaterThan(0);
    });

    it("should normalize legacy id", () => {
      const tools = toolSelector.getToolsForCategory("coding");
      expect(tools.length).toBeGreaterThan(0);
    });
  });

  describe("DEFAULT_WORK_CATEGORIES", () => {
    it("should have code and work", () => {
      expect(DEFAULT_WORK_CATEGORIES).toHaveLength(2);
      expect(DEFAULT_WORK_CATEGORIES.map((c) => c.id).sort()).toEqual(["code", "work"]);
    });
  });
});
