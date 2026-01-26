
import type { NextApiRequest, NextApiResponse } from 'next';
import { ReActEngine } from '../../../../services/agent/ReActEngine';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const engine = ReActEngine.getInstance();
    const { id } = req.query;

    if (typeof id !== 'string') {
        res.status(400).json({ error: 'ID is required' });
        return;
    }

    if (req.method === 'POST') {
        const { message } = req.body;
        if (!message) {
            res.status(400).json({ error: 'Message is required' });
            return;
        }

        try {
            // Basic implementation: wait for full response
            // TODO: Support SSE for streaming
            const response = await engine.chat(id, message);
            res.status(200).json({ response });
        } catch (e: any) {
            console.error(e);
            res.status(500).json({ error: e.message });
        }
        return;
    }

    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
}
