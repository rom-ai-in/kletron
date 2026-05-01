// Mongo-backed skills service.
// Manages a global skill library (source: builtin | user) and per-workspace
// activation records.
//
// Built-in skills live on disk under `.agent/skills/<slug>/SKILL.md` and are
// imported into the `skills` collection by the seed script. User-authored
// skills are written directly to Mongo from the web UI.

import { ObjectId } from "mongodb";
import matter from "gray-matter";
import { getDatabase } from "../lib/db";
import {
    SLUG_REGEX,
    composeSkillMarkdown,
    skillCreateSchema,
    skillFrontmatterSchema,
    skillUpdateSchema,
    type SkillCreateInput,
    type SkillRecord,
    type SkillSource,
    type SkillUpdateInput,
    type WorkspaceSkillRecord,
    type ResolvedSkillRecord,
} from "@kletron/shared/skills/types";

const SKILLS_COLLECTION = "skills";
const WORKSPACE_SKILLS_COLLECTION = "workspace_skills";

interface SkillDoc {
    _id?: ObjectId;
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
    ownerId?: string;
    organizationId?: string;
    author?: string;
    outputFormat?: "json" | "markdown" | "mixed";
    maxToolCalls?: number;
    createdAt: Date;
    updatedAt: Date;
}

interface WorkspaceSkillDoc {
    _id?: ObjectId;
    workspaceId: string;
    skillSlug: string;
    enabled: boolean;
    addedAt: Date;
    configOverride?: Record<string, unknown>;
}

async function skillsCollection() {
    const db = await getDatabase();
    return db.collection<SkillDoc>(SKILLS_COLLECTION);
}

async function workspaceSkillsCollection() {
    const db = await getDatabase();
    return db.collection<WorkspaceSkillDoc>(WORKSPACE_SKILLS_COLLECTION);
}

let indexesEnsured = false;
async function ensureIndexes() {
    if (indexesEnsured) return;
    indexesEnsured = true;
    try {
        const skills = await skillsCollection();
        await skills.createIndex({ slug: 1 }, { unique: true });
        await skills.createIndex({ source: 1 });
        await skills.createIndex({ ownerId: 1 });
        await skills.createIndex({ tags: 1 });

        const ws = await workspaceSkillsCollection();
        await ws.createIndex({ workspaceId: 1, skillSlug: 1 }, { unique: true });
    } catch (error) {
        console.warn("[skillsService] ensureIndexes:", (error as Error).message);
    }
}

function toRecord(doc: SkillDoc): SkillRecord {
    return {
        slug: doc.slug,
        name: doc.name,
        version: doc.version,
        description: doc.description,
        tags: doc.tags ?? [],
        requiredTools: doc.requiredTools ?? [],
        suggestedTools: doc.suggestedTools ?? [],
        extends: doc.extends ?? [],
        body: doc.body ?? "",
        source: doc.source,
        ownerId: doc.ownerId,
        organizationId: doc.organizationId,
        author: doc.author,
        outputFormat: doc.outputFormat,
        maxToolCalls: doc.maxToolCalls,
        createdAt: doc.createdAt.toISOString(),
        updatedAt: doc.updatedAt.toISOString(),
    };
}

function toWorkspaceRecord(doc: WorkspaceSkillDoc): WorkspaceSkillRecord {
    return {
        workspaceId: doc.workspaceId,
        skillSlug: doc.skillSlug,
        enabled: doc.enabled,
        addedAt: doc.addedAt.toISOString(),
        configOverride: doc.configOverride,
    };
}

// ─── Library: list / get / create / update / delete ────────────────────────

export interface ListSkillsOptions {
    /** Filter by tag substring. */
    tag?: string;
    /** Free-text search across name + description. */
    search?: string;
    /** Filter by source. */
    source?: SkillSource;
    /**
     * When null: list every skill in the DB (internal/admin).
     * When a string: builtins + that user's skills only.
     * When undefined: builtins only (anonymous catalog).
     */
    viewerUserId?: string | null;
    limit?: number;
}

export async function listSkills(options: ListSkillsOptions = {}): Promise<SkillRecord[]> {
    await ensureIndexes();
    const collection = await skillsCollection();
    const clauses: Record<string, unknown>[] = [];
    if (options.source) clauses.push({ source: options.source });
    if (options.tag) clauses.push({ tags: options.tag });
    if (options.search) {
        const safe = options.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const regex = new RegExp(safe, "i");
        clauses.push({
            $or: [{ name: regex }, { description: regex }, { slug: regex }],
        });
    }
    if (options.viewerUserId === undefined) {
        clauses.push({ source: "builtin" });
    } else if (options.viewerUserId !== null) {
        clauses.push({
            $or: [{ source: "builtin" }, { source: "user", ownerId: options.viewerUserId }],
        });
    }
    const filter: Record<string, unknown> =
        clauses.length === 0 ? {} : clauses.length === 1 ? clauses[0]! : { $and: clauses };
    const docs = await collection
        .find(filter)
        .sort({ source: 1, name: 1 })
        .limit(options.limit ?? 200)
        .toArray();
    return docs.map(toRecord);
}

export async function getSkillBySlug(slug: string): Promise<SkillRecord | null> {
    await ensureIndexes();
    const collection = await skillsCollection();
    const doc = await collection.findOne({ slug });
    return doc ? toRecord(doc) : null;
}

export async function createSkill(
    input: SkillCreateInput,
    ownerId: string,
    options: { source?: SkillSource } = {}
): Promise<SkillRecord> {
    await ensureIndexes();
    const validated = skillCreateSchema.parse(input);
    const collection = await skillsCollection();
    const now = new Date();
    const doc: SkillDoc = {
        slug: validated.slug,
        name: validated.frontmatter.name,
        version: validated.frontmatter.version ?? "1.0.0",
        description: validated.frontmatter.description ?? "",
        tags: validated.frontmatter.tags ?? [],
        requiredTools: validated.frontmatter.requiredTools ?? [],
        suggestedTools: validated.frontmatter.suggestedTools ?? [],
        extends: validated.frontmatter.extends ?? [],
        body: validated.body,
        source: options.source ?? "user",
        ownerId,
        author: validated.frontmatter.author,
        outputFormat: validated.frontmatter.outputFormat,
        maxToolCalls: validated.frontmatter.maxToolCalls,
        createdAt: now,
        updatedAt: now,
    };
    try {
        const result = await collection.insertOne(doc);
        doc._id = result.insertedId;
    } catch (error) {
        if ((error as { code?: number }).code === 11000) {
            throw new Error(`Skill slug already exists: ${validated.slug}`);
        }
        throw error;
    }
    return toRecord(doc);
}

export async function updateSkill(
    slug: string,
    updates: SkillUpdateInput,
    ownerId: string,
    options: { allowBuiltin?: boolean } = {}
): Promise<SkillRecord | null> {
    await ensureIndexes();
    const validated = skillUpdateSchema.parse(updates);
    const collection = await skillsCollection();
    const existing = await collection.findOne({ slug });
    if (!existing) return null;
    if (existing.source === "builtin" && !options.allowBuiltin) {
        throw new Error("Built-in skills cannot be modified");
    }
    if (existing.source === "user" && existing.ownerId !== ownerId) {
        throw new Error("You do not have permission to edit this skill");
    }

    const now = new Date();
    const fm = validated.frontmatter ?? {};
    const next: Partial<SkillDoc> = {
        updatedAt: now,
    };
    if (fm.name !== undefined) next.name = fm.name;
    if (fm.version !== undefined) next.version = fm.version;
    if (fm.description !== undefined) next.description = fm.description;
    if (fm.tags !== undefined) next.tags = fm.tags;
    if (fm.requiredTools !== undefined) next.requiredTools = fm.requiredTools;
    if (fm.suggestedTools !== undefined) next.suggestedTools = fm.suggestedTools;
    if (fm.extends !== undefined) next.extends = fm.extends;
    if (fm.author !== undefined) next.author = fm.author;
    if (fm.outputFormat !== undefined) next.outputFormat = fm.outputFormat;
    if (fm.maxToolCalls !== undefined) next.maxToolCalls = fm.maxToolCalls;
    if (validated.body !== undefined) next.body = validated.body;

    await collection.updateOne({ slug }, { $set: next });
    const updated = await collection.findOne({ slug });
    return updated ? toRecord(updated) : null;
}

export async function deleteSkill(slug: string, ownerId: string): Promise<boolean> {
    await ensureIndexes();
    const collection = await skillsCollection();
    const existing = await collection.findOne({ slug });
    if (!existing) return false;
    if (existing.source === "builtin") {
        throw new Error("Built-in skills cannot be deleted");
    }
    if (existing.ownerId !== ownerId) {
        throw new Error("You do not have permission to delete this skill");
    }
    await collection.deleteOne({ slug });
    // Also drop activations.
    const ws = await workspaceSkillsCollection();
    await ws.deleteMany({ skillSlug: slug });
    return true;
}

/**
 * Bulk upsert (used by the seed script for builtins).
 */
export async function upsertBuiltinSkill(
    slug: string,
    rawMarkdown: string
): Promise<SkillRecord> {
    if (!SLUG_REGEX.test(slug)) {
        throw new Error(`Invalid slug: ${slug}`);
    }
    await ensureIndexes();
    const parsed = matter(rawMarkdown);
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

    const collection = await skillsCollection();
    const now = new Date();
    const update: SkillDoc = {
        slug,
        name: fm.name,
        version: fm.version ?? "1.0.0",
        description: fm.description ?? "",
        tags: fm.tags ?? [],
        requiredTools: fm.requiredTools ?? [],
        suggestedTools: fm.suggestedTools ?? [],
        extends: fm.extends ?? [],
        body: parsed.content.trim(),
        source: "builtin",
        author: fm.author,
        outputFormat: fm.outputFormat,
        maxToolCalls: fm.maxToolCalls,
        createdAt: now,
        updatedAt: now,
    };

    await collection.updateOne(
        { slug },
        {
            $set: {
                name: update.name,
                version: update.version,
                description: update.description,
                tags: update.tags,
                requiredTools: update.requiredTools,
                suggestedTools: update.suggestedTools,
                extends: update.extends,
                body: update.body,
                source: update.source,
                author: update.author,
                outputFormat: update.outputFormat,
                maxToolCalls: update.maxToolCalls,
                updatedAt: now,
            },
            $setOnInsert: { createdAt: now },
        },
        { upsert: true }
    );

    const fresh = await collection.findOne({ slug });
    return toRecord(fresh!);
}

// ─── Per-workspace activation ──────────────────────────────────────────────

export async function listWorkspaceSkills(workspaceId: string): Promise<WorkspaceSkillRecord[]> {
    await ensureIndexes();
    const collection = await workspaceSkillsCollection();
    const docs = await collection.find({ workspaceId }).toArray();
    return docs.map(toWorkspaceRecord);
}

export async function setWorkspaceSkill(
    workspaceId: string,
    skillSlug: string,
    enabled: boolean,
    configOverride?: Record<string, unknown>
): Promise<WorkspaceSkillRecord> {
    await ensureIndexes();
    const collection = await workspaceSkillsCollection();
    const now = new Date();
    await collection.updateOne(
        { workspaceId, skillSlug },
        {
            $set: { enabled, configOverride },
            $setOnInsert: { workspaceId, skillSlug, addedAt: now },
        },
        { upsert: true }
    );
    const doc = await collection.findOne({ workspaceId, skillSlug });
    return toWorkspaceRecord(doc!);
}

export async function removeWorkspaceSkill(workspaceId: string, skillSlug: string): Promise<boolean> {
    await ensureIndexes();
    const collection = await workspaceSkillsCollection();
    const result = await collection.deleteOne({ workspaceId, skillSlug });
    return (result.deletedCount ?? 0) > 0;
}

// ─── Resolved skills (extends-chain merge) ─────────────────────────────────

function resolveOne(
    slug: string,
    library: Map<string, SkillRecord>,
    visited: Set<string>
): ResolvedSkillRecord | null {
    if (visited.has(slug)) {
        throw new Error(
            `Circular skill dependency detected: ${[...visited, slug].join(" -> ")}`
        );
    }
    const skill = library.get(slug);
    if (!skill) return null;
    visited.add(slug);

    const parentPrompts: string[] = [];
    const parentTools: string[] = [];
    const chain: string[] = [];
    for (const parentSlug of skill.extends ?? []) {
        const resolved = resolveOne(parentSlug, library, new Set(visited));
        if (!resolved) continue;
        if (resolved.resolvedSystemPrompt) parentPrompts.push(resolved.resolvedSystemPrompt);
        parentTools.push(...resolved.resolvedTools);
        chain.push(...resolved.extendsChain);
    }

    const allPrompts = [...parentPrompts];
    if (skill.body) allPrompts.push(skill.body);

    const tools = Array.from(
        new Set([
            ...parentTools,
            ...(skill.requiredTools ?? []),
            ...(skill.suggestedTools ?? []),
        ])
    );

    return {
        ...skill,
        resolvedSystemPrompt: allPrompts.join("\n\n---\n\n"),
        resolvedTools: tools,
        extendsChain: [...chain, slug],
    };
}

export async function resolveWorkspaceSkills(workspaceId: string): Promise<ResolvedSkillRecord[]> {
    await ensureIndexes();
    const ws = await workspaceSkillsCollection();
    const enabled = await ws
        .find({ workspaceId, enabled: true })
        .toArray();
    if (enabled.length === 0) return [];

    const library = new Map<string, SkillRecord>();
    for (const record of await listSkills({ viewerUserId: null })) {
        library.set(record.slug, record);
    }

    const resolved: ResolvedSkillRecord[] = [];
    for (const e of enabled) {
        try {
            const r = resolveOne(e.skillSlug, library, new Set());
            if (r) resolved.push(r);
        } catch (error) {
            console.warn(
                `[skillsService] Could not resolve ${e.skillSlug} for workspace ${workspaceId}: ${(error as Error).message}`
            );
        }
    }
    return resolved;
}

/** Helper used by the agent-core registry external provider. */
export async function loadAllSkillsForRegistry(): Promise<SkillRecord[]> {
    return listSkills({ viewerUserId: null });
}

export { composeSkillMarkdown };
