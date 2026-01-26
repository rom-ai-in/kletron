
import type { NextApiRequest, NextApiResponse } from 'next';
import { ConversationService } from '../../../services/agent/ConversationService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const service = new ConversationService();

    if (req.method === 'GET') {
        try {
            const list = await service.list();
            res.status(200).json(list);
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
        return;
    }

    if (req.method === 'POST') {
        const { title } = req.body;
        if (!title) {
            res.status(400).json({ error: 'Title is required' });
            return;
        }
        try {
            const conversation = await service.create(title);
            res.status(200).json(conversation);
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
        return;
    }

    if (req.method === 'DELETE') {
        const { id, permanent } = req.query;
        if (!id || typeof id !== 'string') {
            res.status(400).json({ error: 'ID is required' });
            return;
        }
        try {
            if (permanent === 'true') {
                await service.delete(id);
            } else {
                await service.archive(id);
            }
            res.status(200).json({ success: true });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
        return;
    }

    res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
}
