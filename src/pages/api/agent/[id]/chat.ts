
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
            // Enable streaming
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');

            await engine.chat(id, message, (event) => {
                res.write(`data: ${JSON.stringify(event)}\n\n`);
            });

            res.write(`data: [DONE]\n\n`);
            res.end();
        } catch (e: any) {
            console.error(e);
            // If headers are already sent, we can't send a JSON error.
            // We should ideally send an error event.
            if (!res.headersSent) {
                res.status(500).json({ error: e.message });
            } else {
                res.write(`data: ${JSON.stringify({ error: e.message })}\n\n`);
                res.end();
            }
        }
        return;
    }

    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
}
