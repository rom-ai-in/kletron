
import type { NextApiRequest, NextApiResponse } from 'next';
import { ReActEngine } from '../../../../services/agent/ReActEngine';
import { AgentEvent } from '../../../../types';

export const config = {
    api: {
        responseLimit: false,
    },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        res.status(405).end(`Method ${req.method} Not Allowed`);
        return;
    }

    const { id } = req.query;
    if (typeof id !== 'string') {
        res.status(400).json({ error: 'Conversation ID is required' });
        return;
    }

    const { message, graphId, llmProvider } = req.body;
    if (!message || typeof message !== 'string') {
        res.status(400).json({ error: 'Message is required' });
        return;
    }

    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const engine = ReActEngine.getInstance();

    // Map llmProvider string to selection object
    const llmSelection = llmProvider ? {
        provider: llmProvider as 'azure' | 'lmstudio',
        model: undefined
    } : undefined;

    try {
        await engine.chat(
            id,
            message,
            (event: AgentEvent) => {
                // Send each event as SSE
                res.write(`data: ${JSON.stringify(event)}\n\n`);
            },
            llmSelection
        );

        // Signal completion
        res.write(`data: [DONE]\n\n`);
        res.end();
    } catch (error: any) {
        console.error('Chat error:', error);
        res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
        res.end();
    }
}
