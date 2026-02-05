import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import { config } from "../config.js";

// ─────────────────────────────────────────────────────────────────────────────
// SKILL LOADER TOOLS
// MCP tools for loading and listing skills
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_SKILLS_DIR = ".agent/skills";
const SKILL_FILE_NAME = "SKILL.md";

function getSkillsDir() {
    if (!config.defaultDir) {
        throw new Error("Repository path not configured. Set it in Configuration > Repository Settings.");
    }
    return path.join(config.defaultDir, DEFAULT_SKILLS_DIR);
}

/**
 * Load a skill's full definition and instructions.
 */
export const loadSkill = {
    name: "load_skill",
    description: "Load a skill's definition and instructions by ID. Returns the skill metadata and system prompt.",
    inputSchema: {
        type: "object",
        properties: {
            skillId: {
                type: "string",
                description: "Skill identifier (folder name in .agent/skills/)",
            },
        },
        required: ["skillId"],
    },

    async handler({ skillId }) {
        const skillPath = path.join(getSkillsDir(), skillId, SKILL_FILE_NAME);

        try {
            const content = await fs.readFile(skillPath, "utf-8");
            const { data, content: body } = matter(content);

            return {
                id: skillId,
                name: data.name ?? skillId,
                version: data.version ?? "1.0.0",
                description: data.description ?? "",
                systemPrompt: body.trim(),
                requiredTools: data.requiredTools ?? [],
                suggestedTools: data.suggestedTools ?? [],
                extends: data.extends ?? [],
                tags: data.tags ?? [],
                outputFormat: data.outputFormat,
                maxToolCalls: data.maxToolCalls,
                author: data.author,
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to load skill "${skillId}": ${message}`);
        }
    },
};

/**
 * List all available skills with their metadata.
 */
export const listSkills = {
    name: "list_skills",
    description: "List all available skills with their IDs, names, and descriptions.",
    inputSchema: {
        type: "object",
        properties: {},
    },

    async handler() {
        const skillsDir = getSkillsDir();
        const skills = [];

        try {
            const entries = await fs.readdir(skillsDir, { withFileTypes: true });

            for (const entry of entries) {
                if (!entry.isDirectory()) continue;

                const skillPath = path.join(skillsDir, entry.name, SKILL_FILE_NAME);
                try {
                    const content = await fs.readFile(skillPath, "utf-8");
                    const { data } = matter(content);

                    skills.push({
                        id: entry.name,
                        name: data.name ?? entry.name,
                        version: data.version ?? "1.0.0",
                        description: data.description ?? "",
                        tags: data.tags ?? [],
                        requiredTools: data.requiredTools ?? [],
                        extends: data.extends ?? [],
                    });
                } catch {
                    // Skip directories without valid SKILL.md
                }
            }

            return { skills, count: skills.length };
        } catch (error) {
            if (error.code === "ENOENT") {
                return { skills: [], count: 0, message: "Skills directory not found" };
            }
            throw error;
        }
    },
};
