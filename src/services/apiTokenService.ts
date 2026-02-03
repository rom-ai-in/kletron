// src/services/apiTokenService.ts
// MongoDB-based API token management service
import { getDb } from '../lib/db';
import { ObjectId } from 'mongodb';

export interface ApiToken {
    _id?: ObjectId;
    userId: string;           // Supabase user ID
    tokenHash: string;
    label: string;
    createdAt: Date;
    lastUsedAt: Date | null;
    revokedAt: Date | null;
}

export interface ApiTokenPublic {
    id: string;
    label: string;
    createdAt: Date;
    lastUsedAt: Date | null;
    revokedAt: Date | null;
}

const COLLECTION_NAME = 'api_tokens';

/**
 * Get the api_tokens collection
 */
async function getCollection() {
    const db = await getDb();
    return db.collection<ApiToken>(COLLECTION_NAME);
}

/**
 * Create indexes for the collection (call on startup)
 */
export async function ensureIndexes() {
    const collection = await getCollection();
    await collection.createIndex({ tokenHash: 1 }, { unique: true });
    await collection.createIndex({ userId: 1 });
}

/**
 * Create a new API token
 */
export async function createToken(
    userId: string,
    tokenHash: string,
    label: string = 'VS Code Extension'
): Promise<ApiTokenPublic> {
    const collection = await getCollection();

    const token: ApiToken = {
        userId,
        tokenHash,
        label,
        createdAt: new Date(),
        lastUsedAt: null,
        revokedAt: null,
    };

    const result = await collection.insertOne(token);

    return {
        id: result.insertedId.toString(),
        label: token.label,
        createdAt: token.createdAt,
        lastUsedAt: token.lastUsedAt,
        revokedAt: token.revokedAt,
    };
}

/**
 * Get all active tokens for a user
 */
export async function getTokensByUserId(userId: string): Promise<ApiTokenPublic[]> {
    const collection = await getCollection();

    const tokens = await collection
        .find({ userId, revokedAt: null })
        .sort({ createdAt: -1 })
        .toArray();

    return tokens.map(token => ({
        id: token._id!.toString(),
        label: token.label,
        createdAt: token.createdAt,
        lastUsedAt: token.lastUsedAt,
        revokedAt: token.revokedAt,
    }));
}

/**
 * Find a token by its hash (for validation)
 */
export async function findTokenByHash(tokenHash: string): Promise<(ApiToken & { _id: ObjectId }) | null> {
    const collection = await getCollection();

    const token = await collection.findOne({
        tokenHash,
        revokedAt: null
    });

    return token as (ApiToken & { _id: ObjectId }) | null;
}

/**
 * Update the last_used_at timestamp
 */
export async function updateLastUsed(tokenId: string | ObjectId): Promise<void> {
    const collection = await getCollection();
    const id = typeof tokenId === 'string' ? new ObjectId(tokenId) : tokenId;

    await collection.updateOne(
        { _id: id },
        { $set: { lastUsedAt: new Date() } }
    );
}

/**
 * Revoke a token (soft delete)
 */
export async function revokeToken(tokenId: string, userId: string): Promise<boolean> {
    const collection = await getCollection();

    const result = await collection.updateOne(
        {
            _id: new ObjectId(tokenId),
            userId,
            revokedAt: null
        },
        { $set: { revokedAt: new Date() } }
    );

    return result.modifiedCount > 0;
}

/**
 * Delete all tokens for a user (hard delete)
 */
export async function deleteAllUserTokens(userId: string): Promise<void> {
    const collection = await getCollection();
    await collection.deleteMany({ userId });
}
