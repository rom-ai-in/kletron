import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { chunkCode, generateEmbedding, upsertChunks, clearVectors, type CodeVector } from "./vectorService";
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

let currentStatus: IndexStatus = {
    isIndexing: false,
    totalFiles: 0,
    indexedFiles: 0,
    totalChunks: 0,
    errors: [],
};

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
export async function startIndexing(repoPath: string, force = false): Promise<void> {
    if (currentStatus.isIndexing) {
        throw new Error("Indexing is already in progress");
    }

    currentStatus = {
        isIndexing: true,
        totalFiles: 0,
        indexedFiles: 0,
        totalChunks: 0,
        errors: [],
    };

    try {
        const files = await findFiles(repoPath);
        currentStatus.totalFiles = files.length;

        if (force) {
            await clearVectors(repoPath);
        }

        for (const filePath of files) {
            try {
                currentStatus.currentFile = path.relative(repoPath, filePath);
                const content = await fs.readFile(filePath, "utf-8");
                const relativePath = path.relative(repoPath, filePath);
                const contentHash = calculateHash(content);

                // Chunk the code
                const chunks = chunkCode(content, relativePath);

                const chunksWithEmbeddings: CodeVector[] = [];
                for (const chunk of chunks) {
                    // We generate embeddings for each chunk
                    // Note: This could be optimized with batching if the provider supports it
                    const embedding = await generateEmbedding(chunk.content);
                    chunksWithEmbeddings.push({
                        ...chunk,
                        contentHash,
                        repoPath,
                        embedding,
                        indexedAt: new Date(),
                    });
                }

                await upsertChunks(chunksWithEmbeddings);
                currentStatus.totalChunks += chunksWithEmbeddings.length;
                currentStatus.indexedFiles++;
            } catch (err) {
                const errorMsg = `Error indexing ${filePath}: ${err instanceof Error ? err.message : String(err)}`;
                console.error(errorMsg);
                currentStatus.errors.push(errorMsg);
            }
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
