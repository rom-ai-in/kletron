import type { NextApiRequest, NextApiResponse } from 'next';
import { updateStore } from '../../store';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'PATCH') return res.status(405).end();

    const { agentId } = req.query;
    const { fileId, position } = req.body; // position: { line, column }

    if (!agentId || !fileId || !position) return res.status(400).json({ error: 'Missing parameters' });

    updateStore((prev) => {
        return {
            ...prev,
            cursors: {
                ...prev.cursors,
                [agentId as string]: {
                    agentId: agentId as string,
                    fileId,
                    position,
                    label: `Agent ${agentId}`, // Simplified label
                    color: '#10b981' // Hardcoded emerald-500 for now, could be dynamic
                }
            }
        };
    });

    return res.status(200).json({ success: true });
}
