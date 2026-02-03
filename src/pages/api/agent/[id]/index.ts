
import type { NextApiRequest, NextApiResponse } from 'next';
import { ConversationService } from '../../../../services/agent/ConversationService';
import { requirePagesRouteAuth } from '@/src/lib/auth/apiAuth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const auth = await requirePagesRouteAuth(req, res);
    if (!auth) return;

    const service = new ConversationService();
    const { id } = req.query;

    if (typeof id !== 'string') {
        res.status(400).json({ error: 'ID is required' });
        return;
    }

    if (req.method === 'GET') {
        try {
            const conversation = await service.get(id);
            if (!conversation) {
                res.status(404).json({ error: 'Conversation not found' });
                return;
            }
            res.status(200).json(conversation);
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
        return;
    }

    if (req.method === 'DELETE') {
        // Archive
        try {
            await service.archive(id);
            res.status(200).json({ success: true });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
        return;
    }

    res.setHeader('Allow', ['GET', 'DELETE']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
}
