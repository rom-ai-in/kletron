import { promises as fs } from "fs";
import path from "path";
import matter from "gray-matter";
import { getConfig } from "@numezis/server/config";
import { getWorkspaceContext } from "@numezis/server/workspace/workspaceContext";
import type {
    SkillDefinition,
    ResolvedSkill,
    SkillLoadResult,
    SkillValidationResult,
    SkillValidationError,
} from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_SKILLS_DIR = ".agent/skills";
const SKILL_FILE_NAME = "SKILL.md";

async function resolveBaseDir(baseDir?: string): Promise<string> {
    if (baseDir && baseDir.trim()) return baseDir;
    const workspaceContext = getWorkspaceContext();
    if (workspaceContext?.rootPath) return workspaceContext.rootPath;
    const cfg = await getConfig();
    return cfg.workingFolder;
}

// ─────────────────────────────────────────────────────────────────────────────
// SKILL LOADER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Load a single skill definition from its SKILL.md file.
 */
export async function loadSkill(
    skillId: string,
    baseDir?: string
): Promise<SkillLoadResult> {
    const resolvedBaseDir = await resolveBaseDir(baseDir);
    const skillsDir = path.join(resolvedBaseDir, DEFAULT_SKILLS_DIR);
    const skillPath = path.join(skillsDir, skillId, SKILL_FILE_NAME);

    try {
        const content = await fs.readFile(skillPath, "utf-8");
        const { data, content: body } = matter(content);

        const skill: SkillDefinition = {
            id: skillId,
            name: data.name ?? skillId,
            version: data.version ?? "1.0.0",
            description: data.description ?? "",
            systemPromptPrefix: body.trim() || undefined,
            requiredTools: normalizeStringArray(data.requiredTools),
            suggestedTools: normalizeStringArray(data.suggestedTools),
            extends: normalizeStringArray(data.extends),
            tags: normalizeStringArray(data.tags),
            outputFormat: data.outputFormat,
            maxToolCalls: data.maxToolCalls,
            llmSelection: data.llmSelection,
            author: data.author,
        };

        return {
            skill,
            filePath: skillPath,
            loadedAt: new Date(),
        };
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to load skill "${skillId}": ${message}`);
    }
}

/**
 * List all available skill IDs by scanning the skills directory.
 */
export async function listSkillIds(
    baseDir?: string
): Promise<string[]> {
    const resolvedBaseDir = await resolveBaseDir(baseDir);
    const skillsDir = path.join(resolvedBaseDir, DEFAULT_SKILLS_DIR);

    try {
        const entries = await fs.readdir(skillsDir, { withFileTypes: true });
        const skillIds: string[] = [];

        for (const entry of entries) {
            if (!entry.isDirectory()) continue;
            // Verify SKILL.md exists
            const skillFile = path.join(skillsDir, entry.name, SKILL_FILE_NAME);
            try {
                await fs.access(skillFile);
                skillIds.push(entry.name);
            } catch {
                // No SKILL.md, skip this directory
            }
        }

        return skillIds.sort();
    } catch (error: unknown) {
        // Directory doesn't exist yet
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
            return [];
        }
        throw error;
    }
}

/**
 * Load all skills from the skills directory.
 */
export async function loadAllSkills(
    baseDir?: string
): Promise<Map<string, SkillDefinition>> {
    const resolvedBaseDir = await resolveBaseDir(baseDir);
    const skillIds = await listSkillIds(resolvedBaseDir);
    const skills = new Map<string, SkillDefinition>();

    for (const id of skillIds) {
        try {
            const { skill } = await loadSkill(id, resolvedBaseDir);
            skills.set(id, skill);
        } catch (error) {
            console.warn(`[SkillLoader] Failed to load skill "${id}":`, error);
        }
    }

    return skills;
}

// ─────────────────────────────────────────────────────────────────────────────
// SKILL RESOLVER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolve a skill by flattening its extends chain.
 */
export async function resolveSkill(
    skillId: string,
    skillsMap: Map<string, SkillDefinition>,
    visited: Set<string> = new Set()
): Promise<ResolvedSkill> {
    // Circular dependency check
    if (visited.has(skillId)) {
        throw new Error(`Circular skill dependency detected: ${Array.from(visited).concat(skillId).join(" -> ")}`);
    }

    const skill = skillsMap.get(skillId);
    if (!skill) {
        throw new Error(`Skill not found: "${skillId}"`);
    }

    visited.add(skillId);

    // Base case: no extends
    if (!skill.extends || skill.extends.length === 0) {
        return {
            ...skill,
            resolvedSystemPrompt: skill.systemPromptPrefix ?? "",
            resolvedTools: [...(skill.requiredTools ?? []), ...(skill.suggestedTools ?? [])],
            extendsChain: [skillId],
        };
    }

    // Recursive case: resolve parent skills first
    const parentPrompts: string[] = [];
    const parentTools: string[] = [];
    const extendsChain: string[] = [];

    for (const parentId of skill.extends) {
        const resolved = await resolveSkill(parentId, skillsMap, new Set(visited));
        if (resolved.resolvedSystemPrompt) {
            parentPrompts.push(resolved.resolvedSystemPrompt);
        }
        parentTools.push(...resolved.resolvedTools);
        extendsChain.push(...resolved.extendsChain);
    }

    // Merge: parent prompts first, then this skill's prompt
    const allPrompts = [...parentPrompts];
    if (skill.systemPromptPrefix) {
        allPrompts.push(skill.systemPromptPrefix);
    }

    // Merge tools: dedupe
    const allTools = [
        ...parentTools,
        ...(skill.requiredTools ?? []),
        ...(skill.suggestedTools ?? []),
    ];

    return {
        ...skill,
        resolvedSystemPrompt: allPrompts.join("\n\n---\n\n"),
        resolvedTools: Array.from(new Set(allTools)),
        extendsChain: extendsChain.concat(skillId),
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// SKILL VALIDATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validate a skill definition.
 */
export function validateSkill(skill: SkillDefinition): SkillValidationResult {
    const errors: SkillValidationError[] = [];
    const warnings: string[] = [];

    // Required fields
    if (!skill.id || skill.id.trim() === "") {
        errors.push({ skillId: skill.id, field: "id", message: "Skill ID is required" });
    }

    if (!skill.name || skill.name.trim() === "") {
        errors.push({ skillId: skill.id, field: "name", message: "Skill name is required" });
    }

    // ID format (alphanumeric + hyphens)
    if (skill.id && !/^[a-z0-9-]+$/.test(skill.id)) {
        errors.push({
            skillId: skill.id,
            field: "id",
            message: "Skill ID must be lowercase alphanumeric with hyphens only",
        });
    }

    // Version format
    if (skill.version && !/^\d+\.\d+\.\d+/.test(skill.version)) {
        warnings.push(`Skill "${skill.id}": version should follow semver format (x.y.z)`);
    }

    // Empty prompt warning
    if (!skill.systemPromptPrefix && (!skill.extends || skill.extends.length === 0)) {
        warnings.push(`Skill "${skill.id}": no system prompt or extends defined`);
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings,
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function normalizeStringArray(value: unknown): string[] | undefined {
    if (!value) return undefined;
    if (Array.isArray(value)) {
        return value.filter((v): v is string => typeof v === "string");
    }
    if (typeof value === "string") {
        return [value];
    }
    return undefined;
}

/**
 * Get the skills directory path.
 */
export function getSkillsDir(baseDir: string = process.cwd()): string {
    return path.join(baseDir, DEFAULT_SKILLS_DIR);
}

/**
 * Get the path to a specific skill's SKILL.md file.
 */
export function getSkillFilePath(skillId: string, baseDir: string = process.cwd()): string {
    return path.join(getSkillsDir(baseDir), skillId, SKILL_FILE_NAME);
}
