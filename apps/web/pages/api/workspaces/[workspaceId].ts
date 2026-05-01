// pages/api/workspaces/[workspaceId].ts
import { NextApiRequest, NextApiResponse } from 'next';

export default function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    const { workspaceId } = req.query;
    
    if (!workspaceId || typeof workspaceId !== 'string') {
        return res.status(400).json({ error: 'Invalid workspace ID' });
    }
    
    switch (req.method) {
        case 'GET':
            return handleGetWorkspace(req, res);
        default:
            res.setHeader('Allow', ['GET']);
            return res.status(405).end(`Method ${req.method} Not Allowed`);
    }
}

async function handleGetWorkspace(
    req: NextApiRequest,
    res: NextApiResponse
) {
    try {
        const { workspaceId } = req.query;
        
        // In production, get workspace from database
        const workspace = {
            id: workspaceId,
            name: 'My Project',
            rootPath: '/Users/romainmagnin/Desktop/kletron',
            createdAt: new Date('2024-01-15'),
            updatedAt: new Date(),
            description: 'Main development workspace',
            isActive: true,
            defaultCategoryId: 'coding'
        };
        
        return res.status(200).json(workspace);
    } catch (error) {
        console.error('Error fetching workspace:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}