import type { NextApiRequest, NextApiResponse } from 'next';
import { editorStore, subscribers } from '../store';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    // Send initial state
    res.write(`data: ${JSON.stringify({ type: 'SYNC', payload: editorStore })}\n\n`);

    const sendUpdate = (state: any) => {
        res.write(`data: ${JSON.stringify({ type: 'SYNC', payload: state })}\n\n`);
    };

    subscribers.add(sendUpdate);

    // Heartbeat to keep connection alive
    const interval = setInterval(() => {
        res.write(': heartbeat\n\n');
    }, 15000);

    req.on('close', () => {
        clearInterval(interval);
        subscribers.delete(sendUpdate);
        res.end();
    });
}
