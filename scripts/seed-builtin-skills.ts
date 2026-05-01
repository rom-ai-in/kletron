/**
 * Upsert every SKILL.md under .agent/skills/<slug>/ into Mongo as builtins.
 *
 * Usage (repo root):
 *   pnpm seed:skills
 *
 * Optional: only write missing plugin stub files from PLUGIN_CATALOG (no DB):
 *   tsx scripts/seed-builtin-skills.ts --write-plugin-stubs-only
 */

import dotenv from "dotenv";
import { access, readdir, readFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { PLUGIN_CATALOG } from "@kletron/shared";
import { upsertBuiltinSkill } from "@kletron/server/services/skillsService";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

dotenv.config({ path: path.join(ROOT, ".env.local") });
dotenv.config();

function titleCaseSlug(slug: string): string {
    return slug
        .split("-")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
}

function stubMarkdown(slug: string, pluginId: string): string {
    const name = titleCaseSlug(slug);
    return `---
name: ${name}
version: 1.0.0
description: ${name} — plugin workflow skill (stub).
tags:
  - plugin-${pluginId}
requiredTools:
  - fetch_url
suggestedTools:
  - web_search
---

## When to use this skill

Use when the user needs **${name}** in the context of the **${pluginId}** plugin bundle.

## Instructions

1. Clarify inputs (links, IDs, constraints).
2. Use connected tools (for example \`fetch_url\`) when workspace integrations exist.
3. Produce actionable, verifiable output.

## Output

Structured markdown or JSON as appropriate for the task.
`;
}

async function ensurePluginStubFiles(): Promise<void> {
    const { mkdir, writeFile } = await import("fs/promises");
    for (const plugin of PLUGIN_CATALOG) {
        for (const slug of plugin.skillSlugs) {
            const dir = path.join(ROOT, ".agent/skills", slug);
            const file = path.join(dir, "SKILL.md");
            try {
                await access(file);
                continue;
            } catch {
                /* missing */
            }
            await mkdir(dir, { recursive: true });
            await writeFile(file, stubMarkdown(slug, plugin.id), "utf8");
            console.log(`Wrote stub ${slug}`);
        }
    }
}

async function seedAllFromDisk(): Promise<void> {
    const skillsDir = path.join(ROOT, ".agent/skills");
    let entries: string[];
    try {
        entries = await readdir(skillsDir, { withFileTypes: true });
    } catch (e) {
        console.error("No .agent/skills directory:", e);
        process.exit(1);
        return;
    }

    const slugs = entries.filter((e) => e.isDirectory()).map((e) => e.name);
    let count = 0;
    for (const slug of slugs.sort()) {
        const file = path.join(skillsDir, slug, "SKILL.md");
        try {
            const raw = await readFile(file, "utf8");
            await upsertBuiltinSkill(slug, raw);
            count++;
            console.log(`Seeded ${slug}`);
        } catch (err) {
            console.warn(`Skip ${slug}:`, (err as Error).message);
        }
    }
    console.log(`Done. Upserted ${count} builtin skills.`);
}

async function main() {
    if (process.argv.includes("--write-plugin-stubs-only")) {
        await ensurePluginStubFiles();
        return;
    }

    await ensurePluginStubFiles();
    await seedAllFromDisk();
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
