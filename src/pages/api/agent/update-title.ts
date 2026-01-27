
import type { NextApiRequest, NextApiResponse } from 'next';
import { ConversationService } from '../../../services/agent/ConversationService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'PUT') {
        res.setHeader('Allow', ['PUT']);
        res.status(405).end(`Method ${req.method} Not Allowed`);
        return;
    }

    const service = new ConversationService();
    const { conversationId, title } = req.body;

    if (!conversationId || typeof conversationId !== 'string') {
        res.status(400).json({ error: 'Missing conversationId' });
        return;
    }

    if (!title || typeof title !== 'string') {
        res.status(400).json({ error: 'Missing title' });
        return;
    }

    try {
        const conversation = await service.get(conversationId);
        if (!conversation) {
            res.status(404).json({ error: 'Conversation not found' });
            return;
        }

        await service.updateTitle(conversationId, title.trim());

        res.status(200).json({ success: true, title: title.trim() });
    } catch (e: any) {
        console.error('[API /api/agent/update-title PUT] Error:', e);
        res.status(500).json({ error: 'Failed to update title' });
    }
}
