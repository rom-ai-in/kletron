// packages/server/__tests__/categoryService.test.ts
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { MongoClient } from "mongodb";
import type { Db } from "mongodb";

const testCtx = vi.hoisted(() => ({ db: null as Db | null }));

vi.mock("../src/lib/db", () => ({
  getDatabase: async () => {
    if (!testCtx.db) throw new Error("testCtx.db not set in categoryService tests");
    return testCtx.db;
  },
  getDb: async () => {
    if (!testCtx.db) throw new Error("testCtx.db not set in categoryService tests");
    return testCtx.db;
  },
}));

import { CategoryService } from "../src/services/categoryService";
import { BUILT_IN_CATEGORIES } from "@kletron/shared/categoryTypes";

const client = new MongoClient(process.env.MONGODB_URI || "mongodb://localhost:27017", {
  serverSelectionTimeoutMS: 5000,
  connectTimeoutMS: 5000,
});
const testDbName = "kletron_test_category";

describe("CategoryService", () => {
  let service: CategoryService;
  /** Set in beforeAll; tests call ctx.skip() when MongoDB is not available (local/CI without server). */
  let mongoReady = false;

  beforeAll(async () => {
    try {
      await client.connect();
      testCtx.db = client.db(testDbName);
      service = CategoryService.getInstance();
      mongoReady = true;
    } catch (err) {
      console.warn(
        "[CategoryService tests] Skipping: MongoDB unavailable.",
        (err as Error)?.message ?? err,
      );
      mongoReady = false;
    }
  }, 20_000);

  afterAll(async () => {
    if (mongoReady) {
      await client.close();
    }
    testCtx.db = null;
  }, 20_000);

  describe("initializeBuiltInCategories", () => {
    it("should initialize built-in categories", async (ctx) => {
      if (!mongoReady) ctx.skip();
      await service.initializeBuiltInCategories();

      const collection = testCtx.db!.collection("work_categories");
      const count = await collection.countDocuments({});

      expect(count).toBe(Object.keys(BUILT_IN_CATEGORIES).length);
    });
  });

  describe("getCategoryById", () => {
    it("should return null for non-existent category", async (ctx) => {
      if (!mongoReady) ctx.skip();
      await service.initializeBuiltInCategories();
      const result = await service.getCategoryById("nonexistent");
      expect(result).toBeNull();
    });

    it("should return category by id", async (ctx) => {
      if (!mongoReady) ctx.skip();
      await service.initializeBuiltInCategories();
      const result = await service.getCategoryById("code");

      expect(result).not.toBeNull();
      expect(result?.id).toBe("code");
      expect(result?.name).toBe(BUILT_IN_CATEGORIES.code.name);
    });

    it("should resolve legacy coding alias", async (ctx) => {
      if (!mongoReady) ctx.skip();
      await service.initializeBuiltInCategories();
      const result = await service.getCategoryById("coding");
      expect(result?.id).toBe("code");
    });
  });

  describe("getAllCategories", () => {
    it("should return code and work", async (ctx) => {
      if (!mongoReady) ctx.skip();
      await service.initializeBuiltInCategories();
      const result = await service.getAllCategories();

      expect(result.length).toBe(Object.keys(BUILT_IN_CATEGORIES).length);
      expect(result.some((c) => c.id === "code")).toBe(true);
      expect(result.some((c) => c.id === "work")).toBe(true);
    });
  });

  describe("workspace categories", () => {
    const testWorkspaceId = "507f191e810c19729de860ea";

    it("should return built-in workspace-specific categories when none exist", async (ctx) => {
      if (!mongoReady) ctx.skip();
      await service.initializeBuiltInCategories();

      const result = await service.getWorkspaceCategories(testWorkspaceId);

      expect(result.some((c) => c.id === "code")).toBe(true);
      expect(result.every((c) => c.workspaceId === testWorkspaceId)).toBe(true);
    });

    it("should create workspace category", async (ctx) => {
      if (!mongoReady) ctx.skip();
      await service.initializeBuiltInCategories();

      const result = await service.createWorkspaceCategory(testWorkspaceId, "code", {
        customName: "My Custom Code",
        customTools: ["custom_tool_1", "custom_tool_2"],
      });

      expect(result.id).toBe("code");
      expect(result.customName).toBe("My Custom Code");
      expect(result.customTools).toEqual(["custom_tool_1", "custom_tool_2"]);
      expect(result.workspaceId).toBe(testWorkspaceId);
    });

    it("should get workspace category", async (ctx) => {
      if (!mongoReady) ctx.skip();
      await service.initializeBuiltInCategories();

      await service.createWorkspaceCategory(testWorkspaceId, "work");

      const result = await service.getWorkspaceCategory(testWorkspaceId, "work");

      expect(result).not.toBeNull();
      expect(result?.id).toBe("work");
      expect(result?.workspaceId).toBe(testWorkspaceId);
    });

    it("should update workspace category", async (ctx) => {
      if (!mongoReady) ctx.skip();
      await service.initializeBuiltInCategories();

      await service.createWorkspaceCategory(testWorkspaceId, "work");

      const result = await service.updateWorkspaceCategory(testWorkspaceId, "work", {
        customName: "Updated Work",
      });

      expect(result).not.toBeNull();
      expect(result?.customName).toBe("Updated Work");
    });

    it("should delete workspace category", async (ctx) => {
      if (!mongoReady) ctx.skip();
      await service.initializeBuiltInCategories();

      await service.createWorkspaceCategory(testWorkspaceId, "work");

      const success = await service.deleteWorkspaceCategory(testWorkspaceId, "work");
      expect(success).toBe(true);

      const result = await service.getWorkspaceCategory(testWorkspaceId, "work");
      expect(result).toBeNull();
    });
  });

  describe("category state", () => {
    const testUserId = "test-user-456";
    const testWorkspaceId = "507f191e810c19729de860ea";

    it("should set and get current category", async (ctx) => {
      if (!mongoReady) ctx.skip();
      await service.setCurrentCategory(testUserId, "code");

      const result = await service.getCurrentCategory(testUserId);
      expect(result).toBe("code");
    });

    it("should set and get current category with workspace", async (ctx) => {
      if (!mongoReady) ctx.skip();
      await service.setCurrentCategory(testUserId, "work", testWorkspaceId);

      const result = await service.getCurrentCategory(testUserId, testWorkspaceId);
      expect(result).toBe("work");
    });

    it("should track category history", async (ctx) => {
      if (!mongoReady) ctx.skip();
      await service.setCurrentCategory(testUserId, "code");
      await service.setCurrentCategory(testUserId, "work");
      await service.setCurrentCategory(testUserId, "code");

      const history = await service.getCategoryHistory(testUserId);
      expect(history).toContain("code");
      expect(history).toContain("work");
    });
  });
});
