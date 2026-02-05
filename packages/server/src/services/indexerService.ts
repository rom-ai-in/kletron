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
    dimensions?: number;
    repoPath?: string;
}

// Persist status across dev-mode reloads
const statusKey = Symbol.for("numezis.indexer.status");
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
        repoPath,
    };
    statusMap.set(workspaceId, status);
    return status;
}

/**
 * Get current indexing status
 */
export function getIndexStatus(workspaceId: string, repoPath: string): IndexStatus {
    const currentStatus = getStatus(workspaceId, repoPath);
    // Attempt to discover dimensions and counts from DB if not set
    if (!currentStatus.isIndexing) {
        import("../lib/db").then(async m => {
            try {
                const db = await m.getDatabase();
                const col = db.collection("code_vectors");

                // Fetch dimension if missing
                if (!currentStatus.dimensions) {
                    const doc = await col.findOne({ repoPath });
                    if (doc && (doc as any).embedding) {
                        currentStatus.dimensions = (doc as any).embedding.length;
                    }
                }

                // Fetch total chunks if they are 0
                if (currentStatus.totalChunks === 0) {
                    currentStatus.totalChunks = await col.countDocuments({ repoPath });
                }

                // If we have chunks but totalFiles is 0, we can estimate/fetch it
                if (currentStatus.totalChunks > 0 && currentStatus.totalFiles === 0) {
                    const uniqueFiles = await getAllIndexedFilePaths(repoPath);
                    currentStatus.totalFiles = uniqueFiles.length;
                    currentStatus.indexedFiles = uniqueFiles.length; // Assume they are all indexed
                }
            } catch (e) {
                // Silently ignore if DB not ready or other error
            }
        });
    }
    return { ...currentStatus };
}

/**
 * Refresh indexing status with disk/DB reconciliation (used when not indexing)
 */
export async function refreshIndexStatus(workspaceId: string, repoPath: string): Promise<IndexStatus> {
    const currentStatus = getStatus(workspaceId, repoPath);
    if (currentStatus.isIndexing) {
        return { ...currentStatus };
    }

    const shouldRecompute =
        currentStatus.totalFiles === 0 ||
        currentStatus.indexedFiles === 0 ||
        currentStatus.indexedFiles < currentStatus.totalFiles;

    if (!shouldRecompute) {
        return { ...currentStatus };
    }

    // Always compute total files from disk so UI can show totals even if DB is unavailable.
    let diskFiles: string[] = [];
    try {
        diskFiles = await findFiles(repoPath);
        currentStatus.totalFiles = diskFiles.length;
    } catch {
        // ignore disk scan errors
    }

    try {
        const db = await getDatabase();
        const col = db.collection("code_vectors");

        // Total chunks and dimensions (lightweight)
        if (currentStatus.totalChunks === 0) {
            currentStatus.totalChunks = await col.countDocuments({ repoPath });
        }
        if (!currentStatus.dimensions) {
            const doc = await col.findOne({ repoPath });
            if (doc && (doc as any).embedding) {
                currentStatus.dimensions = (doc as any).embedding.length;
            }
        }

        // Recompute file counts using hashes
        const existingFiles = await getAllIndexedFilePaths(repoPath);
        const existingSet = new Set(existingFiles);

        let indexed = 0;
        for (const filePath of diskFiles) {
            const relativePath = path.relative(repoPath, filePath);
            if (!existingSet.has(relativePath)) continue;

            try {
                const content = await fs.readFile(filePath, "utf-8");
                const contentHash = calculateHash(content);
                const storedHash = await getFileHash(repoPath, relativePath);
                if (storedHash && storedHash === contentHash) {
                    indexed++;
                }
            } catch {
                // ignore read/hash errors for status refresh
            }
        }

        currentStatus.totalFiles = diskFiles.length;
        currentStatus.indexedFiles = indexed;
    } catch {
        // If DB is unavailable, keep indexedFiles as-is (likely 0)
    }

    return { ...currentStatus };
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

    const resume = options.resume ?? true;

    // Mutate the existing object instead of reassigning
    currentStatus.isIndexing = true;
    currentStatus.totalFiles = explicitFiles ? explicitFiles.length : 0;
    currentStatus.indexedFiles = 0;
    currentStatus.totalChunks = 0;
    currentStatus.errors = [];
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
    }
}
