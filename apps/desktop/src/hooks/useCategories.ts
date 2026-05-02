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

/** When set, GET/POST `/api/work-categories/current` (same contract as web agent). */
export type UseCategoriesSync = {
  backendUrlTrimmed: string;
  backendReady: boolean;
  getAccessToken: () => Promise<string | null>;
  activeWorkspaceId: string | null;
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

export function useCategories(sync?: UseCategoriesSync) {
  const [activeCategory, setActiveCategoryState] = useState<WorkModeId>("code");
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>([]);
  const [categoryHistory, setCategoryHistory] = useState<WorkModeId[]>(["code"]);

  useEffect(() => {
    const savedCategory = localStorage.getItem("kletron-active-category");
    if (savedCategory) {
      const mode = normalizeToWorkModeId(savedCategory);
      setActiveCategoryState(mode);
    }

    const savedCustom = localStorage.getItem("kletron-custom-categories");
    if (savedCustom) {
      try {
        const parsed = JSON.parse(savedCustom);
        setCustomCategories(
          parsed.map((c: Record<string, unknown>) => ({
            ...c,
            createdAt: new Date(c.createdAt as string),
            updatedAt: new Date(c.updatedAt as string),
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

  // Hydrate from server when workspace is known (matches web agent workMode).
  useEffect(() => {
    if (!sync?.backendReady || !sync.activeWorkspaceId) return;
    const wsId = sync.activeWorkspaceId;
    let cancelled = false;
    const lsKey = `kletron-work-mode-${wsId}`;
    const fromLs = typeof window !== "undefined" ? window.localStorage.getItem(lsKey) : null;

    void (async () => {
      try {
        const token = await sync.getAccessToken();
        if (!token || cancelled) return;
        const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
        headers["x-workspace-id"] = wsId;
        const res = await fetch(
          `${sync.backendUrlTrimmed}/api/work-categories/current?workspaceId=${encodeURIComponent(wsId)}`,
          { headers },
        );
        if (res.ok) {
          const json = (await res.json()) as { data?: string | null };
          if (json.data != null && json.data !== "") {
            const m = normalizeToWorkModeId(String(json.data));
            if (!cancelled) {
              setActiveCategoryState(m);
              try {
                window.localStorage.setItem(lsKey, m);
              } catch {
                /* ignore */
              }
            }
            return;
          }
        }
      } catch {
        /* fall through */
      }
      if (cancelled) return;
      if (fromLs === "code" || fromLs === "work") {
        setActiveCategoryState(fromLs);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sync?.backendReady, sync?.backendUrlTrimmed, sync?.activeWorkspaceId, sync?.getAccessToken]);

  const allCategories = [...BUILT_IN_CATEGORIES, ...customCategories] as (WorkCategory | CustomCategory)[];

  const activeCategoryConfig = allCategories.find((c) => c.id === activeCategory);

  const setActiveCategoryAndSave = useCallback(
    async (categoryId: string) => {
      const mode = normalizeToWorkModeId(categoryId);
      if (!allCategories.some((c) => c.id === mode)) return;

      const prev = activeCategory;
      setCategoryHistory((h) => {
        const newHistory = [mode, ...h.filter((id) => id !== mode)].slice(0, 10);
        return newHistory;
      });
      setActiveCategoryState(mode);

      const lsKey = sync?.activeWorkspaceId ? `kletron-work-mode-${sync.activeWorkspaceId}` : null;
      if (lsKey) {
        try {
          window.localStorage.setItem(lsKey, mode);
        } catch {
          /* ignore */
        }
      }

      if (!sync?.backendReady || !sync.getAccessToken) return;

      try {
        const token = await sync.getAccessToken();
        if (!token) return;
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        };
        if (sync.activeWorkspaceId) headers["x-workspace-id"] = sync.activeWorkspaceId;
        const res = await fetch(`${sync.backendUrlTrimmed}/api/work-categories/current`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            workMode: mode,
            workspaceId: sync.activeWorkspaceId ?? undefined,
          }),
        });
        if (!res.ok) throw new Error("persist failed");
      } catch {
        setActiveCategoryState(prev);
        if (lsKey) {
          try {
            window.localStorage.setItem(lsKey, prev);
          } catch {
            /* ignore */
          }
        }
      }
    },
    [allCategories, activeCategory, sync],
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
