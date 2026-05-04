// pages/api/workspaces/[workspaceId]/categories.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { getWorkspaceByIdUnsafe } from '@kletron/server/services/workspaceService';
import { DEFAULT_WORK_CATEGORIES } from '@kletron/shared';

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    const { workspaceId } = req.query;
    
    if (!workspaceId || typeof workspaceId !== 'string') {
        return res.status(400).json({ error: 'Invalid workspace ID' });
    }
    
    // Verify workspace exists
    const workspace = await getWorkspaceByIdUnsafe(workspaceId);
    if (!workspace) {
        return res.status(404).json({ error: 'Workspace not found' });
    }
    
    switch (req.method) {
        case 'GET':
            return handleGetCategories(req, res, workspaceId);
        case 'POST':
            return handleUpdateCategoryConfig(req, res, workspaceId);
        default:
            res.setHeader('Allow', ['GET', 'POST']);
            return res.status(405).end(`Method ${req.method} Not Allowed`);
    }
}

async function handleGetCategories(
    req: NextApiRequest,
    res: NextApiResponse,
    workspaceId: string
) {
    try {
        // In production, get category configs from database
        const categories = DEFAULT_WORK_CATEGORIES.map(cat => ({
            ...cat,
            isEnabled: true,
            customName: undefined,
            customDescription: undefined,
            customIcon: undefined,
            customColor: undefined
        }));
        
        return res.status(200).json({ categories });
    } catch (error) {
        console.error('Error fetching workspace categories:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

async function handleUpdateCategoryConfig(
    req: NextApiRequest,
    res: NextApiResponse,
    workspaceId: string
) {
    try {
        const { categoryId, config } = req.body;
        
        if (!categoryId || typeof categoryId !== 'string') {
            return res.status(400).json({ error: 'categoryId is required' });
        }
        
        // In production, update category config in database
        console.log(`Updating category ${categoryId} config for workspace ${workspaceId}`);
        console.log('Config:', config);
        
        return res.status(200).json({ success: true, categoryId });
    } catch (error) {
        console.error('Error updating category config:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
