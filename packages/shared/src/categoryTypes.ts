// packages/shared/src/categoryTypes.ts

export type WorkCategoryId = 
  | 'coding'
  | 'drafting'
  | 'automation'
  | 'general'
  | string;

export interface WorkCategoryConfig {
  id: WorkCategoryId;
  name: string;
  description: string;
  icon?: string;
  color?: string;
  defaultPrompt: string;
  availableTools: string[]; // MCP tool names
  requiredContextTypes: string[];
  capabilities: {
    canEditFiles?: boolean;
    canAccessExternalServices?: boolean;
    canScheduleTasks?: boolean;
    canUseTerminal?: boolean;
  };
  workspaceSpecific?: boolean;
}

export interface WorkspaceCategoryConfig extends WorkCategoryConfig {
  workspaceId: string;
  customName?: string;
  customTools?: string[];
}

export interface CategoryState {
  currentCategory: WorkCategoryId;
  categoryHistory: WorkCategoryId[];
  lastUsed: Record<WorkCategoryId, Date>;
}

// Built-in categories
export const BUILT_IN_CATEGORIES: Record<WorkCategoryId, Omit<WorkCategoryConfig, 'id'>> = {
  coding: {
    name: "Code Assistance",
    description: "AI-powered code analysis, generation, and debugging",
    icon: "code",
    color: "#3B82F6",
    defaultPrompt: "You are a senior software engineer helping with code tasks. Focus on code quality, best practices, and maintainability.",
    availableTools: ["list_files", "read_file", "search_code", "edit_file", "execute_bash", "git_commit", "git_push"],
    requiredContextTypes: ["repository", "codebase"],
    capabilities: {
      canEditFiles: true,
      canAccessExternalServices: false,
      canScheduleTasks: false,
      canUseTerminal: true
    },
    workspaceSpecific: true
  },
  drafting: {
    name: "Document Drafting",
    description: "Create and edit professional documents",
    icon: "doc",
    color: "#10B981",
    defaultPrompt: "You are a professional technical writer. Create clear, well-structured documentation with proper formatting.",
    availableTools: ["fetch_url", "web_search", "read_file", "write_file"],
    requiredContextTypes: ["document_template"],
    capabilities: {
      canEditFiles: true,
      canAccessExternalServices: true,
      canScheduleTasks: false,
      canUseTerminal: false
    },
    workspaceSpecific: false
  },
  automation: {
    name: "Workflow Automation",
    description: "Create automated workflows and follow-ups",
    icon: "zap",
    color: "#F59E0B",
    defaultPrompt: "You are a productivity automation specialist. Create efficient, reliable automations for repetitive tasks.",
    availableTools: ["execute_bash", "git_commit", "schedule_task", "calendar_events"],
    requiredContextTypes: ["calendar", "email"],
    capabilities: {
      canEditFiles: false,
      canAccessExternalServices: true,
      canScheduleTasks: true,
      canUseTerminal: true
    },
    workspaceSpecific: false
  },
  general: {
    name: "General Assistance",
    description: "General purpose AI assistance for any task",
    icon: "chat",
    color: "#6B7280",
    defaultPrompt: "You are a helpful AI assistant. Provide accurate, concise answers to user questions.",
    availableTools: ["web_search", "fetch_url"],
    requiredContextTypes: [],
    capabilities: {
      canEditFiles: false,
      canAccessExternalServices: true,
      canScheduleTasks: false,
      canUseTerminal: false
    },
    workspaceSpecific: false
  }
};
