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
                const diskFilesSet = new Set(filesToIndex);
                const deletedFiles = existingFiles.filter(p => !diskFilesSet.has(p));

                if (deletedFiles.length > 0) {
                    console.log(`[Indexer] Removing ${deletedFiles.length} deleted files from index...`);
                    for (let i = 0; i < deletedFiles.length; i++) {
                        const f = deletedFiles[i];
                        currentStatus.currentFile = `Cleanup: ${path.basename(f)}`;
                        try {
                            await deleteFileVectors(f);
                        } catch (e) {
                            console.error(`Failed to delete vectors for ${f}:`, e);
                        }
                    }
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
                        await deleteFileVectors(filePath);
                        currentStatus.indexedFiles++;
                        return;
                    }

                    const content = await fs.readFile(filePath, "utf-8");
                    const contentHash = calculateHash(content);

                    // Hash check: skip if unchanged
                    if (!force) {
                        const storedHash = await getFileHash(filePath);
                        if (storedHash === contentHash) {
                            currentStatus.indexedFiles++;
                            return;
                        }
                    }

                    // Content changed or new: re-index
                    await deleteFileVectors(filePath);

                    const chunks = chunkCode(content, relativePath);
                    const fileChunksWithEmbeddings: CodeVector[] = [];

                    // We generate embeddings for chunks in sequence within a file to avoid
                    // bursting too many concurrent requests to the embedding API
                    for (const chunk of chunks) {
                        const embedding = await generateEmbedding(chunk.content);
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
