import { getDatabase } from "./mongoClient";

const LOCK_COLLECTION = "distributed_locks";

/**
 * Acquire a lock with a short TTL (default 5 min).
 * Returns true if we got the lock, false if another process holds it.
 */
export async function acquireLock(name: string, ttlMs = 5 * 60 * 1000): Promise<boolean> {
    const db = await getDatabase();
    const coll = db.collection(LOCK_COLLECTION);

    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlMs);

    // Using findOneAndUpdate with $setOnInsert acts as an atomic "insert if not exists"
    // We also check if the existing lock is expired (expiresAt < now)
    const result = await coll.findOneAndUpdate(
        {
            _id: name as any,
            $or: [
                { expiresAt: { $lt: now } }, // Lock exists but expired
                { expiresAt: { $exists: false } } // Should not happen but safety
            ]
        },
        {
            $set: { expiresAt } // Update expiry if we take over an expired lock
        },
        {
            upsert: true, // Create if doesn't exist (this is the main path)
            returnDocument: "after",
            includeResultMetadata: true
        }
    );

    // If upserted, we got the lock.
    // If updated (because it was expired), we took it over.
    // However, Mongo's upsert + concurrent writers behavior can be tricky.
    // A more robust pattern for "insert if strictly not exists" is relying on _id uniqueness,
    // but here we want to handle expiry.

    // Simpler logic for distributed lock with TTL in Mongo:
    // 1. Try to insert. If success -> acquired.
    // 2. If dup key error -> check if expired.
    //    If expired -> allow taking over.

    // Let's stick to a simpler "try to set owner if expired or new" approach.
    // But findOneAndUpdate upsert with query filter only upserts if query matches NOTHING or if query misses but upsert condition met.

    // We will use the standard pattern: 
    // Query: { _id: name }
    // If not found -> insert
    // If found -> check expiry.

    // Re-implementation for correctness:
    try {
        // 1. Clean up expired lock first (lazy expiry)
        await coll.deleteOne({ _id: name as any, expiresAt: { $lt: now } });

        // 2. Try to insert new lock
        await coll.insertOne({ _id: name as any, expiresAt });
        return true;
    } catch (e: any) {
        if (e.code === 11000) {
            // Duplicate key error = lock is held and valid
            return false;
        }
        console.error("Error acquiring lock:", e);
        return false;
    }
}

/**
 * Release a lock (delete the document).
 */
export async function releaseLock(name: string): Promise<void> {
    const db = await getDatabase();
    await db.collection(LOCK_COLLECTION).deleteOne({ _id: name as any });
}
