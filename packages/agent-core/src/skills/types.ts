import type { LlmProviderType } from "@kletron/shared/schemas/llmConfig.schema";

// ─────────────────────────────────────────────────────────────────────────────
// SKILL DEFINITION TYPES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Base skill definition as stored in SKILL.md frontmatter + body.
 */
export interface SkillDefinition {
    /** Unique identifier (folder name) */
    id: string;
    /** Human-readable name */
    name: string;
    /** Semantic version */
    version: string;
    /** Short description */
    description: string;

    // ─── Prompt Injection ───────────────────────────────────────────────────────
    /** Prepended to node's system prompt */
    systemPromptPrefix?: string;
    /** Appended after node's system prompt */
    systemPromptSuffix?: string;

    // ─── Tool Configuration ─────────────────────────────────────────────────────
    /** Tools this skill requires to function */
    requiredTools?: string[];
    /** Tools that enhance this skill's capabilities */
    suggestedTools?: string[];

    // ─── Behavior Modifiers ─────────────────────────────────────────────────────
    /** Expected output format */
    outputFormat?: "json" | "markdown" | "mixed";
    /** Maximum tool calls allowed */
    maxToolCalls?: number;
    /** LLM provider/model preference */
    llmSelection?: { provider: LlmProviderType; model?: string };

    // ─── Composition ────────────────────────────────────────────────────────────
    /** Other skill IDs to inherit from (resolved recursively) */
    extends?: string[];

    // ─── Metadata ───────────────────────────────────────────────────────────────
    /** Categorization tags */
    tags?: string[];
    /** Skill author */
    author?: string;
}

/**
 * Resolved skill with all extensions flattened and prompts merged.
 */
export interface ResolvedSkill extends SkillDefinition {
    /** Full system prompt after resolving extends chain */
    resolvedSystemPrompt: string;
    /** Merged tool list from all extended skills */
    resolvedTools: string[];
    /** Chain of skills this was resolved from */
    extendsChain: string[];
}

/**
 * Skill manifest for bulk operations (optional).
 */
export interface SkillManifest {
    skills: Record<string, SkillDefinition>;
    version: string;
    generatedAt: Date;
}

// ─────────────────────────────────────────────────────────────────────────────
// SKILL REGISTRY TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface SkillRegistryOptions {
    /** Base directory for skills (default: .agent/skills) */
    skillsDir?: string;
    /** Enable file watching for hot reload */
    watchEnabled?: boolean;
    /** Cache TTL in milliseconds (default: 60000) */
    cacheTtlMs?: number;
}

export interface SkillLoadResult {
    skill: SkillDefinition;
    filePath: string;
    loadedAt: Date;
}

export interface SkillValidationError {
    skillId: string;
    field: string;
    message: string;
}

export interface SkillValidationResult {
    valid: boolean;
    errors: SkillValidationError[];
    warnings: string[];
}
