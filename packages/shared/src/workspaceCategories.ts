import type { WorkCategory } from "@kletron/agent-core";

/**
 * Default work categories for CoWork-style app
 */
export const DEFAULT_WORK_CATEGORIES: WorkCategory[] = [
    {
        id: "coding",
        name: "Code Assistance",
        description: "AI-powered code analysis, generation, and debugging",
        icon: "💻",
        color: "#3B82F6",
        defaultSkills: ["code-review", "implementation", "testing", "debugging"],
        commonTools: [
            "list_files", "read_file", "search_code", "git_log", 
            "git_diff", "structural_search", "symbols_list"
        ],
        promptTemplate: "You are a senior software engineer helping with code tasks."
    },
    {
        id: "drafting",
        name: "Document Drafting",
        description: "Create and edit professional documents",
        icon: "✏️",
        color: "#10B981",
        defaultSkills: ["technical-writing", "documentation", "summarization"],
        commonTools: ["web_search", "fetch_url", "output_format"],
        promptTemplate: "You are a professional technical writer."
    },
    {
        id: "automation",
        name: "Workflow Automation",
        description: "Create automated workflows and follow-ups",
        icon: "⚡",
        color: "#F59E0B",
        defaultSkills: ["workflow-design", "task-automation", "scheduling"],
        commonTools: ["execute_bash", "git_commit", "str_replace_editor"],
        promptTemplate: "You are a productivity automation specialist."
    },
    {
        id: "general",
        name: "General Assistance",
        description: "Open-ended questions and general help",
        icon: "🎯",
        color: "#6B7280",
        defaultSkills: ["research", "explanation", "brainstorming"],
        commonTools: ["web_search", "fetch_url"],
        promptTemplate: "You are a versatile assistant capable of handling diverse tasks."
    }
];

/**
 * Get category by ID
 */
export function getCategoryById(id: string): WorkCategory | undefined {
    return DEFAULT_WORK_CATEGORIES.find(cat => cat.id === id);
}

/**
 * Get all available categories
 */
export function getAllCategories(): WorkCategory[] {
    return [...DEFAULT_WORK_CATEGORIES];
}

/**
 * Category-specific tool groups
 */
export const CATEGORY_TOOL_GROUPS = {
    coding: [
        "file_system",
        "git",
        "code_analysis",
        "testing"
    ],
    drafting: [
        "document_management",
        "web_research",
        "formatting"
    ],
    automation: [
        "task_execution",
        "scheduling",
        "integration"
    ],
    general: [
        "web_search",
        "research",
        "general_tools"
    ]
} as const;

/**
 * Category-specific connector groups
 */
export const CATEGORY_CONNECTOR_GROUPS = {
    coding: [
        "git",
        "github",
        "gitlab",
        "bitbucket"
    ],
    drafting: [
        "document_storage",
        "cloud_drive"
    ],
    automation: [
        "calendar",
        "email",
        "task_management",
        "notification"
    ],
    general: [
        "web_api",
        "data_sources"
    ]
} as const;
