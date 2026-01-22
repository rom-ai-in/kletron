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
import { config } from "../config";

interface IndexStatus {
    isIndexing: boolean;
    totalFiles: number;
    indexedFiles: number;
    totalChunks: number;
    lastIndexedAt?: Date;
    currentFile?: string;
    errors: string[];
    dimensions?: number;
}

// Persist status across dev-mode reloads
const statusKey = Symbol.for("numezis.indexer.status");
if (!(globalThis as any)[statusKey]) {
    (globalThis as any)[statusKey] = {
        isIndexing: false,
        totalFiles: 0,
        indexedFiles: 0,
        totalChunks: 0,
        errors: [],
    };
}

const currentStatus: IndexStatus = (globalThis as any)[statusKey];

/**
 * Get current indexing status
 */
export function getIndexStatus(): IndexStatus {
    // Attempt to discover dimensions and counts from DB if not set
    if (!currentStatus.isIndexing) {
        import("./mongoClient").then(async m => {
            try {
                const db = await m.getDatabase();
                const col = db.collection("code_vectors");

                // Fetch dimension if missing
                if (!currentStatus.dimensions) {
                    const doc = await col.findOne({});
                    if (doc && (doc as any).embedding) {
                        currentStatus.dimensions = (doc as any).embedding.length;
                    }
                }

                // Fetch total chunks if they are 0
                if (currentStatus.totalChunks === 0) {
                    currentStatus.totalChunks = await col.countDocuments();
                }

                // If we have chunks but totalFiles is 0, we can estimate/fetch it
                if (currentStatus.totalChunks > 0 && currentStatus.totalFiles === 0) {
                    const uniqueFiles = await col.distinct("filePath");
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
export async function startIndexing(repoPath: string, force = false, explicitFiles?: string[]): Promise<void> {
    if (currentStatus.isIndexing) {
        throw new Error("Indexing is already in progress");
    }

    // Mutate the existing object instead of reassigning
    currentStatus.isIndexing = true;
    currentStatus.totalFiles = explicitFiles ? explicitFiles.length : 0;
    currentStatus.indexedFiles = 0;
    currentStatus.totalChunks = 0;
    currentStatus.errors = [];
    currentStatus.currentFile = "Starting...";

    try {
        let filesToIndex: string[] = [];

        if (explicitFiles) {
            filesToIndex = explicitFiles;
        } else {
            console.log(`[Indexer] Scanning files in ${repoPath}...`);
            currentStatus.currentFile = "Scanning repository...";
            filesToIndex = await findFiles(repoPath);
            currentStatus.totalFiles = filesToIndex.length;

            if (force) {
                currentStatus.currentFile = "Clearing existing vectors...";
                await clearVectors(repoPath);
            } else {
                // Full reconciliation: Detect deleted files
                currentStatus.currentFile = "Checking for deleted files...";
                const existingFiles = await getAllIndexedFilePaths();

                // Map disk files to relative paths for comparison with DB paths
                const diskFilesRelativeSet = new Set(filesToIndex.map(f => path.relative(repoPath, f)));
                const deletedFiles = existingFiles.filter(p => !diskFilesRelativeSet.has(p));

                if (deletedFiles.length > 0) {
                    console.log(`[Indexer] Removing ${deletedFiles.length} deleted files from index...`);
                    currentStatus.currentFile = `Cleanup: Removing ${deletedFiles.length} old files...`;
                    // Optimize with bulk delete
                    await deleteFilesVectors(deletedFiles);
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
                        await deleteFileVectors(relativePath);
                        currentStatus.indexedFiles++;
                        return;
                    }

                    const content = await fs.readFile(filePath, "utf-8");
                    const contentHash = calculateHash(content);

                    // Hash check: skip if unchanged
                    if (!force) {
                        const storedHash = await getFileHash(relativePath);
                        if (storedHash === contentHash) {
                            currentStatus.indexedFiles++;
                            return;
                        }
                    }

                    // Content changed or new: re-index
                    await deleteFileVectors(relativePath);

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
        currentStatus.isIndexing = false;
        currentStatus.currentFile = undefined;
    }
}
