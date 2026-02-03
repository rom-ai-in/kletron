import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { AuditStageConfig, ChainStatus } from '../../services/chainTypes';

// Valid MongoDB ObjectId format (24-character hex string)
const VALID_CHAIN_ID = '507f1f77bcf86cd799439011';
const VALID_SESSION_ID = '507f1f77bcf86cd799439012';

// Mock database module
const mockInsertOne = vi.fn().mockResolvedValue({ insertedId: { toString: () => VALID_CHAIN_ID } });
const mockFindOne = vi.fn();
const mockFind = vi.fn().mockReturnValue({
    sort: vi.fn().mockReturnThis(),
    toArray: vi.fn().mockResolvedValue([]),
});
const mockUpdateOne = vi.fn().mockResolvedValue({ modifiedCount: 1 });
const mockDeleteOne = vi.fn().mockResolvedValue({ deletedCount: 1 });

const mockCollection = vi.fn().mockImplementation((name: string) => ({
    insertOne: mockInsertOne,
    findOne: mockFindOne,
    find: mockFind,
    updateOne: mockUpdateOne,
    deleteOne: mockDeleteOne,
}));

const mockDb = { collection: mockCollection };

vi.mock('../../lib/db', () => ({
    getDb: vi.fn().mockResolvedValue(mockDb),
}));

// Mock workflow runner
vi.mock('../../workflows', () => ({
    runWorkflow: vi.fn().mockResolvedValue({
        sessionId: 'session-123',
        timeline: [],
        conclusion: 'Test completed',
        outputs: {
            context: {},
            target_files: [],
            raw_claims: [],
            verified_findings: [],
            findings: [],
            tasks: [],
            report: 'Test report',
        },
        eventStream: [],
    }),
}));

// Mock prompt reader
vi.mock('@/app/api/prompts/utils', () => ({
    readPromptFile: vi.fn().mockResolvedValue('Test prompt content'),
}));

describe('ChainExecutor Integration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('createChain', () => {
        it('should create a chain with valid configuration', async () => {
            const { ChainExecutor } = await import('../../services/chainExecutor');
            const executor = new ChainExecutor();

            const stages: AuditStageConfig[] = [
                {
                    id: 'stage-1',
                    name: 'Recon',
                    graphId: 'audit',
                    promptPath: 'prompts/test.md',
                    llmProvider: 'openai',
                },
            ];

            const chainId = await executor.createChain({
                name: 'Test Chain',
                description: 'Test description',
                stages,
            });

            expect(mockCollection).toHaveBeenCalledWith('audit_chains');
            expect(mockInsertOne).toHaveBeenCalledWith(
                expect.objectContaining({
                    name: 'Test Chain',
                    description: 'Test description',
                    stages: expect.arrayContaining([
                        expect.objectContaining({ id: 'stage-1', name: 'Recon' }),
                    ]),
                    status: 'PENDING',
                })
            );
            expect(chainId).toBe(VALID_CHAIN_ID);
        });
    });

    describe('getChain', () => {
        it('should return chain by ID', async () => {
            const mockChain = {
                _id: { toString: () => VALID_CHAIN_ID },
                name: 'Test Chain',
                status: 'PENDING' as ChainStatus,
                stages: [],
                currentStageIndex: 0,
                sessionIds: [],
                aggregatedFindings: [],
                crossStageInsights: [],
                createdAt: new Date(),
            };
            mockFindOne.mockResolvedValueOnce(mockChain);

            const { ChainExecutor } = await import('../../services/chainExecutor');
            const executor = new ChainExecutor();

            const chain = await executor.getChain(VALID_CHAIN_ID);

            expect(mockCollection).toHaveBeenCalledWith('audit_chains');
            expect(chain).toEqual(mockChain);
        });

        it('should return null for non-existent chain', async () => {
            mockFindOne.mockResolvedValueOnce(null);

            const { ChainExecutor } = await import('../../services/chainExecutor');
            const executor = new ChainExecutor();

            // Use a different valid ObjectId that doesn't exist
            const chain = await executor.getChain('507f1f77bcf86cd799439099');

            expect(chain).toBeNull();
        });
    });

    describe('updateChainStatus', () => {
        it('should update chain status', async () => {
            const { ChainExecutor } = await import('../../services/chainExecutor');
            const executor = new ChainExecutor();

            await executor.updateChainStatus(VALID_CHAIN_ID, 'RUNNING');

            expect(mockUpdateOne).toHaveBeenCalledWith(
                expect.objectContaining({ _id: expect.anything() }),
                expect.objectContaining({
                    $set: expect.objectContaining({ status: 'RUNNING' }),
                })
            );
        });
    });

    describe('deleteChain', () => {
        it('should delete a chain by ID', async () => {
            const { ChainExecutor } = await import('../../services/chainExecutor');
            const executor = new ChainExecutor();

            await executor.deleteChain(VALID_CHAIN_ID);

            expect(mockCollection).toHaveBeenCalledWith('audit_chains');
            expect(mockDeleteOne).toHaveBeenCalled();
        });
    });
});
