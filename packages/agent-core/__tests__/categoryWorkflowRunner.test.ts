// packages/agent-core/__tests__/categoryWorkflowRunner.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { CategoryWorkflowRunner } from "../src/categoryWorkflowRunner";
import { BUILT_IN_CATEGORIES } from "@kletron/shared/types";

describe("CategoryWorkflowRunner", () => {
  let runner: CategoryWorkflowRunner;

  beforeAll(() => {
    runner = CategoryWorkflowRunner.getInstance();
  });

  describe("determineCategory", () => {
    it("should detect coding category from message content", async () => {
      const categories = Object.entries(BUILT_IN_CATEGORIES).map(([id, config]) => ({
        id,
        ...config
      }));
      
      const result = await runner.determineCategory("How do I fix this bug in the code?", categories);
      expect(result.id).toBe("coding");
    });

    it("should detect drafting category from message content", async () => {
      const categories = Object.entries(BUILT_IN_CATEGORIES).map(([id, config]) => ({
        id,
        ...config
      }));
      
      const result = await runner.determineCategory("Write a report about the project status", categories);
      expect(result.id).toBe("drafting");
    });

    it("should detect automation category from message content", async () => {
      const categories = Object.entries(BUILT_IN_CATEGORIES).map(([id, config]) => ({
        id,
        ...config
      }));
      
      const result = await runner.determineCategory("Create an automation for daily backups", categories);
      expect(result.id).toBe("automation");
    });

    it("should default to first category when no match found", async () => {
      const categories = Object.entries(BUILT_IN_CATEGORIES).map(([id, config]) => ({
        id,
        ...config
      }));
      
      const result = await runner.determineCategory("What is the weather today?", categories);
      expect(result.id).toBe("coding"); // First category in BUILT_IN_CATEGORIES
    });
  });

  describe("buildCategorySystemPrompt", () => {
    it("should build appropriate system prompt for coding category", async () => {
      const codingCategory = {
        id: "coding",
        name: "Code Assistance",
        description: "AI-powered code analysis",
        defaultPrompt: "You are a senior software engineer.",
        availableTools: ["list_files", "read_file"],
        requiredContextTypes: ["repository"],
        capabilities: { canEditFiles: true }
      };
      
      const prompt = (runner as any).buildCategorySystemPrompt(codingCategory, []);
      
      expect(prompt).toContain("senior software engineer");
      expect(prompt).toContain("list_files");
      expect(prompt).toContain("read_file");
    });

    it("should build appropriate system prompt for drafting category", async () => {
      const draftingCategory = {
        id: "drafting",
        name: "Document Drafting",
        description: "Create professional documents",
        defaultPrompt: "You are a technical writer.",
        availableTools: ["fetch_url", "web_search"],
        requiredContextTypes: ["document_template"],
        capabilities: { canEditFiles: false }
      };
      
      const prompt = (runner as any).buildCategorySystemPrompt(draftingCategory, []);
      
      expect(prompt).toContain("technical writer");
      expect(prompt).toContain("fetch_url");
    });
  });
});