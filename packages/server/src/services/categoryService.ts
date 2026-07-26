// packages/server/src/services/categoryService.ts
import type { WorkCategoryConfig, WorkspaceCategoryConfig } from "@kletron/shared/categoryTypes";
import { BUILT_IN_CATEGORIES } from "@kletron/shared/categoryTypes";
import { normalizeToWorkModeId, resolveWorkModeOrNull, type WorkModeId } from "@kletron/shared/workMode";
import { getDatabase } from "../lib/db";
import { ObjectId } from "mongodb";

const LEGACY_CATEGORY_IDS = ["coding", "drafting", "automation", "general"] as const;

const CATEGORY_COLLECTION = "work_categories";
const WORKSPACE_CATEGORY_COLLECTION = "workspace_work_categories";

interface CategoryDoc {
  _id?: ObjectId;
  id: string;
  name: string;
  description: string;
  icon?: string;
  color?: string;
  defaultPrompt: string;
  availableTools: string[];
  requiredContextTypes: string[];
  capabilities: {
    canEditFiles?: boolean;
    canAccessExternalServices?: boolean;
    canScheduleTasks?: boolean;
    canUseTerminal?: boolean;
  };
  workspaceSpecific?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface WorkspaceCategoryDoc {
  _id?: ObjectId;
  workspaceId: string | ObjectId;
  categoryId: string;
  customName?: string;
  customTools?: string[];
  isActive?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface CategoryStateDoc {
  /**
   * Legacy global row: `userId`.
   * Per-workspace row: `${userId}::${workspaceIdHex}` — required because MongoDB `_id`
   * is unique; `{ _id: userId, workspaceId: X }` upserts collide with an existing `{ _id: userId }` doc.
   */
  _id: string;
  currentCategory: string;
  categoryHistory: string[];
  lastUsed: Record<string, Date>;
  workspaceId?: string | ObjectId;
  updatedAt: Date;
}

function categoryStateDocId(userId: string, workspaceId?: string): string {
  const uid = userId.trim();
  const ws = workspaceId?.trim();
  if (!ws) return uid;
  return `${uid}::${ws}`;
}

export class CategoryService {
  private static instance: CategoryService | null = null;
  private static legacyLinksMigrated = false;

  private constructor() {}

  static getInstance(): CategoryService {
    if (!CategoryService.instance) {
      CategoryService.instance = new CategoryService();
    }
    return CategoryService.instance;
  }

  /**
   * Idempotent: remove legacy four-way categories, upsert `code` / `work`, normalize user category_state.
   */
  async initializeBuiltInCategories(): Promise<void> {
    const db = await getDatabase();
    const collection = db.collection<CategoryDoc>(CATEGORY_COLLECTION);

    await collection.deleteMany({
      id: { $in: [...LEGACY_CATEGORY_IDS] },
    });

    const now = new Date();
    for (const id of Object.keys(BUILT_IN_CATEGORIES) as WorkModeId[]) {
      const config = BUILT_IN_CATEGORIES[id];
      await collection.updateOne(
        { id },
        {
          $set: {
            id,
            name: config.name,
            description: config.description,
            icon: config.icon,
            color: config.color,
            defaultPrompt: config.defaultPrompt,
            availableTools: config.availableTools,
            requiredContextTypes: config.requiredContextTypes,
            capabilities: config.capabilities,
            workspaceSpecific: config.workspaceSpecific,
            updatedAt: now,
          },
          $setOnInsert: { createdAt: now },
        },
        { upsert: true },
      );
    }

    if (!CategoryService.legacyLinksMigrated) {
      await this.migrateCategoryStateCollection();
      await this.migrateWorkspaceCategoryLinks();
      CategoryService.legacyLinksMigrated = true;
    }
  }

  private async migrateWorkspaceCategoryLinks(): Promise<void> {
    const db = await getDatabase();
    const collection = db.collection<WorkspaceCategoryDoc>(WORKSPACE_CATEGORY_COLLECTION);
    for (const leg of LEGACY_CATEGORY_IDS) {
      const next = normalizeToWorkModeId(leg);
      await collection.updateMany(
        { categoryId: leg },
        { $set: { categoryId: next, updatedAt: new Date() } },
      );
    }
  }

  private async migrateCategoryStateCollection(): Promise<void> {
    const db = await getDatabase();
    const collection = db.collection<CategoryStateDoc>("category_state");
    const docs = await collection.find({}).toArray();
    for (const doc of docs) {
      const next = normalizeToWorkModeId(doc.currentCategory);
      const hist = (doc.categoryHistory || []).map((h) => normalizeToWorkModeId(h));
      const lastUsed: Record<string, Date> = {};
      if (doc.lastUsed) {
        for (const [k, v] of Object.entries(doc.lastUsed)) {
          lastUsed[normalizeToWorkModeId(k)] = v;
        }
      }
      if (
        next === doc.currentCategory &&
        hist.join(",") === (doc.categoryHistory || []).join(",") &&
        Object.keys(lastUsed).length === Object.keys(doc.lastUsed || {}).length
      ) {
        continue;
      }
      const filter =
        doc.workspaceId !== undefined
          ? { _id: doc._id, workspaceId: doc.workspaceId }
          : { _id: doc._id };
      await collection.updateOne(filter, {
        $set: {
          currentCategory: next,
          categoryHistory: hist,
          lastUsed,
          updatedAt: new Date(),
        },
      });
    }
  }

  async getCategoryById(categoryId: string): Promise<WorkCategoryConfig | null> {
    await this.initializeBuiltInCategories();
    const mode = resolveWorkModeOrNull(categoryId);
    if (mode == null) return null;
    const db = await getDatabase();
    const collection = db.collection<CategoryDoc>(CATEGORY_COLLECTION);

    const doc = await collection.findOne({ id: mode });
    if (!doc) return null;

    return this.mapToConfig(doc);
  }

  async getAllCategories(): Promise<WorkCategoryConfig[]> {
    await this.initializeBuiltInCategories();
    
    const db = await getDatabase();
    const collection = db.collection<CategoryDoc>(CATEGORY_COLLECTION);
    
    const docs = await collection.find({}).toArray();
    return docs.map(doc => this.mapToConfig(doc));
  }

  async getWorkspaceCategories(workspaceId: string): Promise<WorkspaceCategoryConfig[]> {
    const db = await getDatabase();
    const workspaceCollection = db.collection<WorkspaceCategoryDoc>(WORKSPACE_CATEGORY_COLLECTION);
    const categoryCollection = db.collection<CategoryDoc>(CATEGORY_COLLECTION);
    
    // Get all workspace-specific categories
    const workspaceDocs = await workspaceCollection.find({ workspaceId }).toArray();
    
    if (workspaceDocs.length === 0) {
      const builtInWorkspaceCategories = Object.entries(BUILT_IN_CATEGORIES)
        .filter(([_, config]) => config.workspaceSpecific)
        .map(([id, config]) => ({
          ...config,
          id,
          workspaceId,
          customName: undefined,
          customTools: undefined,
        }));

      return builtInWorkspaceCategories;
    }
    
    // Get base categories for the workspace categories
    const categoryIds = workspaceDocs.map(doc => doc.categoryId);
    const baseCategories = await categoryCollection.find({ id: { $in: categoryIds } }).toArray();
    
    return workspaceDocs.map(workspaceDoc => {
      const baseCategory = baseCategories.find(c => c.id === workspaceDoc.categoryId);
      if (!baseCategory) {
        // Fallback to built-in
        const bid = normalizeToWorkModeId(workspaceDoc.categoryId);
        const builtIn = BUILT_IN_CATEGORIES[bid];
        return {
          id: bid,
          name: workspaceDoc.customName || builtIn?.name || bid,
          description: builtIn?.description || "",
          icon: builtIn?.icon,
          color: builtIn?.color,
          defaultPrompt: builtIn?.defaultPrompt || "",
          availableTools: workspaceDoc.customTools || builtIn?.availableTools || [],
          requiredContextTypes: builtIn?.requiredContextTypes || [],
          capabilities: builtIn?.capabilities || {},
          workspaceId,
          customName: workspaceDoc.customName,
          customTools: workspaceDoc.customTools
        };
      }
      
      return {
        id: baseCategory.id,
        name: workspaceDoc.customName || baseCategory.name,
        description: baseCategory.description,
        icon: baseCategory.icon,
        color: baseCategory.color,
        defaultPrompt: baseCategory.defaultPrompt,
        availableTools: workspaceDoc.customTools || baseCategory.availableTools,
        requiredContextTypes: baseCategory.requiredContextTypes,
        capabilities: baseCategory.capabilities,
        workspaceId,
        customName: workspaceDoc.customName,
        customTools: workspaceDoc.customTools
      };
    });
  }

  async createWorkspaceCategory(
    workspaceId: string,
    categoryId: string,
    options?: { customName?: string; customTools?: string[] }
  ): Promise<WorkspaceCategoryConfig> {
    const db = await getDatabase();
    const collection = db.collection<WorkspaceCategoryDoc>(WORKSPACE_CATEGORY_COLLECTION);

    categoryId = normalizeToWorkModeId(categoryId);

    // Check if base category exists
    const baseCategory = await this.getCategoryById(categoryId);
    if (!baseCategory) {
      throw new Error(`Base category ${categoryId} not found`);
    }
    
    // Check if already exists. `workspaceId` is stored as an ObjectId (see the
    // insert below), so it must be queried as one — comparing against the raw
    // string never matches and silently inserts a duplicate on every call.
    const existing = await collection.findOne({
      workspaceId: new ObjectId(workspaceId),
      categoryId
    });
    
    if (existing) {
      const cfg = await this.getWorkspaceCategory(workspaceId, categoryId);
      if (!cfg) throw new Error(`Workspace category ${categoryId} not found`);
      return cfg;
    }
    
    const now = new Date();
    const doc: WorkspaceCategoryDoc = {
      workspaceId: new ObjectId(workspaceId),
      categoryId,
      customName: options?.customName,
      customTools: options?.customTools,
      isActive: true,
      createdAt: now,
      updatedAt: now
    };
    
    await collection.insertOne(doc);
    const created = await this.getWorkspaceCategory(workspaceId, categoryId);
    if (!created) throw new Error(`Failed to read workspace category ${categoryId}`);
    return created;
  }

  async getWorkspaceCategory(
    workspaceId: string,
    categoryId: string
  ): Promise<WorkspaceCategoryConfig | null> {
    categoryId = normalizeToWorkModeId(categoryId);
    const db = await getDatabase();
    const collection = db.collection<WorkspaceCategoryDoc>(WORKSPACE_CATEGORY_COLLECTION);
    
    const doc = await collection.findOne({
      workspaceId: new ObjectId(workspaceId),
      categoryId
    });
    
    if (!doc) return null;
    
    // Get base category
    const baseCategory = await this.getCategoryById(categoryId);
    if (!baseCategory) return null;
    
    return {
      id: baseCategory.id,
      name: doc.customName || baseCategory.name,
      description: baseCategory.description,
      icon: baseCategory.icon,
      color: baseCategory.color,
      defaultPrompt: baseCategory.defaultPrompt,
      availableTools: doc.customTools || baseCategory.availableTools,
      requiredContextTypes: baseCategory.requiredContextTypes,
      capabilities: baseCategory.capabilities,
      workspaceId,
      customName: doc.customName,
      customTools: doc.customTools
    };
  }

  async updateWorkspaceCategory(
    workspaceId: string,
    categoryId: string,
    updates: { customName?: string; customTools?: string[] }
  ): Promise<WorkspaceCategoryConfig | null> {
    categoryId = normalizeToWorkModeId(categoryId);
    const db = await getDatabase();
    const collection = db.collection<WorkspaceCategoryDoc>(WORKSPACE_CATEGORY_COLLECTION);
    
    const result = await collection.updateOne(
      { workspaceId: new ObjectId(workspaceId), categoryId },
      {
        $set: {
          ...(updates.customName !== undefined && { customName: updates.customName }),
          ...(updates.customTools !== undefined && { customTools: updates.customTools }),
          updatedAt: new Date()
        }
      }
    );
    
    if (result.modifiedCount === 0) return null;
    return this.getWorkspaceCategory(workspaceId, categoryId);
  }

  async deleteWorkspaceCategory(
    workspaceId: string,
    categoryId: string
  ): Promise<boolean> {
    categoryId = normalizeToWorkModeId(categoryId);
    const db = await getDatabase();
    const collection = db.collection<WorkspaceCategoryDoc>(WORKSPACE_CATEGORY_COLLECTION);
    
    // deleteMany, not deleteOne: (workspaceId, categoryId) is logically unique
    // but is not enforced by an index, so any duplicates left by earlier writes
    // would otherwise survive the delete and resurface on the next read.
    const result = await collection.deleteMany({
      workspaceId: new ObjectId(workspaceId),
      categoryId
    });

    return result.deletedCount > 0;
  }

  async getCurrentCategory(userId: string, workspaceId?: string): Promise<string | null> {
    const db = await getDatabase();
    const collection = db.collection<CategoryStateDoc>("category_state");

    let doc: CategoryStateDoc | null;

    if (workspaceId) {
      const scopedId = categoryStateDocId(userId, workspaceId);
      doc = await collection.findOne({ _id: scopedId });
      if (!doc) {
        doc = await collection.findOne({
          _id: userId,
          workspaceId: new ObjectId(workspaceId),
        });
      }
      if (!doc) {
        doc = await collection.findOne({ _id: userId });
      }
    } else {
      doc = await collection.findOne({ _id: userId });
    }

    const raw = doc?.currentCategory || null;
    return raw == null ? null : normalizeToWorkModeId(raw);
  }

  async setCurrentCategory(
    userId: string,
    categoryId: string,
    workspaceId?: string
  ): Promise<void> {
    const categoryIdNorm = normalizeToWorkModeId(categoryId);
    const db = await getDatabase();
    const collection = db.collection<CategoryStateDoc>("category_state");

    const now = new Date();
    const updateDoc: Partial<CategoryStateDoc> = {
      currentCategory: categoryIdNorm,
      updatedAt: now,
    };
    
    if (workspaceId) {
      updateDoc.workspaceId = new ObjectId(workspaceId);
      updateDoc.categoryHistory = [categoryIdNorm];
      updateDoc.lastUsed = { [categoryIdNorm]: now };

      const docId = categoryStateDocId(userId, workspaceId);
      await collection.updateOne(
        { _id: docId },
        { $set: updateDoc },
        { upsert: true },
      );
    } else {
      // Global state
      const existing = await collection.findOne({ _id: userId });
      
      if (existing && existing.categoryHistory) {
        const normalizedHist = existing.categoryHistory.map((c) => normalizeToWorkModeId(c));
        updateDoc.categoryHistory = [
          categoryIdNorm,
          ...normalizedHist.filter((c) => c !== categoryIdNorm),
        ].slice(0, 10);
      } else {
        updateDoc.categoryHistory = [categoryIdNorm];
      }

      if (existing && existing.lastUsed) {
        const lu: Record<string, Date> = {};
        for (const [k, v] of Object.entries(existing.lastUsed)) {
          lu[normalizeToWorkModeId(k)] = v;
        }
        lu[categoryIdNorm] = now;
        updateDoc.lastUsed = lu;
      } else {
        updateDoc.lastUsed = { [categoryIdNorm]: now };
      }
      
      await collection.updateOne(
        { _id: userId },
        { $set: updateDoc },
        { upsert: true }
      );
    }
  }

  async getCategoryHistory(userId: string, workspaceId?: string): Promise<string[]> {
    const db = await getDatabase();
    const collection = db.collection<CategoryStateDoc>("category_state");
    
    let doc: CategoryStateDoc | null = null;
    
    if (workspaceId) {
      const scopedId = categoryStateDocId(userId, workspaceId);
      doc = await collection.findOne({ _id: scopedId });
      if (!doc) {
        doc = await collection.findOne({
          _id: userId,
          workspaceId: new ObjectId(workspaceId),
        });
      }
    }

    if (!doc) {
      doc = await collection.findOne({ _id: userId });
    }
    
    return (doc?.categoryHistory || []).map((id) => normalizeToWorkModeId(id));
  }

  private mapToConfig(doc: CategoryDoc): WorkCategoryConfig {
    return {
      id: doc.id,
      name: doc.name,
      description: doc.description,
      icon: doc.icon,
      color: doc.color,
      defaultPrompt: doc.defaultPrompt,
      availableTools: doc.availableTools,
      requiredContextTypes: doc.requiredContextTypes,
      capabilities: doc.capabilities,
      workspaceSpecific: doc.workspaceSpecific
    };
  }
}

export const categoryService = CategoryService.getInstance();