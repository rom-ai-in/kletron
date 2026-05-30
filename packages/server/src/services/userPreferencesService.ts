// src/services/userPreferencesService.ts
// MongoDB-based user preferences service for Deep Agent settings
import { ObjectId } from "mongodb";
import { getDb } from '../lib/db';

/** Drop legacy catalog slugs (e.g. universal-v1) — only persisted agent_graph _id strings are valid. */
function sanitizeSelectedGraphId(id: string | null | undefined): string | null {
    if (id == null || id === "") return null;
    const t = String(id).trim();
    if (!t || !ObjectId.isValid(t)) return null;
    return t;
}

function sanitizeExecutionBackend(_value: string | null | undefined): "langgraph" {
    // Deprecated: LangGraph is now the only execution backend.
    return "langgraph";
}

function sanitizeCodexModel(value: string | null | undefined): string | null {
    if (value == null) return null;
    const trimmed = String(value).trim();
    if (!trimmed) return null;
    return trimmed.slice(0, 200);
}

export interface UserPreferences {
    _id?: string;
    userId: string;           // Auth user ID
    selectedLlmProvider: string | null;
    selectedGraphId: string | null;
    executionBackend?: "langgraph" | "codex";
    selectedCodexModel?: string | null;
    updatedAt: Date;
}

export interface UserPreferencesPublic {
    userId: string;
    selectedLlmProvider: string | null;
    selectedGraphId: string | null;
    executionBackend: "langgraph" | "codex";
    selectedCodexModel: string | null;
    updatedAt: Date;
}

const COLLECTION_NAME = 'user_preferences';
const fallbackPreferences = new Map<string, UserPreferencesPublic>();
let fallbackEnabled = false;
let fallbackWarned = false;

function warnFallback(error: unknown) {
    if (fallbackWarned) return;
    fallbackWarned = true;
    console.warn("[UserPreferences] Falling back to in-memory store:", (error as Error)?.message ?? error);
}

async function getCollectionSafe() {
    if (fallbackEnabled) return null;
    try {
        return await getCollection();
    } catch (error) {
        fallbackEnabled = true;
        warnFallback(error);
        return null;
    }
}

function upsertFallbackPreferences(
    userId: string,
    updates: {
        selectedLlmProvider?: string | null;
        selectedGraphId?: string | null;
        executionBackend?: "langgraph" | "codex" | string | null;
        selectedCodexModel?: string | null;
    } = {}
): UserPreferencesPublic {
    const now = new Date();
    const existing = fallbackPreferences.get(userId);
    const prefs: UserPreferencesPublic = {
        userId,
        selectedLlmProvider:
            updates.selectedLlmProvider !== undefined
                ? updates.selectedLlmProvider
                : existing?.selectedLlmProvider ?? null,
        selectedGraphId:
            updates.selectedGraphId !== undefined
                ? sanitizeSelectedGraphId(updates.selectedGraphId)
                : sanitizeSelectedGraphId(existing?.selectedGraphId ?? null),
        executionBackend:
            updates.executionBackend !== undefined
                ? sanitizeExecutionBackend(updates.executionBackend ?? undefined)
                : sanitizeExecutionBackend(existing?.executionBackend),
        selectedCodexModel:
            updates.selectedCodexModel !== undefined
                ? sanitizeCodexModel(updates.selectedCodexModel)
                : sanitizeCodexModel(existing?.selectedCodexModel),
        updatedAt: now,
    };
    fallbackPreferences.set(userId, prefs);
    return prefs;
}

/**
 * Get the user_preferences collection
 */
async function getCollection() {
    const db = await getDb();
    return db.collection<UserPreferences>(COLLECTION_NAME);
}

/**
 * Create indexes for the collection (call on startup if needed)
 */
export async function ensureIndexes() {
    const collection = await getCollectionSafe();
    if (!collection) return;
    await collection.createIndex({ userId: 1 }, { unique: true });
}

/**
 * Get user preferences by user ID
 */
export async function getPreferences(userId: string): Promise<UserPreferencesPublic | null> {
    const collection = await getCollectionSafe();
    if (!collection) {
        const fb = fallbackPreferences.get(userId);
        if (!fb) return null;
        return {
            ...fb,
            selectedGraphId: sanitizeSelectedGraphId(fb.selectedGraphId),
            executionBackend: sanitizeExecutionBackend(fb.executionBackend),
            selectedCodexModel: sanitizeCodexModel(fb.selectedCodexModel),
        };
    }
    const prefs = await collection.findOne({ userId });

    if (!prefs) return null;

    return {
        userId: prefs.userId,
        selectedLlmProvider: prefs.selectedLlmProvider,
        selectedGraphId: sanitizeSelectedGraphId(prefs.selectedGraphId),
        executionBackend: sanitizeExecutionBackend(prefs.executionBackend),
        selectedCodexModel: sanitizeCodexModel(prefs.selectedCodexModel),
        updatedAt: prefs.updatedAt,
    };
}

/**
 * Update user preferences (upsert)
 */
export async function updatePreferences(
    userId: string,
    updates: {
        selectedLlmProvider?: string | null;
        selectedGraphId?: string | null;
        executionBackend?: "langgraph" | "codex" | string | null;
        selectedCodexModel?: string | null;
    }
): Promise<UserPreferencesPublic> {
    const collection = await getCollectionSafe();
    if (!collection) {
        return upsertFallbackPreferences(userId, updates);
    }
    const now = new Date();

    const updateDoc: Record<string, unknown> = {
        updatedAt: now,
    };

    if (updates.selectedLlmProvider !== undefined) {
        updateDoc.selectedLlmProvider = updates.selectedLlmProvider;
    }
    if (updates.selectedGraphId !== undefined) {
        updateDoc.selectedGraphId = sanitizeSelectedGraphId(updates.selectedGraphId);
    }
    if (updates.executionBackend !== undefined) {
        updateDoc.executionBackend = sanitizeExecutionBackend(updates.executionBackend ?? undefined);
    }
    if (updates.selectedCodexModel !== undefined) {
        updateDoc.selectedCodexModel = sanitizeCodexModel(updates.selectedCodexModel);
    }

    const result = await collection.findOneAndUpdate(
        { userId },
        {
            $set: updateDoc,
            $setOnInsert: {
                userId,
            },
        },
        { upsert: true, returnDocument: 'after' }
    );

    const prefs = result!;
    return {
        userId: prefs.userId,
        selectedLlmProvider: prefs.selectedLlmProvider,
        selectedGraphId: sanitizeSelectedGraphId(prefs.selectedGraphId),
        executionBackend: sanitizeExecutionBackend(prefs.executionBackend),
        selectedCodexModel: sanitizeCodexModel(prefs.selectedCodexModel),
        updatedAt: prefs.updatedAt,
    };
}
