// Canonical Skill types shared across server, agent runtime, and UI.
// A "skill" is a SKILL.md document (YAML frontmatter + markdown body) that
// both injects into the agent system prompt and gates a set of MCP tools.

import { z } from "zod";

export type SkillSource = "builtin" | "user";

/** Frontmatter as authored in SKILL.md. */
export interface SkillFrontmatter {
    name: string;
    version?: string;
    description?: string;
    tags?: string[];
    author?: string;
    requiredTools?: string[];
    suggestedTools?: string[];
    extends?: string[];
    outputFormat?: "json" | "markdown" | "mixed";
    maxToolCalls?: number;
}

/** Persisted skill record (Mongo or filesystem-derived). */
export interface SkillRecord {
    /** Unique slug (kebab-case). */
    slug: string;
    name: string;
    version: string;
    description: string;
    tags: string[];
    requiredTools: string[];
    suggestedTools: string[];
    extends: string[];
    body: string;
    source: SkillSource;
    /** Owner user id (only for source=user). */
    ownerId?: string;
    /** Owner organization (optional, future-use). */
    organizationId?: string;
    author?: string;
    outputFormat?: "json" | "markdown" | "mixed";
    maxToolCalls?: number;
    createdAt: string;
    updatedAt: string;
}

/** Workspace-side activation record. */
export interface WorkspaceSkillRecord {
    workspaceId: string;
    skillSlug: string;
    enabled: boolean;
    addedAt: string;
    configOverride?: Record<string, unknown>;
}

/** Resolved skill (after extends-chain flattening). */
export interface ResolvedSkillRecord extends SkillRecord {
    resolvedSystemPrompt: string;
    resolvedTools: string[];
    extendsChain: string[];
}

// ─── Zod validators ─────────────────────────────────────────────────────────

export const SLUG_REGEX = /^[a-z0-9][a-z0-9-]{1,63}$/;

export const skillFrontmatterSchema = z.object({
    name: z.string().min(1, "name is required"),
    version: z
        .string()
        .regex(/^\d+\.\d+\.\d+/, "version must be semver (x.y.z)")
        .optional(),
    description: z.string().optional(),
    tags: z.array(z.string()).optional(),
    author: z.string().optional(),
    requiredTools: z.array(z.string()).optional(),
    suggestedTools: z.array(z.string()).optional(),
    extends: z.array(z.string()).optional(),
    outputFormat: z.enum(["json", "markdown", "mixed"]).optional(),
    maxToolCalls: z.number().int().positive().optional(),
});

export const skillCreateSchema = z.object({
    slug: z
        .string()
        .regex(SLUG_REGEX, "slug must be lowercase kebab-case (a-z0-9-)"),
    frontmatter: skillFrontmatterSchema,
    body: z.string().default(""),
});

export const skillUpdateSchema = z.object({
    frontmatter: skillFrontmatterSchema.partial(),
    body: z.string().optional(),
});

export type SkillCreateInput = z.infer<typeof skillCreateSchema>;
export type SkillUpdateInput = z.infer<typeof skillUpdateSchema>;

/** Compose a SKILL.md text representation from a record. */
export function composeSkillMarkdown(skill: Pick<SkillRecord, "name" | "version" | "description" | "tags" | "requiredTools" | "suggestedTools" | "extends" | "outputFormat" | "maxToolCalls" | "author" | "body">): string {
    const fm: Record<string, unknown> = { name: skill.name };
    if (skill.version) fm.version = skill.version;
    if (skill.description) fm.description = skill.description;
    if (skill.tags?.length) fm.tags = skill.tags;
    if (skill.author) fm.author = skill.author;
    if (skill.requiredTools?.length) fm.requiredTools = skill.requiredTools;
    if (skill.suggestedTools?.length) fm.suggestedTools = skill.suggestedTools;
    if (skill.extends?.length) fm.extends = skill.extends;
    if (skill.outputFormat) fm.outputFormat = skill.outputFormat;
    if (skill.maxToolCalls) fm.maxToolCalls = skill.maxToolCalls;

    const yamlLines: string[] = ["---"];
    for (const [k, v] of Object.entries(fm)) {
        if (Array.isArray(v)) {
            yamlLines.push(`${k}:`);
            for (const item of v) yamlLines.push(`  - ${item}`);
        } else {
            yamlLines.push(`${k}: ${v}`);
        }
    }
    yamlLines.push("---", "");
    return `${yamlLines.join("\n")}\n${skill.body ?? ""}`;
}
