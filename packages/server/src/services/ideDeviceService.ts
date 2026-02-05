import { getDb } from '../lib/db';

export interface IdeDeviceSession {
    deviceCode: string;
    userCode: string;
    createdAt: Date;
    expiresAt: Date;
    accessToken?: string;
    refreshToken?: string;
    tokenExpiresAt?: number;
    user?: {
        id: string;
        email: string;
        fullName: string | null;
    };
}

const COLLECTION_NAME = 'ide_device_sessions';
const DEVICE_SESSION_TTL_MS = 10 * 60 * 1000;

const memorySessions = new Map<string, IdeDeviceSession>();
let warnedNoDb = false;

async function getCollection() {
    const db = await getDb();
    return db.collection<IdeDeviceSession>(COLLECTION_NAME);
}

function isExpired(session: IdeDeviceSession) {
    return session.expiresAt.getTime() < Date.now();
}

function handleDbError(err: unknown) {
    if (!warnedNoDb) {
        warnedNoDb = true;
        console.warn('[IDE Device] Falling back to in-memory storage:', err);
    }
}

export async function createIdeDeviceSession(session: IdeDeviceSession): Promise<void> {
    try {
        const collection = await getCollection();
        await collection.insertOne(session);
    } catch (err) {
        handleDbError(err);
        memorySessions.set(session.deviceCode, session);
    }
}

export async function getDeviceByDeviceCode(deviceCode: string): Promise<IdeDeviceSession | null> {
    try {
        const collection = await getCollection();
        const session = await collection.findOne({ deviceCode });
        if (!session) return null;
        if (isExpired(session)) {
            await collection.deleteOne({ deviceCode });
            return null;
        }
        return session;
    } catch (err) {
        handleDbError(err);
        const session = memorySessions.get(deviceCode);
        if (!session) return null;
        if (isExpired(session)) {
            memorySessions.delete(deviceCode);
            return null;
        }
        return session;
    }
}

export async function getDeviceByUserCode(userCode: string): Promise<IdeDeviceSession | null> {
    try {
        const collection = await getCollection();
        const session = await collection.findOne({ userCode });
        if (!session) return null;
        if (isExpired(session)) {
            await collection.deleteOne({ deviceCode: session.deviceCode });
            return null;
        }
        return session;
    } catch (err) {
        handleDbError(err);
        for (const session of memorySessions.values()) {
            if (session.userCode === userCode) {
                if (isExpired(session)) {
                    memorySessions.delete(session.deviceCode);
                    return null;
                }
                return session;
            }
        }
        return null;
    }
}

export async function updateDeviceSession(deviceCode: string, update: Partial<IdeDeviceSession>): Promise<void> {
    try {
        const collection = await getCollection();
        await collection.updateOne({ deviceCode }, { $set: update });
    } catch (err) {
        handleDbError(err);
        const existing = memorySessions.get(deviceCode);
        if (existing) {
            memorySessions.set(deviceCode, { ...existing, ...update });
        }
    }
}

export async function consumeDeviceSession(deviceCode: string): Promise<IdeDeviceSession | null> {
    try {
        const collection = await getCollection();
        const session = await collection.findOne({ deviceCode });
        if (!session) return null;
        if (isExpired(session)) {
            await collection.deleteOne({ deviceCode });
            return null;
        }
        await collection.deleteOne({ deviceCode });
        return session;
    } catch (err) {
        handleDbError(err);
        const session = memorySessions.get(deviceCode);
        if (!session) return null;
        if (isExpired(session)) {
            memorySessions.delete(deviceCode);
            return null;
        }
        memorySessions.delete(deviceCode);
        return session;
    }
}
