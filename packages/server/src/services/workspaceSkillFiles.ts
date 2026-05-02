/**
 * Repo-native skills: primary source of truth at
 *   `<workspaceRoot>/.kletron/skills/<slug>/SKILL.md`
 *
 * Same format as the global library (YAML frontmatter + markdown body).
 */

import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import type { SkillDefinition } from "@kletron/agent-core/skills/types";
import {
    composeSkillMarkdown,
    skillFrontmatterSchema,
    SLUG_REGEX,
    type SkillCreateInput,
    type SkillRecord,
    type SkillUpdateInput,
} from "@kletron/shared/skills/types";

export const WORKSPACE_SKILLS_DIR = ".kletron/skills";

export function workspaceSkillsBase(rootPath: string): string {
    return path.join(path.normalize(rootPath), WORKSPACE_SKILLS_DIR);
}

function skillDir(rootPath: string, slug: string): string {
    return path.join(workspaceSkillsBase(rootPath), slug);
}

function skillFilePath(rootPath: string, slug: string): string {
    return path.join(skillDir(rootPath, slug), "SKILL.md");
}

function parseSkillMarkdownFile(raw: string, slug: string, source: SkillRecord["source"]): SkillRecord {
    const parsed = matter(raw);
    const fm = skillFrontmatterSchema.parse({
        name: parsed.data.name ?? slug,
        version: parsed.data.version,
        description: parsed.data.description,
        tags: parsed.data.tags,
        author: parsed.data.author,
        requiredTools: parsed.data.requiredTools,
        suggestedTools: parsed.data.suggestedTools,
        extends: parsed.data.extends,
        outputFormat: parsed.data.outputFormat,
        maxToolCalls: parsed.data.maxToolCalls,
    });
    const now = new Date().toISOString();
    return {
        slug,
        name: fm.name,
        version: fm.version ?? "1.0.0",
        description: fm.description ?? "",
        tags: fm.tags ?? [],
        requiredTools: fm.requiredTools ?? [],
        suggestedTools: fm.suggestedTools ?? [],
        extends: fm.extends ?? [],
        body: typeof parsed.content === "string" ? parsed.content.trim() : "",
        source,
        author: fm.author,
        outputFormat: fm.outputFormat,
        maxToolCalls: fm.maxToolCalls,
        createdAt: now,
        updatedAt: now,
    };
}

/** List all skills: each `.kletron/skills/<slug>/SKILL.md` under the workspace root. */
export async function listWorkspaceSkillRecords(rootPath: string): Promise<SkillRecord[]> {
    const base = workspaceSkillsBase(rootPath);
    let entries: Awaited<ReturnType<typeof readdir>>;
    try {
        entries = await readdir(base, { withFileTypes: true });
    } catch {
        return [];
    }

    const out: SkillRecord[] = [];
    for (const ent of entries) {
        if (!ent.isDirectory()) continue;
        const slug = ent.name;
        if (!SLUG_REGEX.test(slug)) continue;
        const fp = skillFilePath(rootPath, slug);
        try {
            const raw = await readFile(fp, "utf8");
            const rec = parseSkillMarkdownFile(raw, slug, "user");
            try {
                const st = await stat(fp);
                const iso = st.mtime.toISOString();
                rec.createdAt = iso;
                rec.updatedAt = iso;
            } catch {
                // keep defaults
            }
            out.push(rec);
        } catch {
            // skip unreadable
        }
    }
    out.sort((a, b) => a.slug.localeCompare(b.slug));
    return out;
}

export async function readWorkspaceSkillRecord(rootPath: string, slug: string): Promise<SkillRecord | null> {
    if (!SLUG_REGEX.test(slug)) return null;
    const fp = skillFilePath(rootPath, slug);
    try {
        const raw = await readFile(fp, "utf8");
        const rec = parseSkillMarkdownFile(raw, slug, "user");
        const st = await stat(fp);
        const iso = st.mtime.toISOString();
        rec.createdAt = iso;
        rec.updatedAt = iso;
        return rec;
    } catch {
        return null;
    }
}

/** Write SKILL.md and return the normalized record (for Mongo mirror). */
export async function writeWorkspaceSkillFromCreate(
    rootPath: string,
    input: SkillCreateInput,
    ownerId: string
): Promise<SkillRecord> {
    const dir = skillDir(rootPath, input.slug);
    await mkdir(dir, { recursive: true });
    const record: SkillRecord = {
        slug: input.slug,
        name: input.frontmatter.name,
        version: input.frontmatter.version ?? "1.0.0",
        description: input.frontmatter.description ?? "",
        tags: input.frontmatter.tags ?? [],
        requiredTools: input.frontmatter.requiredTools ?? [],
        suggestedTools: input.frontmatter.suggestedTools ?? [],
        extends: input.frontmatter.extends ?? [],
        body: input.body,
        source: "user",
        ownerId,
        author: input.frontmatter.author,
        outputFormat: input.frontmatter.outputFormat,
        maxToolCalls: input.frontmatter.maxToolCalls,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
    const md = composeSkillMarkdown(record);
    await writeFile(skillFilePath(rootPath, input.slug), md, "utf8");
    return record;
}

export async function writeWorkspaceSkillFromUpdate(
    rootPath: string,
    slug: string,
    existing: SkillRecord,
    updates: SkillUpdateInput
): Promise<SkillRecord> {
    const fm = updates.frontmatter ?? {};
    const next: SkillRecord = {
        ...existing,
        name: fm.name !== undefined ? fm.name : existing.name,
        version: fm.version !== undefined ? fm.version : existing.version,
        description: fm.description !== undefined ? fm.description : existing.description,
        tags: fm.tags !== undefined ? fm.tags : existing.tags,
        requiredTools: fm.requiredTools !== undefined ? fm.requiredTools : existing.requiredTools,
        suggestedTools: fm.suggestedTools !== undefined ? fm.suggestedTools : existing.suggestedTools,
        extends: fm.extends !== undefined ? fm.extends : existing.extends,
        author: fm.author !== undefined ? fm.author : existing.author,
        outputFormat: fm.outputFormat !== undefined ? fm.outputFormat : existing.outputFormat,
        maxToolCalls: fm.maxToolCalls !== undefined ? fm.maxToolCalls : existing.maxToolCalls,
        body: updates.body !== undefined ? updates.body : existing.body,
        updatedAt: new Date().toISOString(),
    };
    const md = composeSkillMarkdown(next);
    await mkdir(skillDir(rootPath, slug), { recursive: true });
    await writeFile(skillFilePath(rootPath, slug), md, "utf8");
    return next;
}

export async function deleteWorkspaceSkillDir(rootPath: string, slug: string): Promise<boolean> {
    const dir = skillDir(rootPath, slug);
    try {
        await rm(dir, { recursive: true, force: true });
        return true;
    } catch {
        return false;
    }
}

/** Map a library record to an in-memory skill definition (registry overlay). */
export function skillRecordToSkillDefinition(r: SkillRecord): SkillDefinition {
    return {
        id: r.slug,
        name: r.name,
        version: r.version,
        description: r.description,
        systemPromptPrefix: r.body.trim() || undefined,
        requiredTools: r.requiredTools?.length ? r.requiredTools : undefined,
        suggestedTools: r.suggestedTools?.length ? r.suggestedTools : undefined,
        extends: r.extends?.length ? r.extends : undefined,
        tags: r.tags?.length ? r.tags : undefined,
        outputFormat: r.outputFormat,
        maxToolCalls: r.maxToolCalls,
        author: r.author,
    };
}
