import { describe, it, expect, vi, beforeEach } from 'vitest';
import { recordVectorIndexRun, getVectorIndexRuns } from '../../services/vectorHistoryService';
import { Collection, Db } from 'mongodb';

const { mockDb, mockCollection } = vi.hoisted(() => {
    const collection = {
        insertOne: vi.fn(),
        find: vi.fn().mockReturnThis(),
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        toArray: vi.fn().mockResolvedValue([]),
        findOne: vi.fn(),
    };
    return {
        mockCollection: collection,
        mockDb: { collection: vi.fn().mockReturnValue(collection) }
    };
});

vi.mock('../../services/mongoClient', () => ({
    getDatabase: vi.fn().mockResolvedValue(mockDb),
}));

describe('vectorHistoryService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should record a vector index run', async () => {
        const runData = {
            start: new Date(),
            end: new Date(),
            durationMs: 1000,
            totalFiles: 10,
            processedFiles: 5,
            chunksGenerated: 20,
            status: 'success' as const,
            errors: [],
            trigger: 'manual' as const,
            repoPath: '/tmp/repo'
        };

        await recordVectorIndexRun(runData);

        expect(mockDb.collection).toHaveBeenCalledWith('vector_index_runs');
        expect(mockCollection.insertOne).toHaveBeenCalledWith(runData);
    });

    it('should fetch vector index runs with pagination', async () => {
        const mockRuns = [{ id: '1', start: new Date() }];
        mockCollection.toArray.mockResolvedValueOnce(mockRuns);

        const result = await getVectorIndexRuns(10, 5);

        expect(mockDb.collection).toHaveBeenCalledWith('vector_index_runs');
        expect(mockCollection.find).toHaveBeenCalledWith({});
        expect(mockCollection.sort).toHaveBeenCalledWith({ end: -1 });
        expect(mockCollection.skip).toHaveBeenCalledWith(5);
        expect(mockCollection.limit).toHaveBeenCalledWith(10);
        expect(result).toEqual(mockRuns);
    });

    it('should handle errors gracefully during recording', async () => {
        mockCollection.insertOne.mockRejectedValueOnce(new Error('DB Error'));

        // Should not throw
        await expect(recordVectorIndexRun({} as any)).resolves.not.toThrow();
    });

    it('should handle errors gracefully during fetching', async () => {
        mockDb.collection.mockImplementationOnce(() => {
            throw new Error("Connection failed");
        });

        const result = await getVectorIndexRuns();
        expect(result).toEqual([]);
    });
});
