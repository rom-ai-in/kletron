
import type { NextApiRequest, NextApiResponse } from 'next';
import { SafeEditGate } from '../../../services/agent/SafeEditGate';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const gate = SafeEditGate.getInstance();

    if (req.method === 'GET') {
        const { conversationId } = req.query;
        try {
            const edits = gate.listPendingEdits(typeof conversationId === 'string' ? conversationId : undefined);
            console.log(`[/api/agent/edits] Returning ${edits.length} pending edits for conversationId: ${conversationId}`);
            res.status(200).json(edits);
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
        return;
    }

    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
}
