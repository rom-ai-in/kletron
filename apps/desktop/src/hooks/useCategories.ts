import { useState, useEffect, useCallback } from "react";
import { WORK_MODES, normalizeToWorkModeId, type WorkModeId } from "@kletron/shared/workMode";

// ============================================================================
// TYPES
// ============================================================================

export type WorkCategory = {
  id: WorkModeId;
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  defaultPrompt?: string;
  availableTools?: string[];
  skills?: string[];
  connectors?: string[];
};

export type CustomCategory = {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  defaultPrompt: string;
  availableTools: string[];
  requiredContextTypes: string[];
  capabilities: {
    canEditFiles?: boolean;
    canAccessExternalServices?: boolean;
    canScheduleTasks?: boolean;
    canUseTerminal?: boolean;
  };
  skills: string[];
  connectors: string[];
  workspaceSpecific: boolean;
  createdAt: Date;
  updatedAt: Date;
};

// ============================================================================
// BUILT-IN CATEGORIES (Code vs Work)
// ============================================================================

export const BUILT_IN_CATEGORIES: WorkCategory[] = (["code", "work"] as WorkModeId[]).map((id) => {
  const w = WORK_MODES[id];
  const skills: Record<WorkModeId, string[]> = {
    code: ["code-review", "implementation", "testing", "debugging"],
    work: ["research", "explanation", "brainstorming", "technical-writing"],
  };
  return {
    id,
    name: w.name,
    description: w.description,
    icon: null,
    color: w.color,
    defaultPrompt: w.defaultPrompt,
    availableTools: w.availableTools,
    skills: skills[id],
    connectors: w.connectors,
  };
});

// ============================================================================
// HOOK
// ============================================================================

export function useCategories() {
  const [activeCategory, setActiveCategory] = useState<WorkModeId>("code");
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>([]);
  const [categoryHistory, setCategoryHistory] = useState<WorkModeId[]>(["code"]);

  useEffect(() => {
    const savedCategory = localStorage.getItem("kletron-active-category");
    if (savedCategory) {
      const mode = normalizeToWorkModeId(savedCategory);
      setActiveCategory(mode);
    }

    const savedCustom = localStorage.getItem("kletron-custom-categories");
    if (savedCustom) {
      try {
        const parsed = JSON.parse(savedCustom);
        setCustomCategories(
          parsed.map((c: any) => ({
            ...c,
            createdAt: new Date(c.createdAt),
            updatedAt: new Date(c.updatedAt),
          })),
        );
      } catch {
        // Ignore parse errors
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("kletron-active-category", activeCategory);
  }, [activeCategory]);

  useEffect(() => {
    localStorage.setItem("kletron-custom-categories", JSON.stringify(customCategories));
  }, [customCategories]);

  const allCategories = [...BUILT_IN_CATEGORIES, ...customCategories] as (WorkCategory | CustomCategory)[];

  const activeCategoryConfig = allCategories.find((c) => c.id === activeCategory);

  const setActiveCategoryAndSave = useCallback(
    (categoryId: string) => {
      const mode = normalizeToWorkModeId(categoryId);
      if (allCategories.some((c) => c.id === mode)) {
        setCategoryHistory((prev) => {
          const newHistory = [mode, ...prev.filter((id) => id !== mode)].slice(0, 10);
          return newHistory;
        });
        setActiveCategory(mode);
      }
    },
    [allCategories],
  );

  const addCustomCategory = useCallback((category: Omit<CustomCategory, "id" | "createdAt" | "updatedAt">) => {
    const newCategory: CustomCategory = {
      ...category,
      id: `custom_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    setCustomCategories((prev) => [...prev, newCategory]);
    return newCategory;
  }, []);

  const removeCustomCategory = useCallback((categoryId: string) => {
    setCustomCategories((prev) => prev.filter((c) => c.id !== categoryId));
  }, []);

  const updateCustomCategory = useCallback(
    (categoryId: string, updates: Partial<Omit<CustomCategory, "id" | "createdAt" | "updatedAt">>) => {
      setCustomCategories((prev) =>
        prev.map((c) => (c.id === categoryId ? { ...c, ...updates, updatedAt: new Date() } : c)),
      );
    },
    [],
  );

  const isCodingCategory = activeCategory === "code";

  const availableTools = activeCategoryConfig?.availableTools || [];

  const skills = (activeCategoryConfig as WorkCategory)?.skills || [];

  const connectors = (activeCategoryConfig as WorkCategory)?.connectors || [];

  return {
    activeCategory,
    activeCategoryConfig,
    allCategories,
    customCategories,
    categoryHistory,
    setActiveCategory: setActiveCategoryAndSave,
    addCustomCategory,
    removeCustomCategory,
    updateCustomCategory,
    isCodingCategory,
    availableTools,
    skills,
    connectors,
    getCategoryById: (id: string) => allCategories.find((c) => c.id === normalizeToWorkModeId(id)),
  };
}
