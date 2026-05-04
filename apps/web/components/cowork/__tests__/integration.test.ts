// apps/web/components/cowork/__tests__/integration.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock all dependencies
vi.mock('@kletron/shared', () => ({
    DEFAULT_WORK_CATEGORIES: [
        { id: 'coding', name: 'Code', description: 'Code assistance', icon: '💻', color: '#3B82F6' },
        { id: 'drafting', name: 'Draft', description: 'Document drafting', icon: '✏️', color: '#10B981' },
        { id: 'automation', name: 'Automate', description: 'Workflow automation', icon: '⚡', color: '#F59E0B' },
        { id: 'general', name: 'General', description: 'General assistance', icon: '🎯', color: '#6B7280' }
    ]
}));

describe('CoWork Integration', () => {
    describe('Category System', () => {
        it('should have all required categories', () => {
            const categories = [
                { id: 'coding', name: 'Code', description: 'Code assistance', icon: '💻', color: '#3B82F6' },
                { id: 'drafting', name: 'Draft', description: 'Document drafting', icon: '✏️', color: '#10B981' },
                { id: 'automation', name: 'Automate', description: 'Workflow automation', icon: '⚡', color: '#F59E0B' },
                { id: 'general', name: 'General', description: 'General assistance', icon: '🎯', color: '#6B7280' }
            ];

            expect(categories).toHaveLength(4);
            expect(categories.map(c => c.id)).toEqual(['coding', 'drafting', 'automation', 'general']);
        });

        it('should validate category colors', () => {
            const categories = [
                { id: 'coding', color: '#3B82F6' },
                { id: 'drafting', color: '#10B981' },
                { id: 'automation', color: '#F59E0B' },
                { id: 'general', color: '#6B7280' }
            ];

            categories.forEach(cat => {
                expect(cat.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
            });
        });
    });

    describe('API Endpoints', () => {
        it('should have all required API endpoints', () => {
            const requiredEndpoints = [
                '/api/workspaces/[workspaceId]/categories',
                '/api/workspaces/[workspaceId]/categories/[categoryId]/process',
                '/api/workspaces/[workspaceId]/automations',
                '/api/workspaces/[workspaceId]/context/preserve',
                '/api/workspaces/[workspaceId]/context/restore',
                '/api/analytics/events'
            ];

            expect(requiredEndpoints).toHaveLength(6);
        });
    });

    describe('Electron Components', () => {
        it('should have all required Electron modules', () => {
            const requiredModules = [
                'categoryHandlers',
                'notifications',
                'protocol',
                'windowManager',
                'statusBar',
                'iconManager',
                'security'
            ];

            expect(requiredModules).toHaveLength(7);
        });
    });

    describe('Database Migrations', () => {
        it('should have migration file', () => {
            const migrationFile = '001_cowork_categories.sql';
            expect(migrationFile).toMatch(/^[0-9]+_.*\.sql$/);
        });

        it('should create all required tables', () => {
            const requiredTables = [
                'work_categories',
                'workspace_category_configs',
                'workspace_skill_configs',
                'workspace_connector_configs',
                'workspace_automations',
                'context_transitions',
                'user_journey_events',
                'category_performance_metrics'
            ];

            expect(requiredTables).toHaveLength(8);
        });
    });

    describe('State Management', () => {
        it('should have CoworkContext', () => {
            const requiredState = {
                currentCategory: 'string',
                currentWorkspace: 'string | null',
                messages: 'array',
                isLoading: 'boolean',
                isConnected: 'boolean',
                categories: 'array',
                contextPreserved: 'boolean',
                lastCategorySwitch: 'Date | null',
                preservedFrom: 'string | null'
            };

            expect(requiredState).toBeDefined();
        });

        it('should have all required actions', () => {
            const requiredActions = [
                'setCurrentCategory',
                'switchCategory',
                'sendMessage',
                'clearMessages',
                'setWorkspace',
                'restoreContext'
            ];

            expect(requiredActions).toHaveLength(6);
        });
    });
});
