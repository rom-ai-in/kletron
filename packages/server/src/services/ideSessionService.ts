// src/services/ideSessionService.ts
// Persistent storage for IDE device sessions (MongoDB with in-memory fallback)
import { getDb } from '../lib/db';

export interface IdeSession {
    deviceSessionId: string;
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: number;
    user?: {
        id: string;
        email: string;
        fullName: string | null;
    };
    codeChallenge?: string;
    createdAt: Date;
}

const COLLECTION_NAME = 'ide_sessions';
const DEVICE_SESSION_TTL_MS = 5 * 60 * 1000; // 5 minutes

const memorySessions = new Map<string, IdeSession>();
let warnedNoDb = false;

async function getCollection() {
    const db = await getDb();
    return db.collection<IdeSession>(COLLECTION_NAME);
}

function isExpired(session: IdeSession) {
    return Date.now() - session.createdAt.getTime() > DEVICE_SESSION_TTL_MS;
}

function handleDbError(err: unknown) {
    if (!warnedNoDb) {
        warnedNoDb = true;
        console.warn('[IDE Session] Falling back to in-memory storage:', err);
    }
}

export async function initIdeSession(deviceSessionId: string, codeChallenge?: string): Promise<void> {
    try {
        const collection = await getCollection();
        await collection.updateOne(
            { deviceSessionId },
            {
                $setOnInsert: { deviceSessionId, createdAt: new Date() },
                $set: codeChallenge ? { codeChallenge } : {}
            },
            { upsert: true }
        );
    } catch (err) {
        handleDbError(err);
        const existing = memorySessions.get(deviceSessionId);
        if (existing) {
            existing.codeChallenge = codeChallenge ?? existing.codeChallenge;
            return;
        }
        memorySessions.set(deviceSessionId, {
            deviceSessionId,
            codeChallenge,
            createdAt: new Date()
        });
    }
}

export async function storeIdeSession(session: IdeSession): Promise<void> {
    try {
        const collection = await getCollection();
        const update: Record<string, unknown> = {
            accessToken: session.accessToken,
            refreshToken: session.refreshToken,
            expiresAt: session.expiresAt,
            user: session.user
        };
        if (session.codeChallenge) {
            update.codeChallenge = session.codeChallenge;
        }
        await collection.updateOne(
            { deviceSessionId: session.deviceSessionId },
            {
                $setOnInsert: { deviceSessionId: session.deviceSessionId, createdAt: session.createdAt },
                $set: update
            },
            { upsert: true }
        );
    } catch (err) {
        handleDbError(err);
        const existing = memorySessions.get(session.deviceSessionId);
        memorySessions.set(session.deviceSessionId, {
            ...existing,
            ...session,
            codeChallenge: session.codeChallenge ?? existing?.codeChallenge,
            createdAt: existing?.createdAt ?? session.createdAt
        });
    }
}

export async function getIdeSession(deviceSessionId: string): Promise<IdeSession | null> {
    try {
        const collection = await getCollection();
        const session = await collection.findOne({ deviceSessionId });
        if (!session) return null;
        if (isExpired(session)) {
            await collection.deleteOne({ deviceSessionId });
            return null;
        }
        return session;
    } catch (err) {
        handleDbError(err);
        const session = memorySessions.get(deviceSessionId);
        if (!session) return null;
        if (isExpired(session)) {
            memorySessions.delete(deviceSessionId);
            return null;
        }
        return session;
    }
}

export async function consumeIdeSession(deviceSessionId: string): Promise<IdeSession | null> {
    try {
        const collection = await getCollection();
        const session = await collection.findOne({ deviceSessionId });
        if (!session) return null;
        if (isExpired(session)) {
            await collection.deleteOne({ deviceSessionId });
            return null;
        }
        await collection.deleteOne({ deviceSessionId });
        return session;
    } catch (err) {
        handleDbError(err);
        const session = memorySessions.get(deviceSessionId);
        if (!session) return null;
        if (isExpired(session)) {
            memorySessions.delete(deviceSessionId);
            return null;
        }
        memorySessions.delete(deviceSessionId);
        return session;
    }
}
