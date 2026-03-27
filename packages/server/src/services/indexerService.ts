import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import {
    chunkCode,
    generateEmbedding,
    upsertChunks,
    clearVectors,
    getFileHash,
    deleteFileVectors,
    deleteFilesVectors,
    getAllIndexedFilePaths,
    getIndexStats,
    type CodeVector
} from "./vectorService";
import { recordVectorIndexRun } from "./vectorHistoryService";
import { config } from "../config";
import { getDatabase } from "../lib/db";

interface IndexStatus {
    isIndexing: boolean;
    totalFiles: number;
    indexedFiles: number;
    totalChunks: number;
    lastIndexedAt?: Date;
    currentFile?: string;
    errors: string[];
    errorCount: number;
    dimensions?: number;
    repoPath?: string;
}

// ---------------------------------------------------------------------------
// In-memory status (persists across dev-mode HMR reloads via global symbol)
// ---------------------------------------------------------------------------

const statusKey = Symbol.for("kletron.indexer.status");
if (!(globalThis as any)[statusKey]) {
    (globalThis as any)[statusKey] = new Map<string, IndexStatus>();
}
const statusMap: Map<string, IndexStatus> = (globalThis as any)[statusKey];

function getStatus(workspaceId: string, repoPath: string): IndexStatus {
    const existing = statusMap.get(workspaceId);
    if (existing) {
        if (!existing.repoPath) existing.repoPath = repoPath;
        return existing;
    }
    const status: IndexStatus = {
        isIndexing: false,
        totalFiles: 0,
        indexedFiles: 0,
        totalChunks: 0,
        errors: [],
        errorCount: 0,
        repoPath,
    };
    statusMap.set(workspaceId, status);
    return status;
}

/**
 * Get current indexing status (synchronous, returns in-memory state only).
 */
export function getIndexStatus(workspaceId: string, repoPath: string): IndexStatus {
    return { ...getStatus(workspaceId, repoPath) };
}

// ---------------------------------------------------------------------------
// Refresh cache (in-memory TTL, survives HMR)
// ---------------------------------------------------------------------------

const REFRESH_CACHE_TTL_MS = 30_000; // 30 seconds
const refreshCacheKey = Symbol.for("kletron.indexer.refreshCache");
if (!(globalThis as any)[refreshCacheKey]) {
    (globalThis as any)[refreshCacheKey] = new Map<string, { data: IndexStatus; ts: number }>();
}
const refreshCache: Map<string, { data: IndexStatus; ts: number }> = (globalThis as any)[refreshCacheKey];

/**
 * Invalidate the refresh cache for a workspace (call after indexing / clear).
 */
export function invalidateRefreshCache(workspaceId: string): void {
    refreshCache.delete(workspaceId);
}

// ---------------------------------------------------------------------------
// Disk file count cache (avoids repeated recursive filesystem walks)
// ---------------------------------------------------------------------------

const DISK_COUNT_CACHE_TTL_MS = 60_000; // 60 seconds
const diskCountCacheKey = Symbol.for("kletron.indexer.diskCountCache");
if (!(globalThis as any)[diskCountCacheKey]) {
    (globalThis as any)[diskCountCacheKey] = new Map<string, { count: number; ts: number }>();
}
const diskCountCache: Map<string, { count: number; ts: number }> = (globalThis as any)[diskCountCacheKey];

async function getCachedDiskFileCount(repoPath: string): Promise<number> {
    const cached = diskCountCache.get(repoPath);
    if (cached && Date.now() - cached.ts < DISK_COUNT_CACHE_TTL_MS) {
        return cached.count;
    }
    const files = await findFiles(repoPath);
    const count = files.length;
    diskCountCache.set(repoPath, { count, ts: Date.now() });
    return count;
}

// ---------------------------------------------------------------------------
// DB snapshot persistence for cold-start recovery
// ---------------------------------------------------------------------------

const STATUS_SNAPSHOT_COLLECTION = "index_status_snapshots";

async function persistStatusSnapshot(workspaceId: string, status: IndexStatus): Promise<void> {
    try {
        const db = await getDatabase();
        const { errors: _errors, ...rest } = status;
        await db.collection(STATUS_SNAPSHOT_COLLECTION).updateOne(
            { workspaceId },
            { $set: { ...rest, errorCount: status.errorCount, workspaceId, updatedAt: new Date() } },
            { upsert: true }
        );
    } catch {
        // Best-effort — never block the response on persistence failures
    }
}

async function loadStatusSnapshot(workspaceId: string): Promise<IndexStatus | null> {
    try {
        const db = await getDatabase();
        const doc = await db.collection(STATUS_SNAPSHOT_COLLECTION).findOne({ workspaceId });
        if (!doc) return null;
        return {
            isIndexing: false, // Never restore an "indexing" state from a snapshot
            totalFiles: doc.totalFiles ?? 0,
            indexedFiles: doc.indexedFiles ?? 0,
            totalChunks: doc.totalChunks ?? 0,
            lastIndexedAt: doc.lastIndexedAt,
            errors: [],
            errorCount: doc.errorCount ?? 0,
            dimensions: doc.dimensions,
            repoPath: doc.repoPath,
        };
    } catch {
        return null;
    }
}

// ---------------------------------------------------------------------------
// In-flight deduplication — coalesce concurrent calls for the same workspace
// ---------------------------------------------------------------------------

const inflightKey = Symbol.for("kletron.indexer.inflight");
if (!(globalThis as any)[inflightKey]) {
    (globalThis as any)[inflightKey] = new Map<string, Promise<IndexStatus>>();
}
const inflightMap: Map<string, Promise<IndexStatus>> = (globalThis as any)[inflightKey];

// ---------------------------------------------------------------------------
// refreshIndexStatus — FAST version
//
// OLD behaviour (removed):
//   - Recursively walked the filesystem to list every file
//   - For each file on disk that existed in the DB, it read the full file
//     content, computed a SHA-256 hash, and issued an individual MongoDB query
//     to compare hashes.
//   → O(N) file reads + O(N) DB queries on every status poll.
//
// NEW behaviour:
//   - 3 lightweight parallel MongoDB queries via getIndexStats():
//       1. count unique filePaths  (uses compound index)
//       2. countDocuments          (uses repoPath index)
//       3. findOne for dimensions  (single doc, projection-only)
//   - Cached disk file count (fs walk every 60 s, not every request)
//   - DB snapshot for instant cold-start recovery
//   - In-flight deduplication to coalesce concurrent requests
//   → Typical response < 50 ms instead of 5-30 s
// ---------------------------------------------------------------------------

export async function refreshIndexStatus(workspaceId: string, repoPath: string): Promise<IndexStatus> {
    const currentStatus = getStatus(workspaceId, repoPath);

    // While indexing, always return live status (no cache)
    if (currentStatus.isIndexing) {
        return { ...currentStatus };
    }

    // Return in-memory cache if still fresh
    const cached = refreshCache.get(workspaceId);
    if (cached && Date.now() - cached.ts < REFRESH_CACHE_TTL_MS) {
        return { ...cached.data };
    }

    // Deduplicate concurrent in-flight requests for the same workspace
    const existing = inflightMap.get(workspaceId);
    if (existing) return existing;

    const work = (async (): Promise<IndexStatus> => {
        try {
            // Cold-start recovery: if in-memory state is zeroed, try loading from DB snapshot
            if (currentStatus.totalFiles === 0 && currentStatus.totalChunks === 0) {
                const snapshot = await loadStatusSnapshot(workspaceId);
                if (snapshot) {
                    Object.assign(currentStatus, snapshot);
                    currentStatus.repoPath = repoPath;
                }
            }

            // Fast DB-only stats (3 parallel lightweight queries, no per-file reads)
            try {
                const stats = await getIndexStats(repoPath);
                currentStatus.indexedFiles = stats.indexedFiles;
                currentStatus.totalChunks = stats.totalChunks;
                if (stats.dimensions) currentStatus.dimensions = stats.dimensions;
            } catch {
                // DB unavailable — keep existing in-memory values
            }

            // Disk file count (cached for 60 s to avoid repeated filesystem walks)
            try {
                currentStatus.totalFiles = await getCachedDiskFileCount(repoPath);
            } catch {
                // Filesystem unavailable — keep existing value
            }

            currentStatus.errorCount = currentStatus.errors.length;

            // Cache result + persist snapshot (fire-and-forget)
            const result: IndexStatus = { ...currentStatus };
            refreshCache.set(workspaceId, { data: result, ts: Date.now() });
            void persistStatusSnapshot(workspaceId, result);

            return result;
        } finally {
            inflightMap.delete(workspaceId);
        }
    })();

    inflightMap.set(workspaceId, work);
    return work;
}

/**
 * Calculate SHA256 hash of a string
 */
function calculateHash(content: string): string {
    return crypto.createHash("sha256").update(content).digest("hex");
}

/**
 * Recursively find all files in a directory
 */
async function findFiles(dir: string, extensions: string[] = [".ts", ".tsx", ".js", ".jsx", ".md", ".txt"]): Promise<string[]> {
    const files: string[] = [];
    const items = await fs.readdir(dir, { withFileTypes: true });

    for (const item of items) {
        const fullPath = path.join(dir, item.name);
        if (item.isDirectory()) {
            if (item.name === "node_modules" || item.name === ".git" || item.name === ".next" || item.name === "dist") {
                continue;
            }
            files.push(...(await findFiles(fullPath, extensions)));
        } else {
            const ext = path.extname(item.name);
            if (extensions.includes(ext)) {
                files.push(fullPath);
            }
        }
    }

    return files;
}

/**
 * Start indexing a repository
 */
type StartIndexOptions = {
    resume?: boolean;
};

export async function startIndexing(
    workspaceId: string,
    repoPath: string,
    force = false,
    explicitFiles?: string[],
    options: StartIndexOptions = {}
): Promise<void> {
    const currentStatus = getStatus(workspaceId, repoPath);
    if (currentStatus.isIndexing) {
        throw new Error("Indexing is already in progress");
    }

    // Invalidate cached refresh so next status poll gets live data
    invalidateRefreshCache(workspaceId);

    const resume = options.resume ?? true;

    // Mutate the existing object instead of reassigning
    currentStatus.isIndexing = true;
    currentStatus.totalFiles = explicitFiles ? explicitFiles.length : 0;
    currentStatus.indexedFiles = 0;
    currentStatus.totalChunks = 0;
    currentStatus.errors = [];
    currentStatus.errorCount = 0;
    currentStatus.currentFile = "Starting...";

    let chunksGeneratedInRun = 0;
    const startTime = new Date();

    try {
        try {
            const db = await getDatabase();
            await db.command({ ping: 1 });
        } catch (error) {
            const errorMsg = "Vector database unavailable. Check MONGODB_URI/network access before indexing.";
            console.error(errorMsg, error);
            currentStatus.errors.push(errorMsg);
            return;
        }

        let filesToIndex: string[] = [];

        if (explicitFiles) {
            filesToIndex = explicitFiles;
        } else {
            console.info(`[Indexer] Scanning files in ${repoPath}...`);
            currentStatus.currentFile = "Scanning repository...";
            const diskFiles = await findFiles(repoPath);
            currentStatus.totalFiles = diskFiles.length;

            if (force) {
                currentStatus.currentFile = "Clearing existing vectors...";
                await clearVectors(repoPath);
                filesToIndex = diskFiles;
            } else {
                // Full reconciliation: Detect deleted files
                currentStatus.currentFile = "Checking for deleted files...";
                const existingFiles = await getAllIndexedFilePaths(repoPath);

                // Map disk files to relative paths for comparison with DB paths
                const diskFilesRelativeSet = new Set(diskFiles.map(f => path.relative(repoPath, f)));
                const deletedFiles = existingFiles.filter(p => !diskFilesRelativeSet.has(p));

                if (deletedFiles.length > 0) {
                    console.info(`[Indexer] Removing ${deletedFiles.length} deleted files from index...`);
                    currentStatus.currentFile = `Cleanup: Removing ${deletedFiles.length} old files...`;
                    // Optimize with bulk delete
                    await deleteFilesVectors(repoPath, deletedFiles);
                }

                if (resume) {
                    currentStatus.currentFile = "Checking indexed files...";
                    const existingSet = new Set(existingFiles);
                    const remaining: string[] = [];
                    let alreadyIndexed = 0;

                    for (const filePath of diskFiles) {
                        const relativePath = path.relative(repoPath, filePath);
                        if (!existingSet.has(relativePath)) {
                            remaining.push(filePath);
                            continue;
                        }

                        try {
                            const content = await fs.readFile(filePath, "utf-8");
                            const contentHash = calculateHash(content);
                            const storedHash = await getFileHash(repoPath, relativePath);

                            if (storedHash && storedHash === contentHash) {
                                alreadyIndexed++;
                                continue;
                            }
                        } catch {
                            // If anything fails, we retry indexing this file
                        }

                        remaining.push(filePath);
                    }

                    filesToIndex = remaining;
                    currentStatus.indexedFiles = alreadyIndexed;
                } else {
                    filesToIndex = diskFiles;
                }
            }
        }

        // Process files in batches
        const BATCH_SIZE = 10;
        for (let i = 0; i < filesToIndex.length; i += BATCH_SIZE) {
            const batch = filesToIndex.slice(i, i + BATCH_SIZE);
            const batchChunksWithEmbeddings: CodeVector[] = [];

            await Promise.all(batch.map(async (filePath) => {
                try {
                    // Update current file status immediately for UI feedback
                    const relativePath = path.relative(repoPath, filePath);
                    currentStatus.currentFile = relativePath;

                    // Check if file exists
                    try {
                        await fs.access(filePath);
                    } catch {
                        await deleteFileVectors(repoPath, relativePath);
                        currentStatus.indexedFiles++;
                        return;
                    }

                    const content = await fs.readFile(filePath, "utf-8");
                    const contentHash = calculateHash(content);

                    // Hash check: skip if unchanged
                    if (!force) {
                        const storedHash = await getFileHash(repoPath, relativePath);
                        if (storedHash === contentHash) {
                            currentStatus.indexedFiles++;
                            return;
                        }
                    }

                    // Content changed or new: re-index
                    await deleteFileVectors(repoPath, relativePath);

                    const chunks = chunkCode(content, relativePath);
                    const fileChunksWithEmbeddings: CodeVector[] = [];

                    // We generate embeddings for chunks in sequence within a file to avoid
                    // bursting too many concurrent requests to the embedding API
                    for (const chunk of chunks) {
                        const embedding = await generateEmbedding(chunk.content);
                        if (!currentStatus.dimensions) {
                            currentStatus.dimensions = embedding.length;
                        }
                        fileChunksWithEmbeddings.push({
                            ...chunk,
                            contentHash,
                            repoPath,
                            embedding,
                            indexedAt: new Date(),
                        });
                    }

                    batchChunksWithEmbeddings.push(...fileChunksWithEmbeddings);
                    currentStatus.indexedFiles++;
                } catch (err) {
                    const errorMsg = `Error indexing ${filePath}: ${err instanceof Error ? err.message : String(err)}`;
                    console.error(errorMsg);
                    currentStatus.errors.push(errorMsg);
                    currentStatus.indexedFiles++;
                }
            }));

            // Upsert all chunks from this batch in one go
            if (batchChunksWithEmbeddings.length > 0) {
                await upsertChunks(batchChunksWithEmbeddings);
                currentStatus.totalChunks += batchChunksWithEmbeddings.length;
                chunksGeneratedInRun += batchChunksWithEmbeddings.length;
            }

            // Yield to event loop to keep API responsive
            await new Promise(resolve => setTimeout(resolve, 0));
        }

        currentStatus.lastIndexedAt = new Date();
    } catch (err) {
        const errorMsg = `Critical indexing error: ${err instanceof Error ? err.message : String(err)}`;
        console.error(errorMsg);
        currentStatus.errors.push(errorMsg);
    } finally {
        const endTime = new Date();
        await recordVectorIndexRun({
            workspaceId,
            start: startTime,
            end: endTime,
            durationMs: endTime.getTime() - startTime.getTime(),
            totalFiles: currentStatus.totalFiles,
            processedFiles: currentStatus.indexedFiles,
            chunksGenerated: chunksGeneratedInRun,
            status: currentStatus.errors.length > 0 ? (currentStatus.errors.length < currentStatus.totalFiles ? 'partial_error' : 'error') : 'success',
            errors: [...currentStatus.errors],
            trigger: explicitFiles ? 'auto' : 'manual',
            repoPath
        });

        currentStatus.isIndexing = false;
        currentStatus.currentFile = undefined;
        currentStatus.errorCount = currentStatus.errors.length;
        // Invalidate caches so the next status request gets fresh data
        invalidateRefreshCache(workspaceId);
        diskCountCache.delete(repoPath);
    }
}
