#!/usr/bin/env npx ts-node --transpile-only

/**
 * Numezis Skills CLI
 * 
 * Usage:
 *   npx ts-node scripts/skills-cli.ts list
 *   npx ts-node scripts/skills-cli.ts get <skillId>
 *   npx ts-node scripts/skills-cli.ts validate
 *   npx ts-node scripts/skills-cli.ts init <skillId>
 */

import { promises as fs } from "fs";
import path from "path";

// Direct implementation to avoid module resolution issues in CLI
const SKILLS_DIR = ".agent/skills";
const SKILL_FILE = "SKILL.md";

interface SkillMeta {
    id: string;
    name: string;
    description: string;
    extends: string[];
    requiredTools: string[];
}

interface SkillFrontmatter {
    name?: string;
    description?: string;
    extends?: string[] | string;
    requiredTools?: string[] | string;
}

async function listSkills(): Promise<void> {
    const skillsPath = path.join(process.cwd(), SKILLS_DIR);

    try {
        const entries = await fs.readdir(skillsPath, { withFileTypes: true });
        const skills: SkillMeta[] = [];

        for (const entry of entries) {
            if (!entry.isDirectory()) continue;
            const skillFile = path.join(skillsPath, entry.name, SKILL_FILE);
            try {
                const content = await fs.readFile(skillFile, "utf-8");
                const meta = parseYamlFrontmatter(content);
                const name = typeof meta.name === "string" ? meta.name : entry.name;
                const description = typeof meta.description === "string" ? meta.description : "";
                const extendsList = Array.isArray(meta.extends)
                    ? meta.extends
                    : typeof meta.extends === "string"
                        ? [meta.extends]
                        : [];
                const requiredTools = Array.isArray(meta.requiredTools)
                    ? meta.requiredTools
                    : typeof meta.requiredTools === "string"
                        ? [meta.requiredTools]
                        : [];
                skills.push({
                    id: entry.name,
                    name,
                    description,
                    extends: extendsList,
                    requiredTools,
                });
            } catch {
                // Skip dirs without valid SKILL.md
            }
        }

        console.log("\n📚 Available Skills\n");
        console.log("─".repeat(60));

        for (const skill of skills.sort((a, b) => a.id.localeCompare(b.id))) {
            const extendsInfo = skill.extends.length > 0 ? ` (extends: ${skill.extends.join(", ")})` : "";
            console.log(`\n  ${skill.id}${extendsInfo}`);
            console.log(`    ${skill.description}`);
            if (skill.requiredTools.length > 0) {
                console.log(`    Tools: ${skill.requiredTools.slice(0, 5).join(", ")}${skill.requiredTools.length > 5 ? "..." : ""}`);
            }
        }

        console.log("\n" + "─".repeat(60));
        console.log(`Total: ${skills.length} skills\n`);
    } catch (error) {
        console.error("❌ Error listing skills:", error);
        process.exit(1);
    }
}

async function getSkill(skillId: string): Promise<void> {
    const skillPath = path.join(process.cwd(), SKILLS_DIR, skillId, SKILL_FILE);

    try {
        const content = await fs.readFile(skillPath, "utf-8");
        console.log("\n📄 Skill: " + skillId);
        console.log("─".repeat(60));
        console.log(content);
    } catch {
        console.error(`❌ Skill not found: ${skillId}`);
        console.error(`   Expected path: ${skillPath}`);
        process.exit(1);
    }
}

async function validateSkills(): Promise<void> {
    const skillsPath = path.join(process.cwd(), SKILLS_DIR);
    const errors: string[] = [];
    const warnings: string[] = [];
    let count = 0;

    try {
        const entries = await fs.readdir(skillsPath, { withFileTypes: true });

        for (const entry of entries) {
            if (!entry.isDirectory()) continue;
            const skillFile = path.join(skillsPath, entry.name, SKILL_FILE);

            try {
                const content = await fs.readFile(skillFile, "utf-8");
                const meta = parseYamlFrontmatter(content);
                count++;

                // Validation checks
                if (!meta.name || typeof meta.name !== "string") warnings.push(`${entry.name}: missing 'name' in frontmatter`);
                if (!meta.description || typeof meta.description !== "string") warnings.push(`${entry.name}: missing 'description'`);

                // Check extends references exist
                const extendsList = Array.isArray(meta.extends)
                    ? meta.extends
                    : typeof meta.extends === "string"
                        ? [meta.extends]
                        : [];
                for (const ext of extendsList) {
                    const extPath = path.join(skillsPath, ext, SKILL_FILE);
                    try {
                        await fs.access(extPath);
                    } catch {
                        errors.push(`${entry.name}: extends '${ext}' but skill not found`);
                    }
                }
            } catch (err) {
                errors.push(`${entry.name}: invalid SKILL.md - ${err}`);
            }
        }

        console.log("\n🔍 Skill Validation Report\n");
        console.log("─".repeat(60));
        console.log(`\n  Scanned: ${count} skills`);

        if (warnings.length > 0) {
            console.log(`\n⚠️  Warnings (${warnings.length}):`);
            warnings.forEach(w => console.log(`    - ${w}`));
        }

        if (errors.length > 0) {
            console.log(`\n❌ Errors (${errors.length}):`);
            errors.forEach(e => console.log(`    - ${e}`));
        }

        if (errors.length === 0 && warnings.length === 0) {
            console.log("\n✅ All skills valid!");
        }

        console.log("\n" + "─".repeat(60) + "\n");
        process.exit(errors.length > 0 ? 1 : 0);
    } catch (error) {
        console.error("❌ Error validating skills:", error);
        process.exit(1);
    }
}

async function initSkill(skillId: string): Promise<void> {
    const skillDir = path.join(process.cwd(), SKILLS_DIR, skillId);
    const skillFile = path.join(skillDir, SKILL_FILE);

    try {
        await fs.access(skillFile);
        console.error(`❌ Skill already exists: ${skillId}`);
        process.exit(1);
    } catch {
        // Good, doesn't exist
    }

    const template = `---
name: ${skillId.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
version: 1.0.0
description: Description of what this skill does
extends: []
requiredTools:
  - list_files
  - read_file
suggestedTools: []
tags:
  - custom
outputFormat: json
---

You are an AI assistant with this skill.

## Mission
Describe what the agent should accomplish.

## Rules
- Rule 1
- Rule 2

## Output Format
Return valid JSON: \`{"result": "..."}\`
`;

    await fs.mkdir(skillDir, { recursive: true });
    await fs.writeFile(skillFile, template, "utf-8");

    console.log(`\n✅ Created new skill: ${skillId}`);
    console.log(`   Path: ${skillFile}\n`);
}

function parseYamlFrontmatter(content: string): Partial<SkillFrontmatter> {
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (!match) return {};

    const yaml = match[1];
    const result: Record<string, string | string[]> = {};

    // Simple YAML parsing (for basic key: value and arrays)
    let currentKey = "";
    let currentArray: string[] = [];
    let inArray = false;

    for (const line of yaml.split("\n")) {
        const arrayItem = line.match(/^\s+-\s+(.+)$/);
        if (arrayItem) {
            if (inArray) currentArray.push(arrayItem[1].trim());
            continue;
        }

        if (inArray && currentKey) {
            result[currentKey] = currentArray;
            currentArray = [];
            inArray = false;
        }

        const keyValue = line.match(/^(\w+):\s*(.*)$/);
        if (keyValue) {
            const [, key, value] = keyValue;
            if (value.trim() === "" || value.trim() === "[]") {
                currentKey = key;
                inArray = true;
                currentArray = [];
            } else {
                result[key] = value.trim();
            }
        }
    }

    if (inArray && currentKey) {
        result[currentKey] = currentArray;
    }

    return result as Partial<SkillFrontmatter>;
}

// CLI Entry Point
const [, , command, arg] = process.argv;

switch (command) {
    case "list":
        listSkills();
        break;
    case "get":
        if (!arg) {
            console.error("Usage: skills-cli get <skillId>");
            process.exit(1);
        }
        getSkill(arg);
        break;
    case "validate":
        validateSkills();
        break;
    case "init":
        if (!arg) {
            console.error("Usage: skills-cli init <skillId>");
            process.exit(1);
        }
        initSkill(arg);
        break;
    default:
        console.log(`
Numezis Skills CLI

Usage:
  npx ts-node scripts/skills-cli.ts <command> [args]

Commands:
  list           List all available skills
  get <id>       Show a skill's full SKILL.md content
  validate       Validate all skills (check references, structure)
  init <id>      Create a new skill from template
`);
}
