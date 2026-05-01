// packages/server/__tests__/categoryService.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { MongoClient } from "mongodb";
import { CategoryService } from "../src/services/categoryService";
import { BUILT_IN_CATEGORIES } from "@kletron/shared/types";

const client = new MongoClient(process.env.MONGODB_URI || "mongodb://localhost:27017");
const testDbName = "kletron_test_category";

describe("CategoryService", () => {
  let service: CategoryService;
  let db: any;

  beforeAll(async () => {
    await client.connect();
    db = client.db(testDbName);
    
    // Replace the database connection for testing
    const originalGetDatabase = (await import("../src/lib/db")).getDatabase;
    (await import("../src/lib/db")).getDatabase = async () => db;
    
    service = CategoryService.getInstance();
  });

  afterAll(async () => {
    await client.close();
    // Restore original database connection
    const { getDatabase } = require("../src/lib/db");
    (await import("../src/lib/db")).getDatabase = getDatabase;
  });

  describe("initializeBuiltInCategories", () => {
    it("should initialize built-in categories", async () => {
      await service.initializeBuiltInCategories();
      
      const collection = db.collection("work_categories");
      const count = await collection.countDocuments({});
      
      expect(count).toBe(Object.keys(BUILT_IN_CATEGORIES).length);
    });

    it("should not re-initialize if categories exist", async () => {
      // Call twice - second call should be no-op
      await service.initializeBuiltInCategories();
      const count1 = await db.collection("work_categories").countDocuments({});
      
      await service.initializeBuiltInCategories();
      const count2 = await db.collection("work_categories").countDocuments({});
      
      expect(count1).toBe(count2);
    });
  });

  describe("getCategoryById", () => {
    it("should return null for non-existent category", async () => {
      await service.initializeBuiltInCategories();
      const result = await service.getCategoryById("nonexistent");
      expect(result).toBeNull();
    });

    it("should return category by id", async () => {
      await service.initializeBuiltInCategories();
      const result = await service.getCategoryById("coding");
      
      expect(result).not.toBeNull();
      expect(result?.id).toBe("coding");
      expect(result?.name).toBe(BUILT_IN_CATEGORIES.coding.name);
    });
  });

  describe("getAllCategories", () => {
    it("should return all categories", async () => {
      await service.initializeBuiltInCategories();
      const result = await service.getAllCategories();
      
      expect(result.length).toBe(Object.keys(BUILT_IN_CATEGORIES).length);
      expect(result.some(c => c.id === "coding")).toBe(true);
      expect(result.some(c => c.id === "drafting")).toBe(true);
      expect(result.some(c => c.id === "automation")).toBe(true);
    });
  });

  describe("workspace categories", () => {
    const testWorkspaceId = "test-workspace-123";

    it("should return built-in workspace-specific categories when none exist", async () => {
      await service.initializeBuiltInCategories();
      
      const result = await service.getWorkspaceCategories(testWorkspaceId);
      
      // Should include coding (workspaceSpecific: true)
      expect(result.some(c => c.id === "coding")).toBe(true);
      expect(result.every(c => c.workspaceId === testWorkspaceId)).toBe(true);
    });

    it("should create workspace category", async () => {
      await service.initializeBuiltInCategories();
      
      const result = await service.createWorkspaceCategory(testWorkspaceId, "coding", {
        customName: "My Custom Coding",
        customTools: ["custom_tool_1", "custom_tool_2"]
      });
      
      expect(result.id).toBe("coding");
      expect(result.customName).toBe("My Custom Coding");
      expect(result.customTools).toEqual(["custom_tool_1", "custom_tool_2"]);
      expect(result.workspaceId).toBe(testWorkspaceId);
    });

    it("should get workspace category", async () => {
      await service.initializeBuiltInCategories();
      
      // Create first
      await service.createWorkspaceCategory(testWorkspaceId, "drafting");
      
      // Get it back
      const result = await service.getWorkspaceCategory(testWorkspaceId, "drafting");
      
      expect(result).not.toBeNull();
      expect(result?.id).toBe("drafting");
      expect(result?.workspaceId).toBe(testWorkspaceId);
    });

    it("should update workspace category", async () => {
      await service.initializeBuiltInCategories();
      
      // Create first
      await service.createWorkspaceCategory(testWorkspaceId, "automation");
      
      // Update it
      const result = await service.updateWorkspaceCategory(
        testWorkspaceId,
        "automation",
        { customName: "Updated Automation" }
      );
      
      expect(result).not.toBeNull();
      expect(result?.customName).toBe("Updated Automation");
    });

    it("should delete workspace category", async () => {
      await service.initializeBuiltInCategories();
      
      // Create first
      await service.createWorkspaceCategory(testWorkspaceId, "general");
      
      // Delete it
      const success = await service.deleteWorkspaceCategory(testWorkspaceId, "general");
      expect(success).toBe(true);
      
      // Should not exist anymore
      const result = await service.getWorkspaceCategory(testWorkspaceId, "general");
      expect(result).toBeNull();
    });
  });

  describe("category state", () => {
    const testUserId = "test-user-456";

    it("should set and get current category", async () => {
      await service.setCurrentCategory(testUserId, "coding");
      
      const result = await service.getCurrentCategory(testUserId);
      expect(result).toBe("coding");
    });

    it("should set and get current category with workspace", async () => {
      await service.setCurrentCategory(testUserId, "drafting", testWorkspaceId);
      
      const result = await service.getCurrentCategory(testUserId, testWorkspaceId);
      expect(result).toBe("drafting");
    });

    it("should track category history", async () => {
      // Set multiple categories
      await service.setCurrentCategory(testUserId, "coding");
      await service.setCurrentCategory(testUserId, "drafting");
      await service.setCurrentCategory(testUserId, "automation");
      
      const history = await service.getCategoryHistory(testUserId);
      expect(history).toContain("coding");
      expect(history).toContain("drafting");
      expect(history).toContain("automation");
    });
  });
});