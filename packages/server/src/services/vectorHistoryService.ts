import { getDatabase } from "../lib/db";

export interface VectorIndexRun {
    _id?: any;
    workspaceId?: string;
    start: Date;
    end: Date;
    durationMs: number;
    totalFiles: number;
    processedFiles: number;
    chunksGenerated: number;
    status: 'success' | 'error' | 'partial_error';
    errors: string[];
    trigger: 'manual' | 'auto';
    repoPath: string;
}

const COLLECTION_NAME = "vector_index_runs";

export async function recordVectorIndexRun(run: Omit<VectorIndexRun, "_id">) {
    try {
        const db = await getDatabase();
        const col = db.collection<VectorIndexRun>(COLLECTION_NAME);
        await col.insertOne(run as any);
    } catch (error) {
        console.error("Failed to record vector index run:", error);
        // Don't throw, just log - we don't want to break the indexing process for logging
    }
}

export async function getVectorIndexRuns(limit = 50, skip = 0, workspaceId?: string) {
    try {
        const db = await getDatabase();
        const col = db.collection<VectorIndexRun>(COLLECTION_NAME);

        const filter = workspaceId ? { workspaceId } : {};
        const runs = await col.find(filter)
            .sort({ end: -1 })
            .skip(skip)
            .limit(limit)
            .toArray();

        return runs;
    } catch (error) {
        console.error("Failed to fetch vector index runs:", error);
        return [];
    }
}

export async function getLatestVectorIndexRun(workspaceId?: string) {
    try {
        const db = await getDatabase();
        const col = db.collection<VectorIndexRun>(COLLECTION_NAME);

        const filter = workspaceId ? { workspaceId } : {};
        return await col.findOne(filter, { sort: { end: -1 } });
    } catch {
        return null;
    }
}
