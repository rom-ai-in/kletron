import type { SkillDefinition } from "./types";

/**
 * Workspace-specific skill configuration
 */
export interface WorkspaceSkillConfig {
    /** Skill ID */
    id: string;
    /** Workspace ID this config applies to */
    workspaceId: string;
    /** Override for required tools in this workspace */
    requiredTools?: string[];
    /** Override for suggested tools in this workspace */
    suggestedTools?: string[];
    /** Workspace-specific system prompt additions */
    workspacePromptPrefix?: string;
    /** Workspace-specific system prompt additions */
    workspacePromptSuffix?: string;
    /** Last updated timestamp */
    updatedAt: Date;
}

/**
 * Work category definition (maps to CoWork-style categories)
 */
export interface WorkCategory {
    id: string;
    name: string;
    description: string;
    icon: string;
    color: string;
    /** Default skills for this category */
    defaultSkills: string[];
    /** Tools commonly used in this category */
    commonTools: string[];
    /** Category-specific prompt template */
    promptTemplate?: string;
}

/**
 * Enhanced skill definition with workspace awareness
 */
export interface WorkspaceAwareSkill extends SkillDefinition {
    /** Workspace-specific overrides */
    workspaceOverrides?: Record<string, Partial<WorkspaceSkillConfig>>;
    /** Categories this skill belongs to */
    categories?: string[];
}

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
        ]
    },
    {
        id: "drafting",
        name: "Document Drafting",
        description: "Create and edit professional documents",
        icon: "✏️",
        color: "#10B981",
        defaultSkills: ["technical-writing", "documentation", "summarization"],
        commonTools: ["web_search", "fetch_url", "output_format"]
    },
    {
        id: "automation",
        name: "Workflow Automation",
        description: "Create automated workflows and follow-ups",
        icon: "⚡",
        color: "#F59E0B",
        defaultSkills: ["workflow-design", "task-automation", "scheduling"],
        commonTools: ["execute_bash", "git_commit", "str_replace_editor"]
    },
    {
        id: "general",
        name: "General Assistance",
        description: "Open-ended questions and general help",
        icon: "🎯",
        color: "#6B7280",
        defaultSkills: ["research", "explanation", "brainstorming"],
        commonTools: ["web_search", "fetch_url"]
    }
];