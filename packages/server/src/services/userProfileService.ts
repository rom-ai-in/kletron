// src/services/userProfileService.ts
// MongoDB-based user profile service
import { getDb } from '../lib/db';

export interface UserProfile {
    _id?: string;
    userId: string;
    fullName: string | null;
    email: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface UserProfilePublic {
    id: string;
    userId: string;
    fullName: string | null;
    email: string;
    createdAt: Date;
    updatedAt: Date;
}

const COLLECTION_NAME = 'user_profiles';
const fallbackProfiles = new Map<string, UserProfilePublic>();
let fallbackEnabled = false;
let fallbackWarned = false;

function warnFallback(error: unknown) {
    if (fallbackWarned) return;
    fallbackWarned = true;
    console.warn("[UserProfile] Falling back to in-memory store:", (error as Error)?.message ?? error);
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

function upsertFallbackProfile(
    userId: string,
    email: string,
    fullName?: string | null
): UserProfilePublic {
    const now = new Date();
    const existing = fallbackProfiles.get(userId);
    const profile: UserProfilePublic = {
        id: existing?.id ?? `local_${userId}`,
        userId,
        fullName: fullName ?? existing?.fullName ?? null,
        email: email || existing?.email || "",
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
    };
    fallbackProfiles.set(userId, profile);
    return profile;
}

/**
 * Get the user_profiles collection
 */
async function getCollection() {
    const db = await getDb();
    return db.collection<UserProfile>(COLLECTION_NAME);
}

/**
 * Create indexes for the collection (call on startup)
 */
export async function ensureIndexes() {
    const collection = await getCollectionSafe();
    if (!collection) return;
    await collection.createIndex({ userId: 1 }, { unique: true });
    await collection.createIndex({ email: 1 });
}

/**
 * Create or update a user profile (upsert)
 */
export async function upsertProfile(
    userId: string,
    email: string,
    fullName?: string | null
): Promise<UserProfilePublic> {
    const collection = await getCollectionSafe();
    if (!collection) {
        return upsertFallbackProfile(userId, email, fullName);
    }
    const now = new Date();

    const result = await collection.findOneAndUpdate(
        { userId },
        {
            $set: {
                email,
                fullName: fullName ?? null,
                updatedAt: now,
            },
            $setOnInsert: {
                userId,
                createdAt: now,
            },
        },
        { upsert: true, returnDocument: 'after' }
    );

    const profile = result!;
    return {
        id: profile._id!.toString(),
        userId: profile.userId,
        fullName: profile.fullName,
        email: profile.email,
        createdAt: profile.createdAt,
        updatedAt: profile.updatedAt,
    };
}

/**
 * Get a user profile by user ID
 */
export async function getProfileByUserId(userId: string): Promise<UserProfilePublic | null> {
    const collection = await getCollectionSafe();
    if (!collection) {
        return fallbackProfiles.get(userId) ?? null;
    }
    const profile = await collection.findOne({ userId });

    if (!profile) return null;

    return {
        id: profile._id!.toString(),
        userId: profile.userId,
        fullName: profile.fullName,
        email: profile.email,
        createdAt: profile.createdAt,
        updatedAt: profile.updatedAt,
    };
}

/**
 * Update a user's full name
 */
export async function updateFullName(userId: string, fullName: string): Promise<boolean> {
    const collection = await getCollectionSafe();
    if (!collection) {
        const existing = fallbackProfiles.get(userId);
        if (!existing) return false;
        fallbackProfiles.set(userId, {
            ...existing,
            fullName,
            updatedAt: new Date(),
        });
        return true;
    }

    const result = await collection.updateOne(
        { userId },
        { $set: { fullName, updatedAt: new Date() } }
    );

    return result.modifiedCount > 0;
}

/**
 * Delete a user profile
 */
export async function deleteProfile(userId: string): Promise<boolean> {
    const collection = await getCollectionSafe();
    if (!collection) {
        return fallbackProfiles.delete(userId);
    }
    const result = await collection.deleteOne({ userId });
    return result.deletedCount > 0;
}
