// src/services/userProfileService.ts
// MongoDB-based user profile service
import { getDb } from '../lib/db';

export interface UserProfile {
    _id?: string;
    supabaseId: string;       // Supabase auth user ID
    fullName: string | null;
    email: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface UserProfilePublic {
    id: string;
    supabaseId: string;
    fullName: string | null;
    email: string;
    createdAt: Date;
    updatedAt: Date;
}

const COLLECTION_NAME = 'user_profiles';

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
    const collection = await getCollection();
    await collection.createIndex({ supabaseId: 1 }, { unique: true });
    await collection.createIndex({ email: 1 });
}

/**
 * Create or update a user profile (upsert)
 */
export async function upsertProfile(
    supabaseId: string,
    email: string,
    fullName?: string | null
): Promise<UserProfilePublic> {
    const collection = await getCollection();
    const now = new Date();

    const result = await collection.findOneAndUpdate(
        { supabaseId },
        {
            $set: {
                email,
                fullName: fullName ?? null,
                updatedAt: now,
            },
            $setOnInsert: {
                supabaseId,
                createdAt: now,
            },
        },
        { upsert: true, returnDocument: 'after' }
    );

    const profile = result!;
    return {
        id: profile._id!.toString(),
        supabaseId: profile.supabaseId,
        fullName: profile.fullName,
        email: profile.email,
        createdAt: profile.createdAt,
        updatedAt: profile.updatedAt,
    };
}

/**
 * Get a user profile by Supabase ID
 */
export async function getProfileBySupabaseId(supabaseId: string): Promise<UserProfilePublic | null> {
    const collection = await getCollection();
    const profile = await collection.findOne({ supabaseId });

    if (!profile) return null;

    return {
        id: profile._id!.toString(),
        supabaseId: profile.supabaseId,
        fullName: profile.fullName,
        email: profile.email,
        createdAt: profile.createdAt,
        updatedAt: profile.updatedAt,
    };
}

/**
 * Update a user's full name
 */
export async function updateFullName(supabaseId: string, fullName: string): Promise<boolean> {
    const collection = await getCollection();

    const result = await collection.updateOne(
        { supabaseId },
        { $set: { fullName, updatedAt: new Date() } }
    );

    return result.modifiedCount > 0;
}

/**
 * Delete a user profile
 */
export async function deleteProfile(supabaseId: string): Promise<boolean> {
    const collection = await getCollection();
    const result = await collection.deleteOne({ supabaseId });
    return result.deletedCount > 0;
}
