// packages/server/src/services/contextPreservation.ts

/**
 * Context Preservation System
 * 
 * Enables seamless switching between work categories while preserving
 * relevant context (active files, recent edits, search history, etc.)
 * that transfers across domains.
 */

import type { WorkCategoryId } from "@kletron/shared";
import { normalizeToWorkModeId, type WorkModeId } from "@kletron/shared/workMode";

// ============================================================================
// TYPES
// ============================================================================

/** Context items that can be transferred between categories */
export interface TransferableContext {
  /** User's global preferences */
  userPreferences: UserPreferences;
  
  /** Recent activity history (applies to all categories) */
  recentActivities: ActivityEntry[];
  
  /** Saved searches (applies to all categories) */
  savedSearches: SavedSearch[];
  
  /** Category-specific context */
  categoryContext: Record<WorkCategoryId, CategoryContext>;
}

/** Per-category context */
export interface CategoryContext {
  /** Active files being edited/viewed */
  activeFiles: ActiveFile[];
  
  /** Recent file edits */
  recentEdits: FileEdit[];
  
  /** Recent search queries */
  recentSearches: string[];

  /** Recent activity history for this category */
  recentActivities?: ActivityEntry[];
  
  /** Last conversation state */
  lastConversationState?: {
    messageCount: number;
    lastRole: 'user' | 'assistant' | 'tool';
    lastContent: string;
  };
  
  /** Workspace-specific context */
  workspaceContext: {
    /** Current workspace path */
    workspacePath: string;
    /** Active branch */
    activeBranch?: string;
    /** Git status snapshot */
    gitStatusSnapshot?: GitStatusSnapshot;
    /** Open files */
    openFiles: string[];
    /** Selected file */
    selectedFile?: string;
  };
}

/** Active file being viewed/edited */
export interface ActiveFile {
  path: string;
  content: string;
  cursorPosition?: { line: number; character: number };
  lastModified: number;
}

/** File edit entry */
export interface FileEdit {
  path: string;
  oldContent: string;
  newContent: string;
  timestamp: number;
}

/** Activity entry */
export interface ActivityEntry {
  timestamp: number;
  action: string;
  metadata?: Record<string, unknown>;
}

/** Saved search entry */
export interface SavedSearch {
  query: string;
  category: WorkCategoryId;
  timestamp: number;
}

/** Git status snapshot */
export interface GitStatusSnapshot {
  branch: string;
  status: Array<{ path: string; status: string }>;
  lastCommit?: { hash: string; message: string; timestamp: number };
}

/** User preferences */
export interface UserPreferences {
  theme: 'light' | 'dark';
  fontSize: number;
  tabSize: number;
  wordWrap: boolean;
  minimapEnabled: boolean;
  gitEnabled: boolean;
  autoSave: boolean;
  saveDelay: number;
}

/** Result of a context preservation operation */
export interface ContextTransitionResult {
  /** Whether context was successfully preserved */
  preserved: boolean;
  
  /** Merged context for the target category */
  context: CategoryContext;
  
  /** Warnings about potential issues */
  warnings: string[];
  
  /** Items that were transferred */
  transferredItems: string[];
  
  /** Items that were dropped (incompatible) */
  droppedItems: string[];
}

// ============================================================================
// CONTEXT PRESERVER
// ============================================================================

export class ContextPreserver {
  private contextStore: Map<string, TransferableContext> = new Map();
  private maxRecentActivities = 10;
  private maxRecentSearches = 5;
  private maxRecentEdits = 5;

  /**
   * Preserve context when switching from one category to another.
   * 
   * This method:
   * 1. Extracts transferable context from the source category
   * 2. Transforms it for compatibility with the target category
   * 3. Merges with existing context in the target category
   * 4. Returns a transition result with warnings
   */
  async preserveContext(
    userId: string,
    fromCategory: WorkCategoryId,
    toCategory: WorkCategoryId,
    workspacePath: string,
    currentContext?: CategoryContext,
  ): Promise<ContextTransitionResult> {
    const from = normalizeToWorkModeId(String(fromCategory)) as WorkModeId;
    const to = normalizeToWorkModeId(String(toCategory)) as WorkModeId;

    const warnings: string[] = [];
    const transferredItems: string[] = [];
    const droppedItems: string[] = [];

    // Get or create transferable context for this user
    let transferable = this.contextStore.get(userId);
    if (!transferable) {
      transferable = this.createDefaultTransferableContext();
      this.contextStore.set(userId, transferable);
    }

    // Extract transferable context from source category
    const sourceCategoryContext = transferable.categoryContext[from] || this.createDefaultCategoryContext();
    
    // Build transferable items
    const transferableItems = this.extractTransferableContext(
      sourceCategoryContext,
      to,
      workspacePath,
    );

    // Transform for target category compatibility
    const transformed = this.transformForCategory(transferableItems, from, to, droppedItems);

    // Get existing target category context
    const targetCategoryContext = transferable.categoryContext[to] || this.createDefaultCategoryContext();

    // Merge with existing target context
    const merged = this.mergeContexts(targetCategoryContext, transformed, warnings);

    // Update transferable context
    transferable.categoryContext[to] = merged;

    // Also update global context
    transferable.userPreferences = transferableItems.userPreferences || transferable.userPreferences;
    transferable.recentActivities = transferableItems.recentActivities || transferable.recentActivities;
    transferable.savedSearches = transferableItems.savedSearches || transferable.savedSearches;

    return {
      preserved: droppedItems.length === 0,
      context: merged,
      warnings,
      transferredItems: Object.keys(transformed).filter((k) => {
        const key = k as keyof typeof transformed;
        return this.hasTransferredValue(transformed[key]);
      }),
      droppedItems,
    };
  }

  /**
   * Extract context that can be transferred from source to target category.
   */
  private extractTransferableContext(
    sourceContext: CategoryContext,
    targetCategory: WorkCategoryId,
    workspacePath: string,
  ): Partial<TransferableContext> {
    const items: Partial<TransferableContext> = {};

    // Always transfer these (global items)
    items.userPreferences = sourceContext.workspaceContext
      ? {
          theme: 'dark',
          fontSize: 14,
          tabSize: 2,
          wordWrap: true,
          minimapEnabled: true,
          gitEnabled: true,
          autoSave: true,
          saveDelay: 1000,
        }
      : undefined;

    items.recentActivities = sourceContext.recentActivities?.slice(-this.maxRecentActivities) || [];
    items.savedSearches = sourceContext.recentSearches?.map((q) => ({
      query: q,
      category: sourceContext.workspaceContext ? "code" : "work",
      timestamp: Date.now(),
    }));

    // Category-specific transferable items (Code vs Work)
    if (sourceContext.workspaceContext) {
      items.categoryContext = {
        code: {
          activeFiles: sourceContext.activeFiles?.slice(0, 5) || [],
          recentEdits: sourceContext.recentEdits?.slice(-this.maxRecentEdits) || [],
          recentSearches: sourceContext.recentSearches?.slice(-this.maxRecentSearches) || [],
          workspaceContext: sourceContext.workspaceContext,
        },
        work: {
          activeFiles: sourceContext.activeFiles?.filter((f) =>
            f.path.match(/\.(md|txt|docx|rtf|pdf)$/i),
          ) || [],
          recentEdits: [],
          recentSearches: sourceContext.recentSearches?.slice(-this.maxRecentSearches) || [],
          workspaceContext: sourceContext.workspaceContext,
        },
      };
    }

    return items;
  }

  /**
   * Transform context for compatibility with target category.
   * Some context items may not be compatible with the target category.
   */
  private transformForCategory(
    items: Partial<TransferableContext>,
    fromCategory: WorkCategoryId,
    toCategory: WorkCategoryId,
    droppedItems: string[],
  ): Partial<CategoryContext> {
    const transformed: Partial<CategoryContext> = {};

    // Transfer active files (filter by target category compatibility)
    if (items.categoryContext?.[toCategory]?.activeFiles) {
      const compatibleFiles = items.categoryContext[toCategory].activeFiles.filter((f) => {
        if (toCategory === "code") return true;
        if (toCategory === "work") return true;
        return true;
      });
      transformed.activeFiles = compatibleFiles;
      if (compatibleFiles.length < (items.categoryContext[toCategory].activeFiles?.length || 0)) {
        droppedItems.push('incompatible_files');
      }
    }

    // Transfer recent searches
    if (items.categoryContext?.[toCategory]?.recentSearches) {
      transformed.recentSearches = items.categoryContext[toCategory].recentSearches;
    }

    // Transfer workspace context
    if (items.categoryContext?.[toCategory]?.workspaceContext) {
      transformed.workspaceContext = items.categoryContext[toCategory].workspaceContext;
    }

    // Transfer conversation state (always compatible)
    if (items.categoryContext?.[fromCategory]?.lastConversationState) {
      transformed.lastConversationState = items.categoryContext[fromCategory].lastConversationState;
    }

    return transformed;
  }

  /**
   * Merge source context with target context, preferring target's existing data.
   */
  private mergeContexts(
    targetContext: CategoryContext,
    sourceContext: Partial<CategoryContext>,
    warnings: string[],
  ): CategoryContext {
    const targetActiveFiles = targetContext.activeFiles ?? [];
    const sourceActiveFiles = sourceContext.activeFiles ?? [];

    const merged: CategoryContext = {
      ...targetContext,
      ...sourceContext,
      activeFiles: this.mergeArrays(targetActiveFiles, sourceActiveFiles),
      recentEdits: this.mergeArrays(targetContext.recentEdits, sourceContext.recentEdits),
      recentSearches: this.mergeStringArrays(targetContext.recentSearches, sourceContext.recentSearches),
      workspaceContext: {
        ...targetContext.workspaceContext,
        ...sourceContext.workspaceContext,
      },
    };

    // Check for potential conflicts
    if (targetActiveFiles.length > 0 && sourceActiveFiles.length > 0) {
      warnings.push('Merging active files from previous context');
    }

    return merged;
  }

  /**
   * Merge two arrays, preferring non-null values and deduplicating by path.
   */
  private mergeArrays<T extends { path?: string }>(
    target: T[],
    source: T[] | undefined,
  ): T[] {
    if (!source || source.length === 0) return target;
    if (target.length === 0) return source;

    // Deduplicate by path
    const seen = new Set<string>();
    return [...source, ...target].filter((item) => {
      const key = item.path || Math.random().toString();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private mergeStringArrays(target: string[], source: string[] | undefined): string[] {
    if (!source || source.length === 0) return target;
    if (target.length === 0) return Array.from(new Set(source));
    return Array.from(new Set([...source, ...target]));
  }

  private hasTransferredValue(value: CategoryContext[keyof CategoryContext] | undefined): boolean {
    if (value == null) return false;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === "string") return value !== "";
    return true;
  }

  /**
   * Get the current context for a category.
   */
  getContextForCategory(userId: string, categoryId: WorkCategoryId): CategoryContext | null {
    const transferable = this.contextStore.get(userId);
    if (!transferable) return null;
    return transferable.categoryContext[categoryId] || null;
  }

  /**
   * Clear all preserved context for a user.
   */
  clearContext(userId: string): void {
    this.contextStore.delete(userId);
  }

  /**
   * Clear context for a specific category.
   */
  clearCategoryContext(userId: string, categoryId: WorkCategoryId): void {
    const transferable = this.contextStore.get(userId);
    if (!transferable) return;
    delete transferable.categoryContext[categoryId];
  }

  // ============================================================================
  // HELPERS
  // ============================================================================

  private createDefaultTransferableContext(): TransferableContext {
    return {
      userPreferences: {
        theme: 'dark' as const,
        fontSize: 14,
        tabSize: 2,
        wordWrap: true,
        minimapEnabled: true,
        gitEnabled: true,
        autoSave: true,
        saveDelay: 1000,
      },
      recentActivities: [],
      savedSearches: [],
      categoryContext: {
        code: this.createDefaultCategoryContext(),
        work: this.createDefaultCategoryContext(),
      },
    };
  }

  private createDefaultCategoryContext(): CategoryContext {
    return {
      activeFiles: [],
      recentEdits: [],
      recentSearches: [],
      recentActivities: [],
      workspaceContext: {
        workspacePath: '',
        openFiles: [],
      },
    };
  }
}

// Singleton instance
export const contextPreserver = new ContextPreserver();
