// src/services/userPreferencesService.ts
// MongoDB-based user preferences service for Deep Agent settings
import { getDb } from '../lib/db';

export interface UserPreferences {
    _id?: string;
    userId: string;           // Supabase auth user ID
    selectedLlmProvider: string | null;
    selectedGraphId: string | null;
    updatedAt: Date;
}

export interface UserPreferencesPublic {
    userId: string;
    selectedLlmProvider: string | null;
    selectedGraphId: string | null;
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
    updates: { selectedLlmProvider?: string | null; selectedGraphId?: string | null } = {}
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
                ? updates.selectedGraphId
                : existing?.selectedGraphId ?? null,
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
        return fallbackPreferences.get(userId) ?? null;
    }
    const prefs = await collection.findOne({ userId });

    if (!prefs) return null;

    return {
        userId: prefs.userId,
        selectedLlmProvider: prefs.selectedLlmProvider,
        selectedGraphId: prefs.selectedGraphId,
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
        updateDoc.selectedGraphId = updates.selectedGraphId;
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
        selectedGraphId: prefs.selectedGraphId,
        updatedAt: prefs.updatedAt,
    };
}
