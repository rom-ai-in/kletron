import { useState, useEffect, useCallback } from "react";

// ============================================================================
// TYPES
// ============================================================================

export type WorkCategory = {
  id: string;
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
// BUILT-IN CATEGORIES
// ============================================================================

export const BUILT_IN_CATEGORIES: WorkCategory[] = [
  {
    id: "coding",
    name: "Code",
    description: "AI-powered code assistance, analysis, and generation",
    icon: null,
    color: "#3B82F6",
    defaultPrompt: "You are a senior software engineer helping with code tasks. Provide clear, concise technical guidance.",
    availableTools: ["list_files", "read_file", "search_code", "execute_bash", "git_commit", "git_push"],
    skills: ["code-review", "implementation", "testing", "debugging"],
    connectors: ["git", "github", "gitlab"],
  },
  {
    id: "general",
    name: "General",
    description: "General purpose assistance and information retrieval",
    icon: null,
    color: "#6B7280",
    defaultPrompt: "You are a helpful assistant that can answer questions, provide information, and help with various tasks.",
    availableTools: ["web_search", "fetch_url", "calculate"],
    skills: ["research", "explanation", "brainstorming"],
    connectors: [],
  },
  {
    id: "drafting",
    name: "Draft",
    description: "Document creation, editing, and professional writing",
    icon: null,
    color: "#10B981",
    defaultPrompt: "You are a professional technical writer creating clear, well-structured documents.",
    availableTools: ["fetch_url", "web_search", "read_file"],
    skills: ["technical-writing", "documentation", "summarization"],
    connectors: ["document_storage", "cloud_drive"],
  },
  {
    id: "automation",
    name: "Automate",
    description: "Workflow automation and task scheduling",
    icon: null,
    color: "#F59E0B",
    defaultPrompt: "You are a productivity automation specialist focused on optimizing workflows.",
    availableTools: ["execute_bash", "schedule_task", "git_automation"],
    skills: ["workflow-design", "task-automation", "scheduling"],
    connectors: ["calendar", "email", "task_management"],
  },
];

// ============================================================================
// HOOK
// ============================================================================

export function useCategories() {
  const [activeCategory, setActiveCategory] = useState<string>("coding");
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>([]);
  const [categoryHistory, setCategoryHistory] = useState<string[]>(["coding"]);

  // Load saved category preference from localStorage
  useEffect(() => {
    const savedCategory = localStorage.getItem('kletron-active-category');
    if (savedCategory && BUILT_IN_CATEGORIES.some(c => c.id === savedCategory)) {
      setActiveCategory(savedCategory);
    }

    const savedCustom = localStorage.getItem('kletron-custom-categories');
    if (savedCustom) {
      try {
        const parsed = JSON.parse(savedCustom);
        setCustomCategories(parsed.map((c: any) => ({
          ...c,
          createdAt: new Date(c.createdAt),
          updatedAt: new Date(c.updatedAt),
        })));
      } catch {
        // Ignore parse errors
      }
    }
  }, []);

  // Save active category to localStorage
  useEffect(() => {
    localStorage.setItem('kletron-active-category', activeCategory);
  }, [activeCategory]);

  // Save custom categories to localStorage
  useEffect(() => {
    localStorage.setItem('kletron-custom-categories', JSON.stringify(customCategories));
  }, [customCategories]);

  // Get all available categories (built-in + custom)
  const allCategories = [...BUILT_IN_CATEGORIES, ...customCategories] as (WorkCategory | CustomCategory)[];

  // Get active category config
  const activeCategoryConfig = allCategories.find(c => c.id === activeCategory);

  // Set active category with history tracking
  const setActiveCategoryAndSave = useCallback((categoryId: string) => {
    if (allCategories.some(c => c.id === categoryId)) {
      setCategoryHistory(prev => {
        const newHistory = [categoryId, ...prev.filter(id => id !== categoryId)].slice(0, 10);
        return newHistory;
      });
      setActiveCategory(categoryId);
    }
  }, [allCategories]);

  // Add custom category
  const addCustomCategory = useCallback((category: Omit<CustomCategory, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newCategory: CustomCategory = {
      ...category,
      id: `custom_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    setCustomCategories(prev => [...prev, newCategory]);
    return newCategory;
  }, []);

  // Remove custom category
  const removeCustomCategory = useCallback((categoryId: string) => {
    setCustomCategories(prev => prev.filter(c => c.id !== categoryId));
  }, []);

  // Update custom category
  const updateCustomCategory = useCallback((categoryId: string, updates: Partial<Omit<CustomCategory, 'id' | 'createdAt' | 'updatedAt'>>) => {
    setCustomCategories(prev =>
      prev.map(c =>
        c.id === categoryId
          ? { ...c, ...updates, updatedAt: new Date() }
          : c
      )
    );
  }, []);

  // Check if current category is coding
  const isCodingCategory = activeCategory === "coding";

  // Get available tools for current category
  const availableTools = activeCategoryConfig?.availableTools || [];

  // Get skills for current category
  const skills = (activeCategoryConfig as WorkCategory)?.skills || [];

  // Get connectors for current category
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
    getCategoryById: (id: string) => allCategories.find(c => c.id === id),
  };
}
