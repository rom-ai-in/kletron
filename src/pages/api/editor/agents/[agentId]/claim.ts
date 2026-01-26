import type { NextApiRequest, NextApiResponse } from 'next';
import { updateStore } from '../../store';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') return res.status(405).end();

    const { agentId } = req.query;
    const { fileId } = req.body;

    if (!agentId || !fileId) return res.status(400).json({ error: 'Missing agentId or fileId' });

    updateStore((prev) => {
        const currentAgents = prev.fileAgents[fileId] || [];
        if (!currentAgents.includes(agentId as string)) {
            const newAgents = [...currentAgents, agentId as string];
            const newOpenFiles = prev.openFiles.includes(fileId) ? prev.openFiles : [...prev.openFiles, fileId];

            return {
                ...prev,
                fileAgents: { ...prev.fileAgents, [fileId]: newAgents },
                openFiles: newOpenFiles
            };
        }
        return prev;
    });

    return res.status(200).json({ success: true });
}
