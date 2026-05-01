// packages/server/src/services/categoryService.ts
import type { WorkCategoryConfig, WorkspaceCategoryConfig } from "@kletron/shared/categoryTypes";
import { BUILT_IN_CATEGORIES } from "@kletron/shared/categoryTypes";
import { getDatabase } from "../lib/db";
import { ObjectId } from "mongodb";

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
  _id: string; // userId
  currentCategory: string;
  categoryHistory: string[];
  lastUsed: Record<string, Date>;
  workspaceId?: string | ObjectId;
  updatedAt: Date;
}

export class CategoryService {
  private static instance: CategoryService | null = null;

  private constructor() {}

  static getInstance(): CategoryService {
    if (!CategoryService.instance) {
      CategoryService.instance = new CategoryService();
    }
    return CategoryService.instance;
  }

  async initializeBuiltInCategories(): Promise<void> {
    const db = await getDatabase();
    const collection = db.collection<CategoryDoc>(CATEGORY_COLLECTION);
    
    // Check if built-in categories exist
    const existingCount = await collection.countDocuments({});
    if (existingCount > 0) return;
    
    // Insert built-in categories
    const categories: CategoryDoc[] = Object.entries(BUILT_IN_CATEGORIES).map(([id, config]) => ({
      id,
      name: (config as any).name,
      description: (config as any).description,
      icon: (config as any).icon,
      color: (config as any).color,
      defaultPrompt: (config as any).defaultPrompt,
      availableTools: (config as any).availableTools,
      requiredContextTypes: (config as any).requiredContextTypes,
      capabilities: (config as any).capabilities,
      workspaceSpecific: (config as any).workspaceSpecific,
      createdAt: new Date(),
      updatedAt: new Date()
    }));
    
    await collection.insertMany(categories);
  }

  async getCategoryById(categoryId: string): Promise<WorkCategoryConfig | null> {
    const db = await getDatabase();
    const collection = db.collection<CategoryDoc>(CATEGORY_COLLECTION);
    
    const doc = await collection.findOne({ id: categoryId });
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
      // Return built-in categories that are workspace-specific
      const builtInWorkspaceCategories = Object.entries(BUILT_IN_CATEGORIES)
        .filter(([_, config]) => (config as any).workspaceSpecific)
        .map(([id, config]) => ({
          ...(config as any),
          id,
          workspaceId,
          customName: undefined,
          customTools: undefined
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
        const builtIn = BUILT_IN_CATEGORIES[workspaceDoc.categoryId];
        return {
          id: workspaceDoc.categoryId,
          name: workspaceDoc.customName || builtIn?.name || workspaceDoc.categoryId,
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
    
    // Check if base category exists
    const baseCategory = await this.getCategoryById(categoryId);
    if (!baseCategory) {
      throw new Error(`Base category ${categoryId} not found`);
    }
    
    // Check if already exists
    const existing = await collection.findOne({
      workspaceId,
      categoryId
    });
    
    if (existing) {
      return this.getWorkspaceCategory(workspaceId, categoryId);
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
    return this.getWorkspaceCategory(workspaceId, categoryId);
  }

  async getWorkspaceCategory(
    workspaceId: string,
    categoryId: string
  ): Promise<WorkspaceCategoryConfig | null> {
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
    const db = await getDatabase();
    const collection = db.collection<WorkspaceCategoryDoc>(WORKSPACE_CATEGORY_COLLECTION);
    
    const result = await collection.deleteOne({
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
      // Try to get workspace-specific state
      doc = await collection.findOne({
        _id: userId,
        workspaceId: new ObjectId(workspaceId)
      });
      
      if (!doc) {
        // Fall back to global state
        doc = await collection.findOne({ _id: userId });
      }
    } else {
      doc = await collection.findOne({ _id: userId });
    }
    
    return doc?.currentCategory || null;
  }

  async setCurrentCategory(
    userId: string,
    categoryId: string,
    workspaceId?: string
  ): Promise<void> {
    const db = await getDatabase();
    const collection = db.collection<CategoryStateDoc>("category_state");
    
    const now = new Date();
    const updateDoc: Partial<CategoryStateDoc> = {
      currentCategory: categoryId,
      updatedAt: now
    };
    
    if (workspaceId) {
      updateDoc.workspaceId = new ObjectId(workspaceId);
      updateDoc.categoryHistory = [categoryId]; // Simple history for now
      updateDoc.lastUsed = { [categoryId]: now };
      
      await collection.updateOne(
        { _id: userId, workspaceId: new ObjectId(workspaceId) },
        { $set: updateDoc },
        { upsert: true }
      );
    } else {
      // Global state
      const existing = await collection.findOne({ _id: userId });
      
      if (existing && existing.categoryHistory) {
        updateDoc.categoryHistory = [categoryId, ...existing.categoryHistory.filter(c => c !== categoryId)].slice(0, 10);
      } else {
        updateDoc.categoryHistory = [categoryId];
      }
      
      if (existing && existing.lastUsed) {
        updateDoc.lastUsed = { ...existing.lastUsed, [categoryId]: now };
      } else {
        updateDoc.lastUsed = { [categoryId]: now };
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
    
    let doc: CategoryStateDoc | null;
    
    if (workspaceId) {
      doc = await collection.findOne({
        _id: userId,
        workspaceId: new ObjectId(workspaceId)
      });
    }
    
    if (!doc) {
      doc = await collection.findOne({ _id: userId });
    }
    
    return doc?.categoryHistory || [];
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