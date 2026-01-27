
import type { NextApiRequest, NextApiResponse } from 'next';
import { SafeEditGate } from '../../../services/agent/SafeEditGate';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const gate = SafeEditGate.getInstance();

    if (req.method === 'POST') {
        const { editId, conversationId, action } = req.body;

        // Batch rejection: reject all pending edits for a conversation
        if (conversationId && action === 'all') {
            try {
                const edits = gate.rejectAll(conversationId);
                res.status(200).json({ success: true, rejected: edits.length });
                return;
            } catch (e: any) {
                res.status(500).json({ error: e.message });
                return;
            }
        }

        // Single edit rejection
        if (!editId) {
            res.status(400).json({ error: 'Edit ID is required' });
            return;
        }

        try {
            gate.rejectEdit(editId);
            res.status(200).json({ success: true });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
        return;
    }

    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
}
