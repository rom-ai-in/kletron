import { Collection, ObjectId } from "mongodb";
import { getDatabase } from "./mongoClient";
import { getEmbeddingConfig } from "./embeddingConfigService";

export interface CodeChunk {
    filePath: string;
    startLine: number;
    endLine: number;
    content: string;
    language: string;
    contentHash: string;
    repoPath: string;
    metadata?: Record<string, any>;
}

export interface CodeVector extends CodeChunk {
    _id?: ObjectId;
    embedding: number[];
    indexedAt: Date;
}

const COLLECTION_NAME = "code_vectors";

async function getCollection(): Promise<Collection<CodeVector>> {
    const db = await getDatabase();
    const collection = db.collection<CodeVector>(COLLECTION_NAME);

    // Ensure index on filePath for fast lookup during reconciliation
    // We do this asynchronously to not block the first call too much
    void collection.createIndex({ filePath: 1 });

    return collection;
}

/**
 * Generate embedding for a given text using the configured provider
 */
export async function generateEmbedding(text: string): Promise<number[]> {
    const config = await getEmbeddingConfig();
    const provider = config.provider;

    if (provider === "azure") {
        const azure = config.azure;
        if (!azure?.endpoint || !azure?.apiKey || !azure?.deployment) {
            throw new Error("Azure embedding configuration is incomplete");
        }

        const url = `${azure.endpoint}/openai/deployments/${azure.deployment}/embeddings?api-version=${azure.apiVersion ?? "2024-02-01"}`;

        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "api-key": azure.apiKey,
            },
            body: JSON.stringify({
                input: text,
                model: azure.model ?? "text-embedding-ada-002",
            }),
            signal: AbortSignal.timeout(30000), // 30s timeout
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error?.message ?? `Azure API error: ${response.status}`);
        }

        const data = await response.json();
        return data.data[0].embedding;
    } else {
        const lms = config.lmstudio;
        if (!lms?.baseUrl || !lms?.model) {
            throw new Error("LM Studio embedding configuration is incomplete");
        }

        const url = `${lms.baseUrl}/embeddings`;

        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...(lms.apiKey ? { "Authorization": `Bearer ${lms.apiKey}` } : {}),
            },
            body: JSON.stringify({
                input: text,
                model: lms.model,
            }),
            signal: AbortSignal.timeout(30000), // 30s timeout
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error?.message ?? `LM Studio API error: ${response.status}`);
        }

        const data = await response.json();
        return data.data[0].embedding;
    }
}

/**
 * Simple code chunker - splits by character count while attempting to respect line boundaries
 */
export function chunkCode(content: string, filePath: string, options = { chunkSize: 2000, overlap: 200 }): CodeChunk[] {
    const lines = content.split("\n");
    const chunks: CodeChunk[] = [];
    const language = filePath.split(".").pop() ?? "unknown";

    // For now, a simple rolling window of lines
    // In the future, we can use tree-sitter or similar for AST-based chunking
    let currentChunkLines: string[] = [];
    let currentChunkSize = 0;
    let startLine = 1;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        currentChunkLines.push(line);
        currentChunkSize += line.length + 1;

        if (currentChunkSize >= options.chunkSize || i === lines.length - 1) {
            const chunkContent = currentChunkLines.join("\n");
            chunks.push({
                filePath,
                startLine,
                endLine: i + 1,
                content: chunkContent,
                language,
                contentHash: "", // To be calculated by the caller
                repoPath: "",    // To be filled by the caller
            });

            // Start new chunk with overlap
            const overlapLinesCount = Math.floor(currentChunkLines.length * (options.overlap / options.chunkSize));
            const actualOverlap = Math.max(1, overlapLinesCount);

            currentChunkLines = currentChunkLines.slice(-actualOverlap);
            currentChunkSize = currentChunkLines.join("\n").length;
            startLine = i + 1 - actualOverlap + 1;
        }
    }

    return chunks;
}

/**
 * Upsert chunks with embeddings to MongoDB using Bulk operations
 */
export async function upsertChunks(chunks: CodeVector[]): Promise<void> {
    if (chunks.length === 0) return;

    const collection = await getCollection();

    const operations = chunks.map(chunk => ({
        updateOne: {
            filter: { filePath: chunk.filePath, startLine: chunk.startLine, endLine: chunk.endLine },
            update: { $set: chunk },
            upsert: true
        }
    }));

    await collection.bulkWrite(operations);
}

/**
 * Perform semantic search using Atlas Vector Search
 */
export async function semanticSearch(query: string, options: {
    path?: string;
    language?: string;
    maxResults?: number;
    minScore?: number;
} = {}): Promise<any[]> {
    const embedding = await generateEmbedding(query);
    const collection = await getCollection();

    const pipeline: any[] = [
        {
            $vectorSearch: {
                index: "vector_index",
                path: "embedding",
                queryVector: embedding,
                numCandidates: 100,
                limit: options.maxResults ?? 10,
            }
        },
        {
            $project: {
                _id: 1,
                filePath: 1,
                startLine: 1,
                endLine: 1,
                content: 1,
                language: 1,
                score: { $meta: "vectorSearchScore" }
            }
        }
    ];

    if (options.path || options.language) {
        const filter: any = {};
        if (options.path) {
            filter.filePath = { $regex: options.path, $options: "i" };
        }
        if (options.language) {
            filter.language = options.language;
        }
        // $vectorSearch allows a 'filter' property in some versions, 
        // but for broader compatibility with Atlas versions, we might need to adjust.
        // Putting it in the $vectorSearch stage if supported by the user's Atlas version.
        pipeline[0].$vectorSearch.filter = filter;
    }

    const results = await collection.aggregate(pipeline).toArray();

    if (options.minScore) {
        return results.filter(r => r.score >= options.minScore!);
    }

    return results;
}


/**
 * Clear vectors for a specific repository path
 */
export async function clearVectors(repoPath?: string): Promise<void> {
    const collection = await getCollection();
    if (repoPath) {
        await collection.deleteMany({ repoPath });
    } else {
        await collection.deleteMany({});
    }
}

/**
 * Get the stored hash for a specific file
 */
export async function getFileHash(filePath: string): Promise<string | null> {
    const collection = await getCollection();
    // We only need one chunk to check the contentHash since all chunks
    // for a file share the same contentHash
    const chunk = await collection.findOne(
        { filePath },
        { projection: { contentHash: 1 } }
    );
    return chunk?.contentHash || null;
}

/**
 * Delete all vectors for a specific file
 */
export async function deleteFileVectors(filePath: string): Promise<void> {
    const collection = await getCollection();
    await collection.deleteMany({ filePath });
}

/**
 * Get a list of all currently indexed file paths
 */
export async function getAllIndexedFilePaths(): Promise<string[]> {
    const collection = await getCollection();
    const result = await collection.distinct("filePath");
    return result;
}
