import { ObjectId } from "mongodb";
import { getDb } from "../lib/db";

export type MemoryEntry = {
    _id?: ObjectId;
    workspaceId: ObjectId;
    path: string;
    content: string;
    createdAt: Date;
    updatedAt: Date;
};

export type MemoryListItem = {
    path: string;
    size: number;
    updatedAt: Date;
};

const COLLECTION_NAME = "agent_memories";
const fallbackMemory = new Map<string, MemoryEntry>();
let fallbackEnabled = false;
let fallbackWarned = false;

function warnFallback(error: unknown) {
    if (fallbackWarned) return;
    fallbackWarned = true;
    console.warn("[AgentMemory] Falling back to in-memory store:", (error as Error)?.message ?? error);
}

async function getCollectionSafe() {
    if (fallbackEnabled) return null;
    try {
        const db = await getDb();
        return db.collection<MemoryEntry>(COLLECTION_NAME);
    } catch (error) {
        fallbackEnabled = true;
        warnFallback(error);
        return null;
    }
}

function normalizeMemoryPath(rawPath: string): string {
    const trimmed = rawPath.trim();
    const withSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
    if (withSlash === "/memories") {
        return "/memories/";
    }
    if (!withSlash.startsWith("/memories/")) {
        throw new Error("Memory path must start with /memories/");
    }
    if (withSlash.includes("..")) {
        throw new Error("Memory path cannot include '..'");
    }
    return withSlash;
}

function makeKey(workspaceId: ObjectId, path: string) {
    return `${workspaceId.toString()}:${path}`;
}

export class AgentMemoryService {
    async list(prefix: string, workspaceId: ObjectId): Promise<MemoryListItem[]> {
        const normalized = normalizeMemoryPath(prefix.endsWith("/") ? prefix : `${prefix}/`);
        const collection = await getCollectionSafe();
        if (!collection) {
            return Array.from(fallbackMemory.values())
                .filter((entry) => entry.workspaceId.toString() === workspaceId.toString() && entry.path.startsWith(normalized))
                .map((entry) => ({
                    path: entry.path,
                    size: entry.content.length,
                    updatedAt: entry.updatedAt,
                }))
                .sort((a, b) => a.path.localeCompare(b.path));
        }

        const rows = await collection
            .find({ workspaceId, path: { $regex: `^${normalized.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}` } })
            .sort({ path: 1 })
            .toArray();

        return rows.map((entry) => ({
            path: entry.path,
            size: entry.content.length,
            updatedAt: entry.updatedAt,
        }));
    }

    async read(path: string, workspaceId: ObjectId): Promise<string> {
        const normalized = normalizeMemoryPath(path);
        const collection = await getCollectionSafe();
        if (!collection) {
            const entry = fallbackMemory.get(makeKey(workspaceId, normalized));
            if (!entry) throw new Error(`Memory not found: ${normalized}`);
            return entry.content;
        }
        const entry = await collection.findOne({ workspaceId, path: normalized });
        if (!entry) throw new Error(`Memory not found: ${normalized}`);
        return entry.content;
    }

    async write(path: string, content: string, workspaceId: ObjectId): Promise<void> {
        const normalized = normalizeMemoryPath(path);
        const now = new Date();
        const collection = await getCollectionSafe();
        if (!collection) {
            const key = makeKey(workspaceId, normalized);
            const existing = fallbackMemory.get(key);
            fallbackMemory.set(key, {
                ...(existing ?? { workspaceId, path: normalized, createdAt: now }),
                content,
                updatedAt: now,
            });
            return;
        }
        await collection.updateOne(
            { workspaceId, path: normalized },
            {
                $set: { content, updatedAt: now },
                $setOnInsert: { workspaceId, path: normalized, createdAt: now },
            },
            { upsert: true }
        );
    }

    async edit(path: string, oldString: string, newString: string, replaceAll: boolean, workspaceId: ObjectId) {
        const normalized = normalizeMemoryPath(path);
        const current = await this.read(normalized, workspaceId);
        const occurrences = replaceAll
            ? (current.match(new RegExp(oldString.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length
            : current.includes(oldString)
                ? 1
                : 0;
        if (occurrences === 0) {
            throw new Error(`String not found in memory: ${normalized}`);
        }
        const updated = replaceAll ? current.split(oldString).join(newString) : current.replace(oldString, newString);
        await this.write(normalized, updated, workspaceId);
        return { occurrences, content: updated };
    }
}

export const agentMemoryService = new AgentMemoryService();
