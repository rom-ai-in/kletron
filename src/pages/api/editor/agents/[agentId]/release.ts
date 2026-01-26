import type { NextApiRequest, NextApiResponse } from 'next';
import { updateStore } from '../../store';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') return res.status(405).end();

    const { agentId } = req.query;
    const { fileId } = req.body;

    if (!agentId || !fileId) return res.status(400).json({ error: 'Missing agentId or fileId' });

    updateStore((prev) => {
        const currentAgents = prev.fileAgents[fileId] || [];
        const newAgents = currentAgents.filter(id => id !== agentId);

        // Remove from openFiles if no agents left? Maybe keep it if user has it open.
        // For now, if no agents, we remove from this specific map tracking. 
        // We'll keep it in openFiles for now unless we want strict sync.

        return {
            ...prev,
            fileAgents: { ...prev.fileAgents, [fileId]: newAgents }
        };
    });

    return res.status(200).json({ success: true });
}
