// pages/api/workspaces/[workspaceId]/categories/[categoryId]/automations.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { requirePagesRouteAuth } from '@kletron/server/lib/auth/apiAuth';

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    const auth = await requirePagesRouteAuth(req, res);
    if (!auth) {
        return;
    }

    const { workspaceId, categoryId } = req.query;
    
    if (!workspaceId || typeof workspaceId !== 'string') {
        return res.status(400).json({ error: 'Invalid workspace ID' });
    }
    
    if (!categoryId || typeof categoryId !== 'string') {
        return res.status(400).json({ error: 'Invalid category ID' });
    }
    
    switch (req.method) {
        case 'GET':
            return handleGetCategoryAutomations(req, res);
        default:
            res.setHeader('Allow', ['GET']);
            return res.status(405).end(`Method ${req.method} Not Allowed`);
    }
}

async function handleGetCategoryAutomations(
    req: NextApiRequest,
    res: NextApiResponse
) {
    try {
        const { workspaceId, categoryId } = req.query;
        
        // In production, get automations from database for this workspace and category
        const automations = [
            {
                id: 'daily-backup',
                name: 'Daily Code Backup',
                description: 'Backup code repository daily at 2 AM',
                categoryId: 'automation' as string,
                isEnabled: true,
                schedule: '0 2 * * *',
                lastRun: new Date(Date.now() - 86400000).toISOString(), // Yesterday
                nextRun: new Date(Date.now() + 3600000).toISOString(), // In 1 hour
                createdAt: new Date(Date.now() - 7 * 86400000).toISOString(), // 1 week ago
                updatedAt: new Date().toISOString()
            },
            {
                id: 'test-notifications',
                name: 'Test Failure Notifications',
                description: 'Send email when tests fail',
                categoryId: 'automation' as string,
                isEnabled: false,
                schedule: null,
                trigger: 'on_test_failure',
                lastRun: null,
                nextRun: null,
                createdAt: new Date(Date.now() - 3 * 86400000).toISOString(), // 3 days ago
                updatedAt: new Date().toISOString()
            }
        ].filter(automation => automation.categoryId === categoryId);
        
        return res.status(200).json(automations);
    } catch (error) {
        console.error('Error fetching category automations:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
