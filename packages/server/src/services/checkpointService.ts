/**
 * Checkpoint Service — LangGraph Checkpoint integration backed by MongoDB.
 *
 * Provides a singleton `MongoDBSaver` instance that can be shared across
 * all agent graph runs.  Each run uses a unique `thread_id` (the runId)
 * so that checkpoints are namespaced per-run.
 *
 * Uses a **dedicated** MongoClient with `strict: false` so that TTL indexes
 * and other admin commands work on Atlas (the app's main client uses `strict: true`).
 *
 * The service also exposes helpers to list, inspect and clean-up checkpoints.
 */
import { MongoDBSaver } from "@langchain/langgraph-checkpoint-mongodb";
import { MongoClient, ServerApiVersion } from "mongodb";

// ─── Types ───────────────────────────────────────────────────────────────────

export type CheckpointThreadConfig = {
    configurable: {
        thread_id: string;
        checkpoint_ns?: string;
    };
};

export type CheckpointMetadata = {
    runId: string;
    nodeId?: string;
    status?: string;
    createdAt?: string;
};

// ─── Singleton ───────────────────────────────────────────────────────────────

let _saver: MongoDBSaver | null = null;
let _saverPromise: Promise<MongoDBSaver> | null = null;
let _checkpointClient: MongoClient | null = null;
let _checkpointClientPromise: Promise<MongoClient> | null = null;

/**
 * Return the dedicated MongoClient for checkpoints (strict: false).
 * Creates it lazily on first call.  Promise-based guard prevents race
 * conditions when multiple callers invoke this concurrently.
 */
async function getCheckpointClient(): Promise<MongoClient> {
    if (_checkpointClient) return _checkpointClient;
    if (_checkpointClientPromise) return _checkpointClientPromise;

    _checkpointClientPromise = (async () => {
        const uri = process.env.MONGODB_URI ?? "";
        if (!uri) throw new Error("MONGODB_URI not set");

        const client = new MongoClient(uri, {
            // strict: false so createIndex, distinct, collStats etc. work on Atlas
            serverApi: { version: ServerApiVersion.v1, strict: false, deprecationErrors: true },
            auth: process.env.MONGODB_USER && process.env.MONGODB_PASS
                ? { username: process.env.MONGODB_USER, password: process.env.MONGODB_PASS }
                : undefined,
        });
        await client.connect();
        _checkpointClient = client;
        return client;
    })();

    try {
        return await _checkpointClientPromise;
    } catch (err) {
        _checkpointClientPromise = null; // Allow retry on failure
        throw err;
    }
}

/**
 * Return (or lazily create) the singleton `MongoDBSaver`.
 *
 * Uses a **dedicated** MongoClient with `strict: false` because the main
 * app client uses `strict: true`, which blocks `createIndex` and other
 * admin commands needed for TTL cleanup.
 */
export async function getCheckpointSaver(): Promise<MongoDBSaver> {
    if (_saver) return _saver;
    if (_saverPromise) return _saverPromise;

    _saverPromise = (async () => {
        try {
            const client = await getCheckpointClient();
            const dbName =
                process.env.MONGODB_DB ||
                process.env.MONGODB_DB_NAME ||
                "numezis_coder";

            _saver = new MongoDBSaver({
                client: client as any,
                dbName,
            });
            console.log("[CheckpointService] MongoDBSaver initialized (strict: false client).");

            // Create TTL indexes for automatic checkpoint cleanup
            ensureCheckpointIndexes().catch((err) => {
                console.warn("[CheckpointService] TTL index creation failed:", (err as Error)?.message);
            });

            return _saver;
        } catch (err) {
            _saverPromise = null;
            console.warn("[CheckpointService] Failed to init MongoDBSaver:", (err as Error)?.message);
            throw err;
        }
    })();

    return _saverPromise;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Build a LangGraph `RunnableConfig` for a given run/thread.
 *
 * @param threadId  Unique thread identifier — typically the `runId`.
 * @param checkpointNs  Optional namespace (defaults to empty string).
 */
export function buildThreadConfig(
    threadId: string,
    checkpointNs = ""
): CheckpointThreadConfig {
    return {
        configurable: {
            thread_id: threadId,
            checkpoint_ns: checkpointNs,
        },
    };
}

/**
 * Get the latest checkpoint for a thread.
 */
export async function getLatestCheckpoint(threadId: string) {
    const saver = await getCheckpointSaver();
    const config = buildThreadConfig(threadId);
    return saver.getTuple(config);
}

/**
 * Check whether a thread has any checkpoints (i.e., was previously interrupted
 * or has partial execution state).
 */
export async function hasCheckpoint(threadId: string): Promise<boolean> {
    try {
        const tuple = await getLatestCheckpoint(threadId);
        return tuple !== undefined && tuple !== null;
    } catch {
        return false;
    }
}

/**
 * List all checkpoints for a given thread, ordered newest-first.
 */
export async function listCheckpoints(threadId: string, limit = 20) {
    const saver = await getCheckpointSaver();
    const config = buildThreadConfig(threadId);
    const results: any[] = [];
    let count = 0;
    for await (const cp of saver.list(config)) {
        results.push(cp);
        count++;
        if (count >= limit) break;
    }
    return results;
}

/**
 * Delete a single thread's checkpoints via the saver.
 * Returns true if the saver supports `deleteThread` and the call succeeded.
 */
async function deleteSingleThread(saver: MongoDBSaver, threadId: string): Promise<boolean> {
    if (typeof (saver as any).deleteThread === "function") {
        await (saver as any).deleteThread(threadId);
        return true;
    }
    return false;
}

/**
 * Delete all checkpoints for a run.
 *
 * Thread IDs follow the pattern `{runId}:{nodeId}`.  We query the
 * checkpoint collections directly (using a regex prefix) so that every
 * per-node thread is cleaned up — not just the bare runId.
 */
export async function deleteThreadCheckpoints(runId: string): Promise<void> {
    try {
        const saver = await getCheckpointSaver();
        const client = await getCheckpointClient();
        const dbName =
            process.env.MONGODB_DB ||
            process.env.MONGODB_DB_NAME ||
            "numezis_coder";
        const db = client.db(dbName);

        // MongoDBSaver uses two collections by default:
        //   - checkpoints  (or "checkpoints")
        //   - checkpoint_writes (or "checkpoint_writes")
        // Thread IDs are stored in `thread_id` inside `config.configurable`.
        const collectionsToClean = ["checkpoints", "checkpoint_writes"];
        const prefix = `${runId}:`;

        let deletedCount = 0;
        for (const colName of collectionsToClean) {
            try {
                const col = db.collection(colName);
                // Delete all documents whose thread_id starts with runId:
                const result = await col.deleteMany({
                    thread_id: { $regex: `^${escapeRegex(prefix)}` },
                });
                deletedCount += result.deletedCount ?? 0;
            } catch {
                // Collection may not exist yet — safe to skip
            }
        }

        // Also attempt the saver's own deleteThread for the bare runId
        // (in case anyone stored checkpoints under the runId directly).
        try {
            await deleteSingleThread(saver, runId);
        } catch {
            // Ignore — the prefix-based cleanup above is the primary path
        }

        if (deletedCount > 0) {
            console.log(`[CheckpointService] Deleted ${deletedCount} checkpoint docs for run ${runId}`);
        }
    } catch (err) {
        console.warn(`[CheckpointService] Failed to delete checkpoints for run ${runId}:`, (err as Error)?.message);
    }
}

/** Escape special regex characters in a string. */
function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ─── TTL Cleanup ──────────────────────────────────────────────────────────────

/** Default checkpoint retention period: 2 days (in seconds). */
const CHECKPOINT_TTL_SECONDS =
    Number(process.env.CHECKPOINT_TTL_SECONDS) || 2 * 24 * 60 * 60;

/**
 * Ensure MongoDB TTL indexes exist on checkpoint collections so that old
 * checkpoint documents are automatically removed after `CHECKPOINT_TTL_SECONDS`.
 *
 * Uses the dedicated non-strict MongoClient so `createIndex` works on Atlas.
 */
export async function ensureCheckpointIndexes(): Promise<void> {
    try {
        const client = await getCheckpointClient();
        const dbName =
            process.env.MONGODB_DB ||
            process.env.MONGODB_DB_NAME ||
            "numezis_coder";
        const db = client.db(dbName);

        // The MongoDBSaver stores a `created_at` (or `updated_at`) timestamp
        // in each checkpoint document.  We create a TTL index on it so MongoDB
        // automatically prunes old checkpoints.
        for (const colName of ["checkpoints", "checkpoint_writes"]) {
            try {
                const col = db.collection(colName);
                // `created_at` is the field MongoDBSaver uses for the timestamp.
                await col.createIndex(
                    { created_at: 1 },
                    { expireAfterSeconds: CHECKPOINT_TTL_SECONDS, background: true }
                );
                console.log(`[CheckpointService] TTL index created on ${colName} (${CHECKPOINT_TTL_SECONDS}s).`);
            } catch (indexErr) {
                // Index may already exist with different options
                console.warn(`[CheckpointService] TTL index on ${colName}:`, (indexErr as Error)?.message);
            }
        }
    } catch (err) {
        console.warn("[CheckpointService] Failed to ensure TTL indexes:", (err as Error)?.message);
    }
}

// ─── Graph Version Guard ──────────────────────────────────────────────────────

/**
 * Metadata saved alongside a checkpoint to detect graph definition changes.
 */
export type CheckpointGraphVersion = {
    /** Hash or serialised snapshot of the graph's node list at checkpoint time. */
    graphHash: string;
    /** ISO timestamp when the checkpoint was taken. */
    capturedAt: string;
};

/**
 * Produce a deterministic hash string for a graph definition's nodes + edges.
 * Used to detect whether the graph has changed between interrupt and resume.
 */
export function computeGraphHash(
    nodes: Array<{ id: string; kind?: string }>,
    edges: Array<{ source: string; target: string; condition?: string }>
): string {
    const payload = JSON.stringify(
        {
            nodes: nodes.map((n) => ({ id: n.id, kind: n.kind })).sort((a, b) => a.id.localeCompare(b.id)),
            edges: edges.map((e) => ({ s: e.source, t: e.target, c: e.condition })).sort((a, b) => `${a.s}-${a.t}`.localeCompare(`${b.s}-${b.t}`)),
        }
    );
    // Simple FNV-1a 32-bit hash — fast, deterministic, no crypto needed.
    let hash = 0x811c9dc5;
    for (let i = 0; i < payload.length; i++) {
        hash ^= payload.charCodeAt(i);
        hash = (hash * 0x01000193) >>> 0;
    }
    return hash.toString(16).padStart(8, "0");
}
