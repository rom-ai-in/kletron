import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AutomationStageConfig, AutomationStatus } from "@numezis/shared/automationTypes";

// Valid MongoDB ObjectId format (24-character hex string)
const VALID_AUTOMATION_ID = '507f1f77bcf86cd799439011';
const VALID_SESSION_ID = '507f1f77bcf86cd799439012';

// Mock database module
const mockInsertOne = vi.fn().mockResolvedValue({ insertedId: { toString: () => VALID_AUTOMATION_ID } });
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

vi.mock('@numezis/server/lib/db', () => ({
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

describe('AutomationExecutor Integration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('createAutomation', () => {
        it('should create an automation with valid configuration', async () => {
            const { AutomationExecutor } = await import('@numezis/server/services/automationExecutor');
            const executor = new AutomationExecutor();

            const stages: AutomationStageConfig[] = [
                {
                    id: 'stage-1',
                    name: 'Recon',
                    prompt: 'Recon prompt',
                    graphId: 'audit',
                    llmProvider: 'openai',
                },
            ];

            const automationId = await executor.createAutomation({
                name: 'Test Automation',
                description: 'Test description',
                stages,
            });

            expect(mockCollection).toHaveBeenCalledWith('audit_chains');
            expect(mockInsertOne).toHaveBeenCalledWith(
                expect.objectContaining({
                    name: 'Test Automation',
                    description: 'Test description',
                    stages: expect.arrayContaining([
                        expect.objectContaining({ id: 'stage-1', name: 'Recon' }),
                    ]),
                    status: 'PENDING',
                })
            );
            expect(automationId).toBe(VALID_AUTOMATION_ID);
        });
    });

    describe('getAutomation', () => {
        it('should return automation by ID', async () => {
            const mockAutomation = {
                _id: { toString: () => VALID_AUTOMATION_ID },
                name: 'Test Automation',
                status: 'PENDING' as AutomationStatus,
                stages: [],
                currentStageIndex: 0,
                sessionIds: [],
                aggregatedFindings: [],
                crossStageInsights: [],
                createdAt: new Date(),
            };
            mockFindOne.mockResolvedValueOnce(mockAutomation);

            const { AutomationExecutor } = await import('@numezis/server/services/automationExecutor');
            const executor = new AutomationExecutor();

            const automation = await executor.getAutomation(VALID_AUTOMATION_ID);

            expect(mockCollection).toHaveBeenCalledWith('audit_chains');
            expect(automation).toEqual(mockAutomation);
        });

        it('should return null for non-existent automation', async () => {
            mockFindOne.mockResolvedValueOnce(null);

            const { AutomationExecutor } = await import('@numezis/server/services/automationExecutor');
            const executor = new AutomationExecutor();

            // Use a different valid ObjectId that doesn't exist
            const automation = await executor.getAutomation('507f1f77bcf86cd799439099');

            expect(automation).toBeNull();
        });
    });

    describe('updateAutomationStatus', () => {
        it('should update automation status', async () => {
            const { AutomationExecutor } = await import('@numezis/server/services/automationExecutor');
            const executor = new AutomationExecutor();

            await executor.updateAutomationStatus(VALID_AUTOMATION_ID, 'RUNNING');

            expect(mockUpdateOne).toHaveBeenCalledWith(
                expect.objectContaining({ _id: expect.anything() }),
                expect.objectContaining({
                    $set: expect.objectContaining({ status: 'RUNNING' }),
                })
            );
        });
    });

    describe('deleteAutomation', () => {
        it('should delete an automation by ID', async () => {
            const { AutomationExecutor } = await import('@numezis/server/services/automationExecutor');
            const executor = new AutomationExecutor();

            await executor.deleteAutomation(VALID_AUTOMATION_ID);

            expect(mockCollection).toHaveBeenCalledWith('audit_chains');
            expect(mockDeleteOne).toHaveBeenCalled();
        });
    });
});
